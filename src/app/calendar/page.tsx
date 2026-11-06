import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { folderColor } from "@/lib/covers";
import { calendarItems } from "@/lib/calendarData";
import { MONTHS, addDays, dayKey, monthGrid, monthKey, parseMonth, shiftMonth, weekOf } from "@/lib/calendar";
import { CalendarView } from "./CalendarView";

// Month (or week) of exams, deliverables, tasks and Google events.
export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ m?: string; v?: string; d?: string; google?: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  const userId = session.user.id;
  const params = await searchParams;
  const today = dayKey(new Date());
  const view = params.v === "week" ? "week" : "month";
  const { year, month } = parseMonth(params.m, today);
  const focus = params.d && /^\d{4}-\d{2}-\d{2}$/.test(params.d) ? params.d : month === Number(today.slice(5, 7)) && year === Number(today.slice(0, 4)) ? today : `${monthKey(year, month)}-01`;

  const rows = view === "week" ? [weekOf(focus)] : monthGrid(year, month);
  const from = rows[0][0];
  const to = rows.at(-1)!.at(-1)!;

  const [{ items, google }, pursuits] = await Promise.all([
    calendarItems(userId, from, to),
    prisma.pursuit.findMany({
      where: { OR: [{ ownerId: userId }, { members: { some: { userId } } }], status: { not: "DONE" } },
      orderBy: { lastTouchedAt: "desc" },
      select: { id: true, title: true, cover: true, contentSections: { orderBy: { order: "asc" }, select: { id: true, name: true } } },
    }),
  ]);

  const prevWeek = weekOf(focus)[0];
  const nav =
    view === "week"
      ? { prev: `?v=week&d=${addDays(prevWeek, -7)}`, next: `?v=week&d=${addDays(prevWeek, 7)}`, today: `?v=week&d=${today}` }
      : { prev: `?m=${shiftMonth(year, month, -1)}`, next: `?m=${shiftMonth(year, month, 1)}`, today: "?" };

  return (
    <CalendarView
      title={MONTHS[(view === "week" ? Number(focus.slice(5, 7)) : month) - 1]}
      view={view}
      nav={nav}
      switchTo={view === "week" ? `?m=${focus.slice(0, 7)}` : `?v=week&d=${focus}`}
      rows={rows}
      month={monthKey(year, month)}
      today={today}
      items={items}
      google={google}
      justConnected={params.google ?? null}
      folders={pursuits.map((p) => ({ id: p.id, title: p.title, color: folderColor(p.id, p.cover), units: p.contentSections }))}
    />
  );
}

