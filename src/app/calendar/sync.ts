import { getT } from "@/lib/i18n/server";
import "server-only";
import { prisma } from "@/lib/prisma";
import { addDays, dayKey, googleIdFor, timeOf } from "@/lib/calendar";
import { calendarToken, deleteEvent, putEvent } from "@/lib/googleCalendar";

const KIND_LABEL: Record<string, string> = { exam: "◆ Examen", task: "☐ Tarea", event: "" };

// Copies exams, tasks, events and deliverables (from a week ago to four
// months ahead) into Google Calendar, plus a 20-minute review block the
// evening before each exam when that's on. Idempotent: fixed event ids.
export async function syncToGoogle(userId: string): Promise<boolean> {
  const t = await getT();
  const c = await prisma.googleCalendarConnection.findUnique({ where: { userId } });
  if (!c?.push) return false;
  const token = await calendarToken(userId);
  if (!token) return false;
  const from = new Date(Date.now() - 7 * 86400000);
  const to = new Date(Date.now() + 120 * 86400000);
  const [events, projects] = await Promise.all([
    prisma.calendarEvent.findMany({ where: { userId, date: { gte: from, lte: to } }, include: { pursuit: { select: { title: true } }, unit: { select: { name: true } } } }),
    prisma.project.findMany({
      where: { dueDate: { gte: from, lte: to }, pursuit: { OR: [{ ownerId: userId }, { members: { some: { userId } } }] } },
      select: { id: true, title: true, dueDate: true, pursuit: { select: { title: true } } },
    }),
  ]);
  const jobs: Promise<unknown>[] = [];
  for (const e of events) {
    const where = [e.pursuit?.title, e.unit?.name].filter(Boolean).join(" · ");
    const title = [KIND_LABEL[e.kind], e.title, where && `· ${where}`].filter(Boolean).join(" ");
    jobs.push(putEvent(token, { id: googleIdFor("e", e.id), title, day: dayKey(e.date), time: e.allDay ? null : { start: timeOf(e.date), minutes: 60 } }));
    const block = googleIdFor("r", e.id);
    if (e.kind === "exam" && c.reviewBlocks) {
      jobs.push(putEvent(token, { id: block, title: `Repaso: ${e.title}`, day: addDays(dayKey(e.date), -1), time: { start: "18:00", minutes: 20 }, description: t("Synaptic · repaso antes del examen") }));
    } else if (e.kind === "exam") jobs.push(deleteEvent(token, block));
  }
  for (const p of projects) {
    jobs.push(putEvent(token, { id: googleIdFor("p", p.id), title: t("● Entrega: {0} · {1}", { 0: p.title, 1: p.pursuit.title }), day: dayKey(p.dueDate!) }));
  }
  await Promise.allSettled(jobs);
  return true;
}

// Removes our copies of one event (when it's deleted here).
export async function unsyncEvent(userId: string, eventId: string): Promise<void> {
  const c = await prisma.googleCalendarConnection.findUnique({ where: { userId } });
  if (!c?.push) return;
  const token = await calendarToken(userId);
  if (!token) return;
  await Promise.allSettled([deleteEvent(token, googleIdFor("e", eventId)), deleteEvent(token, googleIdFor("r", eventId))]);
}
