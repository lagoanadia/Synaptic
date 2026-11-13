import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { exchangeCodeForTokens } from "@/lib/googleClassroom";

// Google's redirect after the Classroom consent; `state` is the pursuitId.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const pursuitId = url.searchParams.get("state");
  // "onboarding": connected from the welcome flow, which picks up at step 2;
  // "profile": from Settings.
  const backToFiles =
    pursuitId === "onboarding"
      ? new URL("/pursuits?welcome=classroom", url.origin)
      : pursuitId === "profile"
        ? new URL("/profile?tab=settings", url.origin)
        : pursuitId
        ? new URL(`/pursuits/${pursuitId}?tab=pages`, url.origin)
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
