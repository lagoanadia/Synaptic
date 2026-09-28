import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { buildAuthUrl } from "@/lib/googleClassroom";

// GET /api/classroom/connect?pursuitId=... — kicks off the Classroom OAuth
// consent, separate from (and in addition to) however the user originally
// signed into Synaptic.
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const pursuitId = new URL(request.url).searchParams.get("pursuitId");
  if (!pursuitId) {
    return NextResponse.json({ error: "Missing pursuitId" }, { status: 400 });
  }

  const baseUrl = new URL(request.url).origin;
  return NextResponse.redirect(buildAuthUrl(baseUrl, pursuitId));
}
