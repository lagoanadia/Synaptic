import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { buildCalendarAuthUrl } from "@/lib/googleCalendar";

// GET /api/google-calendar/connect?pull=1&push=1&blocks=0 — the toggles
// chosen before connecting ride along in `state`.
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.redirect(new URL("/", request.url));
  const url = new URL(request.url);
  const flag = (k: string, d: string) => (url.searchParams.get(k) ?? d) === "1" ? "1" : "0";
  const state = `${flag("pull", "1")}${flag("push", "1")}${flag("blocks", "0")}`;
  const auth_ = new URL(buildCalendarAuthUrl(url.origin));
  auth_.searchParams.set("state", state);
  return NextResponse.redirect(auth_);
}
