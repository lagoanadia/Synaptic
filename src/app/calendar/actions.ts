"use server";

import { getT } from "@/lib/i18n/server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { fromKey, zonedDate } from "@/lib/calendar";
import { calendarToken, listCalendars, type GoogleCalendar } from "@/lib/googleCalendar";
import { syncToGoogle, unsyncEvent } from "./sync";

async function me() {
  const t = await getT();
  const session = await auth();
  if (!session?.user?.id) throw new Error(t("No autorizado"));
  return session.user.id;
}

const done = () => {
  revalidatePath("/calendar");
  revalidatePath("/pursuits");
};

export type NewEvent = { title: string; kind: "exam" | "task" | "event"; day: string; time?: string; pursuitId?: string | null; unitId?: string | null };

export async function addEvent(input: NewEvent): Promise<{ error: string | null }> {
  const t = await getT();
  const userId = await me();
  const title = input.title.trim().slice(0, 120);
  if (!title) return { error: t("Ponle un nombre") };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.day)) return { error: t("Fecha no válida") };
  const time = input.time && /^\d{2}:\d{2}$/.test(input.time) ? input.time : null;
  // Only folders you can open, and only units of that folder.
  const pursuit = input.pursuitId
    ? await prisma.pursuit.findFirst({ where: { id: input.pursuitId, OR: [{ ownerId: userId }, { members: { some: { userId } } }] }, select: { id: true } })
    : null;
  const unit = pursuit && input.unitId ? await prisma.pursuitContentSection.findFirst({ where: { id: input.unitId, pursuitId: pursuit.id }, select: { id: true } }) : null;
  await prisma.calendarEvent.create({
    data: {
      userId,
      title,
      kind: ["exam", "task", "event"].includes(input.kind) ? input.kind : "event",
      date: time ? zonedDate(input.day, time) : fromKey(input.day),
      allDay: !time,
      pursuitId: pursuit?.id ?? null,
      unitId: unit?.id ?? null,
    },
  });
  await syncToGoogle(userId).catch(() => {});
  done();
  return { error: null };
}

export async function toggleEventDone(id: string): Promise<void> {
  const userId = await me();
  const e = await prisma.calendarEvent.findFirst({ where: { id, userId }, select: { done: true } });
  if (!e) return;
  await prisma.calendarEvent.update({ where: { id }, data: { done: !e.done } });
  done();
}

export async function removeEvent(id: string): Promise<void> {
  const userId = await me();
  const { count } = await prisma.calendarEvent.deleteMany({ where: { id, userId } });
  if (count) await unsyncEvent(userId, id).catch(() => {});
  done();
}

// ─── Google Calendar ───

export type GoogleSettings = { pull: boolean; push: boolean; reviewBlocks: boolean; calendarIds: string[] };

export async function googleState(): Promise<{ connected: boolean; settings: GoogleSettings | null; calendars: GoogleCalendar[] }> {
  const userId = await me();
  const c = await prisma.googleCalendarConnection.findUnique({ where: { userId } });
  if (!c) return { connected: false, settings: null, calendars: [] };
  const token = await calendarToken(userId);
  if (!token) return { connected: false, settings: null, calendars: [] };
  return { connected: true, settings: { pull: c.pull, push: c.push, reviewBlocks: c.reviewBlocks, calendarIds: c.calendarIds }, calendars: await listCalendars(token) };
}

export async function saveGoogleSettings(s: GoogleSettings): Promise<void> {
  const userId = await me();
  await prisma.googleCalendarConnection.updateMany({
    where: { userId },
    data: { pull: s.pull, push: s.push, reviewBlocks: s.reviewBlocks, calendarIds: s.calendarIds.slice(0, 20) },
  });
  if (s.push) await syncToGoogle(userId).catch(() => {});
  done();
}

export async function syncGoogleNow(): Promise<{ ok: boolean }> {
  const userId = await me();
  const ok = await syncToGoogle(userId).catch(() => false);
  done();
  return { ok };
}

export async function disconnectGoogle(): Promise<void> {
  const userId = await me();
  await prisma.googleCalendarConnection.deleteMany({ where: { userId } });
  done();
}
