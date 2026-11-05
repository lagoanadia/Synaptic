import { prisma } from "@/lib/prisma";

// Same Google OAuth client as sign-in, but a separate flow, so signing in with
// Google never asks for Classroom access. Read-only: Google only lets
// allowlisted Marketplace apps write submissions.
const CLASSROOM_SCOPES = [
  "https://www.googleapis.com/auth/classroom.courses.readonly",
  "https://www.googleapis.com/auth/classroom.coursework.me.readonly",
  // Posted materials (not assignments) need their own scope.
  "https://www.googleapis.com/auth/classroom.courseworkmaterials.readonly",
];

function redirectUri(baseUrl: string) {
  return `${baseUrl}/api/classroom/callback`;
}

// state = pursuitId + userId, read back by the same server; no signing needed.
export function buildAuthUrl(baseUrl: string, pursuitId: string): string {
  const params = new URLSearchParams({
    client_id: process.env.AUTH_GOOGLE_ID ?? "",
    redirect_uri: redirectUri(baseUrl),
    response_type: "code",
    scope: CLASSROOM_SCOPES.join(" "),
    access_type: "offline",
    // Without this, re-connecting (e.g. after a revoke) silently omits
    // the refresh_token on the second and later authorizations — Google
    // only issues it by default on the very first consent ever.
    prompt: "consent",
    state: pursuitId,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
};

export async function exchangeCodeForTokens(
  baseUrl: string,
  code: string,
): Promise<TokenResponse> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.AUTH_GOOGLE_ID ?? "",
      client_secret: process.env.AUTH_GOOGLE_SECRET ?? "",
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri(baseUrl),
    }),
  });
  if (!res.ok) {
    throw new Error(`Google token exchange failed: ${await res.text()}`);
  }
  return res.json();
}

async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.AUTH_GOOGLE_ID ?? "",
      client_secret: process.env.AUTH_GOOGLE_SECRET ?? "",
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    throw new Error(`Google token refresh failed: ${await res.text()}`);
  }
  return res.json();
}

// Refreshes lazily on use rather than on a schedule — Classroom import is
// an occasional action, not something running in the background that
// would need a token kept warm.
export async function getValidAccessToken(userId: string): Promise<string | null> {
  const connection = await prisma.googleClassroomConnection.findUnique({ where: { userId } });
  if (!connection) return null;

  if (connection.expiresAt > new Date(Date.now() + 60_000)) {
    return connection.accessToken;
  }

  try {
    const refreshed = await refreshAccessToken(connection.refreshToken);
    await prisma.googleClassroomConnection.update({
      where: { userId },
      data: {
        accessToken: refreshed.access_token,
        expiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
      },
    });
    return refreshed.access_token;
  } catch {
    // Refresh token revoked: drop the connection so the UI offers to reconnect.
    await prisma.googleClassroomConnection.deleteMany({ where: { userId } });
    return null;
  }
}

export type ClassroomCourse = { id: string; name: string };

export async function listCourses(accessToken: string): Promise<ClassroomCourse[]> {
  const res = await fetch(
    "https://classroom.googleapis.com/v1/courses?courseStates=ACTIVE&pageSize=100",
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) throw new Error(`Classroom courses.list failed: ${await res.text()}`);
  const data = await res.json();
  return (data.courses ?? []).map((c: { id: string; name: string }) => ({
    id: c.id,
    name: c.name,
  }));
}

export type ClassroomFile = { title: string; url: string };

// A Material is a oneOf on Classroom's side (driveFile, link, youtubeVideo,
// form) — only driveFile and link carry anything we can point an
// Attachment at.
type Material = {
  driveFile?: { driveFile?: { title?: string; alternateLink?: string } };
  link?: { url?: string; title?: string };
};

// Each courseWork/courseWorkMaterials item is a whole assignment or post —
// the actual attachments (Drive files, links, etc.) live nested one level
// down, in its own `materials` array.
type CourseWorkItem = {
  materials?: Material[];
};

// Teachers post files as assignments or as plain materials; fetch both.
async function listMaterials(
  accessToken: string,
  courseId: string,
  kind: "courseWork" | "courseWorkMaterials",
): Promise<CourseWorkItem[]> {
  const res = await fetch(
    `https://classroom.googleapis.com/v1/courses/${courseId}/${kind}?pageSize=100`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) throw new Error(`Classroom ${kind}.list failed: ${await res.text()}`);
  const data = await res.json();
  // The response field is singular ("courseWorkMaterial"), not the path name.
  const responseKey = kind === "courseWorkMaterials" ? "courseWorkMaterial" : "courseWork";
  return data[responseKey] ?? [];
}

