import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { exchangeCodeForTokens } from "@/lib/googleClassroom";

// GET /api/classroom/callback — where Google sends the user back after
// they approve (or deny) Classroom access. `state` is the pursuitId we
// stashed in connect/route.ts, so this always lands back on the same
// pursuit's Files tab, whether it succeeded or not.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const pursuitId = url.searchParams.get("state");
  const backToFiles = pursuitId
    ? new URL(`/pursuits/${pursuitId}?tab=files`, url.origin)
    : new URL("/pursuits", url.origin);

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/", url.origin));
  }

  const code = url.searchParams.get("code");
  if (!code) {
    backToFiles.searchParams.set("classroomError", "denied");
    return NextResponse.redirect(backToFiles);
  }

  let tokens;
  try {
    tokens = await exchangeCodeForTokens(url.origin, code);
  } catch {
    backToFiles.searchParams.set("classroomError", "connect-failed");
    return NextResponse.redirect(backToFiles);
  }

  if (!tokens.refresh_token) {
    // Only happens if the user had already granted consent before without
    // us storing it (e.g. a previous connection got deleted) — `prompt:
    // consent` in buildAuthUrl is what normally prevents this.
    backToFiles.searchParams.set("classroomError", "no-refresh-token");
    return NextResponse.redirect(backToFiles);
  }

  await prisma.googleClassroomConnection.upsert({
    where: { userId: session.user.id },
    create: {
      userId: session.user.id,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    },
    update: {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    },
  });

  backToFiles.searchParams.set("classroomConnected", "1");
  return NextResponse.redirect(backToFiles);
}
