import "server-only";
import { prisma } from "@/lib/prisma";
import { folderColor } from "@/lib/covers";
import { dotState } from "@/lib/knowledgeMap";
import { addDays, dayKey, fromKey, timeOf, type CalItem } from "@/lib/calendar";
import { calendarToken, listCalendars, listEvents } from "@/lib/googleCalendar";

const NEUTRAL = "#9b9a97";
export const GOOGLE_BLUE = "#4285f4";

const visible = (userId: string) => ({ OR: [{ ownerId: userId }, { members: { some: { userId } } }] });

// Everything with a date between two days (inclusive): your events,
// deliverables (Project.dueDate) and, if connected, Google events.
export async function calendarItems(userId: string, from: string, to: string): Promise<{ items: CalItem[]; google: "off" | "on" | "error" }> {
  const start = fromKey(addDays(from, -1));
  const end = fromKey(addDays(to, 1));
  const [events, projects, connection] = await Promise.all([
    prisma.calendarEvent.findMany({
      where: { userId, date: { gte: start, lte: end } },
      include: {
        pursuit: { select: { id: true, title: true, cover: true } },
        unit: { select: { id: true, name: true, maps: { select: { concepts: { select: { status: true, statusAt: true } } } } } },
      },
    }),
    prisma.project.findMany({
      where: { dueDate: { gte: start, lte: end }, pursuit: visible(userId) },
      select: { id: true, title: true, dueDate: true, pursuit: { select: { id: true, title: true, cover: true } } },
    }),
    prisma.googleCalendarConnection.findUnique({ where: { userId } }),
  ]);

  const items: CalItem[] = [];
  for (const e of events) {
    items.push({
      id: e.id,
      title: e.title,
      kind: (["exam", "task", "event"].includes(e.kind) ? e.kind : "event") as CalItem["kind"],
      day: dayKey(e.date),
      time: e.allDay ? null : timeOf(e.date),
      color: e.pursuit ? folderColor(e.pursuit.id, e.pursuit.cover) : NEUTRAL,
      folderId: e.pursuit?.id ?? null,
      folder: e.pursuit?.title ?? null,
      unitId: e.unit?.id ?? null,
      unit: e.unit?.name ?? null,
      href: e.pursuit ? `/pursuits/${e.pursuit.id}` : null,
      done: e.done,
      dots: e.kind === "exam" && e.unit ? e.unit.maps.flatMap((m) => m.concepts).map((c) => dotState(c)) : undefined,
      editable: true,
    });
  }
  for (const p of projects) {
    items.push({
      id: `p-${p.id}`,
      title: p.title,
      kind: "due",
      day: dayKey(p.dueDate!),
      time: null,
      color: folderColor(p.pursuit.id, p.pursuit.cover),
      folderId: p.pursuit.id,
      folder: p.pursuit.title,
      unitId: null,
      unit: null,
      href: `/pursuits/${p.pursuit.id}/projects/${p.id}`,
      done: false,
      editable: false,
    });
  }

  let google: "off" | "on" | "error" = "off";
  if (connection?.pull) {
    const token = await calendarToken(userId);
    if (!token) google = "error";
    else {
      google = "on";
      const all = await listCalendars(token);
      const chosen = connection.calendarIds.length ? all.filter((c) => connection.calendarIds.includes(c.id)) : all.filter((c) => c.selected);
      const list = await listEvents(token, chosen.length ? chosen : [{ id: "primary", name: "Google", color: GOOGLE_BLUE }], from, to).catch(() => []);
      for (const g of list) {
        items.push({
          id: `g-${g.id}`,
          title: g.title,
          kind: "google",
          day: g.allDay && g.dayKey ? g.dayKey : dayKey(g.start),
          time: g.allDay ? null : timeOf(g.start),
          color: g.calendarColor,
          folderId: null,
          folder: null,
          unitId: null,
          unit: null,
          href: null,
          done: false,
          editable: false,
          calendarId: g.calendarId,
          calendarName: g.calendarName,
        });
      }
    }
  }
  return { items: items.filter((i) => i.day >= from && i.day <= to), google };
}
