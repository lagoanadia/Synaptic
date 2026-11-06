import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { exchangeCalendarCode } from "@/lib/googleCalendar";
import { syncToGoogle } from "@/app/calendar/sync";

// Google's redirect after the Calendar consent; `state` = pull/push/blocks.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const back = new URL("/calendar", url.origin);
  const session = await auth();
  if (!session?.user?.id) return NextResponse.redirect(new URL("/", url.origin));
  const userId = session.user.id;

  const code = url.searchParams.get("code");
  if (!code) {
    back.searchParams.set("google", "denied");
    return NextResponse.redirect(back);
  }
  let tokens;
  try {
    tokens = await exchangeCalendarCode(url.origin, code);
  } catch {
    back.searchParams.set("google", "failed");
    return NextResponse.redirect(back);
  }
  if (!tokens.refresh_token) {
    back.searchParams.set("google", "failed");
    return NextResponse.redirect(back);
  }

  const [pull, push, blocks] = (url.searchParams.get("state") ?? "110").split("").map((c) => c === "1");
  const data = {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    pull: pull ?? true,
    push: push ?? true,
    reviewBlocks: blocks ?? false,
  };
  await prisma.googleCalendarConnection.upsert({ where: { userId }, create: { userId, ...data }, update: data });
  if (data.push) await syncToGoogle(userId).catch(() => {});
  back.searchParams.set("google", "connected");
  return NextResponse.redirect(back);
}