// Any Drive file or link; YouTube videos and Forms are skipped.
export async function listCourseFiles(
  accessToken: string,
  courseId: string,
): Promise<ClassroomFile[]> {
  // allSettled, not all — courseWork and courseWorkMaterials are scoped
  // separately, so one missing/expired scope shouldn't blank out results
  // that the other endpoint could still provide.
  const [work, materials] = await Promise.allSettled([
    listMaterials(accessToken, courseId, "courseWork"),
    listMaterials(accessToken, courseId, "courseWorkMaterials"),
  ]);
  if (work.status === "rejected" && materials.status === "rejected") {
    throw work.reason;
  }

  const items = [
    ...(work.status === "fulfilled" ? work.value : []),
    ...(materials.status === "fulfilled" ? materials.value : []),
  ];

  const files: ClassroomFile[] = [];
  for (const item of items) {
    for (const material of item.materials ?? []) {
      const drive = material.driveFile?.driveFile;
      if (drive?.alternateLink) {
        // Classroom doesn't always back-fill the title for a file it
        // didn't create itself (e.g. a teacher's own upload attached from
        // Drive) — fall back rather than silently dropping the file.
        files.push({ title: drive.title || "Untitled file", url: drive.alternateLink });
        continue;
      }
      const link = material.link;
      if (link?.url) {
        files.push({ title: link.title || link.url, url: link.url });
      }
    }
  }
  return files;
}

export type ClassroomDeadline = {
  id: string;
  title: string;
  dueAt: Date;
  url: string;
  turnedIn: boolean;
  late: boolean;
};

type CourseWorkRaw = {
  id: string;
  title?: string;
  alternateLink?: string;
  dueDate?: { year: number; month: number; day: number };
  dueTime?: { hours?: number; minutes?: number };
};

type StudentSubmissionRaw = {
  courseWorkId: string;
  state?: string;
  late?: boolean;
};

// courseWorkId "-" = every assignment, in one call.
async function listOwnSubmissionStates(
  accessToken: string,
  courseId: string,
): Promise<Map<string, { state: string; late: boolean }>> {
  const res = await fetch(
    `https://classroom.googleapis.com/v1/courses/${courseId}/courseWork/-/studentSubmissions?userId=me&pageSize=100`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) {
    throw new Error(`Classroom studentSubmissions.list failed: ${await res.text()}`);
  }
  const data = await res.json();
  const items: StudentSubmissionRaw[] = data.studentSubmissions ?? [];
  const map = new Map<string, { state: string; late: boolean }>();
  for (const item of items) {
    map.set(item.courseWorkId, { state: item.state ?? "NEW", late: item.late ?? false });
  }
  return map;
}

// Only assignments have due dates. They carry no timezone, so times can be
// off by a few hours, which is fine for a reminder.
export async function listCourseDeadlines(
  accessToken: string,
  courseId: string,
): Promise<ClassroomDeadline[]> {
  const [res, submissions] = await Promise.all([
    fetch(
      `https://classroom.googleapis.com/v1/courses/${courseId}/courseWork?pageSize=100&courseWorkStates=PUBLISHED`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    ),
    // Turn-in status is a nice-to-have: a failure here mustn't lose the deadlines.
    listOwnSubmissionStates(accessToken, courseId).catch(() => new Map<string, { state: string; late: boolean }>()),
  ]);
  if (!res.ok) throw new Error(`Classroom courseWork.list failed: ${await res.text()}`);
  const data = await res.json();
  const items: CourseWorkRaw[] = data.courseWork ?? [];

  const deadlines: ClassroomDeadline[] = [];
  for (const item of items) {
    if (!item.dueDate || !item.title || !item.alternateLink) continue;
    const { year, month, day } = item.dueDate;
    const hours = item.dueTime?.hours ?? 23;
    const minutes = item.dueTime?.minutes ?? 59;
    const submission = submissions.get(item.id);
    deadlines.push({
      id: item.id,
      title: item.title,
      dueAt: new Date(year, month - 1, day, hours, minutes),
      url: item.alternateLink,
      turnedIn: submission?.state === "TURNED_IN" || submission?.state === "RETURNED",
      late: submission?.late ?? false,
    });
  }
  deadlines.sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
  return deadlines;
}

