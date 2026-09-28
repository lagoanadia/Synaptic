import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getValidAccessToken, listCourseDeadlines } from "@/lib/googleClassroom";
import { sendPush } from "@/lib/webPush";

// Fires once a day (see vercel.json) — checks every Classroom-linked
// Pursuit for deadlines due in the next 48h and pushes a reminder to
// whoever's subscribed. The 48h window (not 24h) is deliberate slack
// against a daily cron's own timing drift, so a deadline can never fall
// through the gap between two runs; SentDeadlineNotification's unique
// constraint on (userId, courseWorkId) is what actually guarantees each
// deadline is only ever pushed once, regardless of how many runs see it.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pursuits = await prisma.pursuit.findMany({
    where: { classroomCourseId: { not: null }, classroomEnabled: true },
    select: {
      id: true,
      title: true,
      ownerId: true,
      classroomCourseId: true,
      owner: { select: { pushSubscriptions: true } },
    },
  });

  const now = Date.now();
  const windowEnd = now + 48 * 60 * 60 * 1000;
  let sent = 0;
  let staleRemoved = 0;

  for (const pursuit of pursuits) {
    if (pursuit.owner.pushSubscriptions.length === 0 || !pursuit.classroomCourseId) continue;

    const accessToken = await getValidAccessToken(pursuit.ownerId);
    if (!accessToken) continue;

    let deadlines;
    try {
      deadlines = await listCourseDeadlines(accessToken, pursuit.classroomCourseId);
    } catch {
      continue;
    }

    const dueSoon = deadlines.filter(
      (d) => d.dueAt.getTime() > now && d.dueAt.getTime() <= windowEnd,
    );

    for (const deadline of dueSoon) {
      // Claims this (user, courseWork) pair before sending anything — the
      // unique constraint throws if another run already claimed it, which
      // is exactly the signal to skip.
      try {
        await prisma.sentDeadlineNotification.create({
          data: { userId: pursuit.ownerId, courseWorkId: deadline.id },
        });
      } catch {
        continue;
      }

      for (const sub of pursuit.owner.pushSubscriptions) {
        try {
          await sendPush(sub, {
            title: `Due soon: ${pursuit.title}`,
            body: deadline.title,
            url: `/pursuits/${pursuit.id}?tab=files`,
          });
          sent++;
        } catch (e) {
          // 404/410 means the push service says this endpoint is dead
          // (browser unsubscribed, site data cleared) — drop it so future
          // runs don't keep paying for a failed request against it.
          const statusCode = (e as { statusCode?: number })?.statusCode;
          if (statusCode === 404 || statusCode === 410) {
            await prisma.pushSubscription.deleteMany({ where: { endpoint: sub.endpoint } });
            staleRemoved++;
          }
        }
      }
    }
  }

  return NextResponse.json({ ok: true, sent, staleRemoved });
}
