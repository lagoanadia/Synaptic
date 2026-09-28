import { prisma } from "@/lib/prisma";

// Reuses the same Google OAuth Client as NextAuth's own Google sign-in
// (AUTH_GOOGLE_ID/SECRET — see auth.ts) rather than a second Client, since
// it's the same Google Cloud project either way; only the requested scopes
// and redirect URI differ, which is why this is a separate hand-rolled
// flow instead of adding these scopes to the NextAuth provider (that would
// force every Google sign-in, even people who never touch Classroom, to
// consent to reading their Classroom/Drive data).
const CLASSROOM_SCOPES = [
  "https://www.googleapis.com/auth/classroom.courses.readonly",
  "https://www.googleapis.com/auth/classroom.coursework.me.readonly",
  // courseWorkMaterials is a distinct resource from courseWork (a plain
  // resource a teacher posts vs. a gradeable assignment) with its own
  // scope — without this, courseWorkMaterials.list 403s even though
  // courseWork.list succeeds on the scope above, which is exactly what
  // was failing "load files" for every course.
  "https://www.googleapis.com/auth/classroom.courseworkmaterials.readonly",
];

function redirectUri(baseUrl: string) {
  return `${baseUrl}/api/classroom/callback`;
}

// state carries the pursuitId (to redirect back to the right Files tab)
// plus the userId, both signed implicitly by being read back from the
// same server that issued them — Google returns state verbatim, it
// doesn't need to be a JWT for a single-server round trip like this.
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
    // Refresh token rejected (revoked at myaccount.google.com/permissions,
    // or invalidated by re-consenting after a scope change) — drop the
    // dead connection so callers see "not connected" and can prompt to
    // reconnect, instead of this throwing all the way up to a page crash.
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

// Materials live on two different endpoints depending on whether a
// teacher posted them as an assignment (courseWork) or a plain resource
// (courseWorkMaterials) — a PDF of lecture slides is usually the latter,
// but fetching both covers either case a teacher might use.
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
  // Classroom names the list-response field after the singular resource
  // type, not the plural endpoint path: courseWorkMaterials.list returns
  // { courseWorkMaterial: [...] } — no trailing "s" — while courseWork's
  // own field is already an unpluralized mass noun, so it does match its
  // path. Using `kind` as the key here silently returned [] for every
  // courseWorkMaterials item that ever existed, since day one.
  const responseKey = kind === "courseWorkMaterials" ? "courseWorkMaterial" : "courseWork";
  return data[responseKey] ?? [];
}

// Any Drive-backed attachment (PDF, PowerPoint, Word doc, spreadsheet...)
// or plain link a teacher attached — not just PDFs, since teachers post
// slides and worksheets in whatever format just as often as a PDF. Only
// YouTube videos and Forms are skipped, since those aren't "a file" to
// import as an Attachment pointing at a URL.
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

export type ClassroomDeadline = { id: string; title: string; dueAt: Date; url: string };

type CourseWorkRaw = {
  id: string;
  title?: string;
  alternateLink?: string;
  dueDate?: { year: number; month: number; day: number };
  dueTime?: { hours?: number; minutes?: number };
};

// Only courseWork (assignments) carries a due date — courseWorkMaterials
// never does — so this hits just that one endpoint, filtered to published
// work a student would actually see. dueDate/dueTime have no timezone of
// their own; treating them as server-local time can be off by a few hours
// from the student's actual local time, which is fine for a "this is
// roughly when it's due" widget but not for anything more precise.
export async function listCourseDeadlines(
  accessToken: string,
  courseId: string,
): Promise<ClassroomDeadline[]> {
  const res = await fetch(
    `https://classroom.googleapis.com/v1/courses/${courseId}/courseWork?pageSize=100&courseWorkStates=PUBLISHED`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) throw new Error(`Classroom courseWork.list failed: ${await res.text()}`);
  const data = await res.json();
  const items: CourseWorkRaw[] = data.courseWork ?? [];

  const deadlines: ClassroomDeadline[] = [];
  for (const item of items) {
    if (!item.dueDate || !item.title || !item.alternateLink) continue;
    const { year, month, day } = item.dueDate;
    const hours = item.dueTime?.hours ?? 23;
    const minutes = item.dueTime?.minutes ?? 59;
    deadlines.push({
      id: item.id,
      title: item.title,
      dueAt: new Date(year, month - 1, day, hours, minutes),
      url: item.alternateLink,
    });
  }
  deadlines.sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
  return deadlines;
}
