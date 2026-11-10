"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePursuitAccess } from "@/lib/access";

// Gastos, Fechas and Meta de ahorro: rows anyone in the folder can add.
const done = (pursuitId: string) => revalidatePath(`/pursuits/${pursuitId}`);
const cents = (n: number) => (Number.isFinite(n) && n > 0 && n < 1e9 ? Math.round(n) : null);
const isDay = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d);

// "Cena · 60 € · pagó Ana": paidById must be someone in the folder.
export async function addExpense(pursuitId: string, blockId: string, label: string, amount: number, paidById: string) {
  const { pursuit } = await requirePursuitAccess(pursuitId);
  const ok = paidById === pursuit.ownerId || (await prisma.pursuitMember.count({ where: { pursuitId, userId: paidById } })) > 0;
  const value = cents(amount);
  const clean = label.trim().slice(0, 60);
  if (!ok || !value || !clean) return;
  await prisma.expense.create({ data: { pursuitId, blockId: blockId.slice(0, 20), label: clean, amount: value, paidById } });
  done(pursuitId);
}

export async function deleteExpense(id: string) {
  const e = await prisma.expense.findUnique({ where: { id }, select: { pursuitId: true } });
  if (!e) return;
  await requirePursuitAccess(e.pursuitId);
  await prisma.expense.delete({ where: { id } });
  done(e.pursuitId);
}

export async function addDateOption(pursuitId: string, blockId: string, day: string) {
  await requirePursuitAccess(pursuitId);
  if (!isDay(day)) return;
  const exists = await prisma.dateOption.findFirst({ where: { pursuitId, blockId, day }, select: { id: true } });
  if (!exists) await prisma.dateOption.create({ data: { pursuitId, blockId: blockId.slice(0, 20), day } });
  done(pursuitId);
}

export async function deleteDateOption(id: string) {
  const o = await prisma.dateOption.findUnique({ where: { id }, select: { pursuitId: true } });
  if (!o) return;
  await requirePursuitAccess(o.pursuitId);
  await prisma.dateOption.delete({ where: { id } });
  done(o.pursuitId);
}

// "Puedo" on or off for me.
export async function toggleDate(id: string) {
  const o = await prisma.dateOption.findUnique({ where: { id }, select: { pursuitId: true } });
  if (!o) return;
  const { userId } = await requirePursuitAccess(o.pursuitId);
  const key = { dateOptionId_userId: { dateOptionId: id, userId } };
  if (await prisma.dateVote.findUnique({ where: key })) await prisma.dateVote.delete({ where: key });
  else await prisma.dateVote.create({ data: { dateOptionId: id, userId } });
  done(o.pursuitId);
}

export async function addSaving(pursuitId: string, blockId: string, amount: number) {
  const { userId } = await requirePursuitAccess(pursuitId);
  const value = cents(amount);
  if (!value) return;
  await prisma.saving.create({ data: { pursuitId, blockId: blockId.slice(0, 20), amount: value, userId } });
  done(pursuitId);
}

export async function deleteSaving(id: string) {
  const s = await prisma.saving.findUnique({ where: { id }, select: { pursuitId: true } });
  if (!s) return;
  await requirePursuitAccess(s.pursuitId);
  await prisma.saving.delete({ where: { id } });
  done(s.pursuitId);
}

export async function setSavingsGoal(pursuitId: string, blockId: string, goal: number | null) {
  const { pursuit } = await requirePursuitAccess(pursuitId);
  const saved = Array.isArray(pursuit.blocks) ? (pursuit.blocks as { id: string }[]) : [];
  const value = goal === null ? null : cents(goal);
  await prisma.pursuit.update({ where: { id: pursuitId }, data: { blocks: saved.map((b) => (b.id === blockId ? { ...b, goal: value } : b)) } });
  done(pursuitId);
}
