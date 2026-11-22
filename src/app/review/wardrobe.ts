"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { COSTUMES, parseAvatar, type Avatar } from "@/lib/avatar";

// Repasar's rewards: each finished test gives up to 5 ✦ (by how many were
// right first time); ✦ buy avatar costumes (lib/avatar.ts COSTUMES).

export type Wardrobe = { stars: number; owned: string[]; avatar: Avatar | null };

async function userId() {
  const session = await auth();
  return session?.user?.id ?? null;
}

export async function getWardrobe(): Promise<Wardrobe | null> {
  const id = await userId();
  if (!id) return null;
  const u = await prisma.user.findUnique({ where: { id }, select: { stars: true, costumes: true, avatar: true } });
  if (!u) return null;
  return { stars: u.stars, owned: u.costumes, avatar: u.avatar ? parseAvatar(u.avatar) : null };
}

// A test just ended: correct-first-time out of total → 0-5 ✦. Rounds of
// fewer than 4 questions give nothing (no farming tiny rounds).
export async function earnStars(correct: number, total: number): Promise<number | null> {
  const id = await userId();
  if (!id) return null;
  const n = Math.floor(total);
  if (!(n >= 4)) return null;
  const got = Math.max(0, Math.min(5, Math.round((5 * Math.max(0, Math.min(correct, n))) / n)));
  const u = await prisma.user.update({ where: { id }, data: { stars: { increment: got } }, select: { stars: true } });
  return u.stars;
}

export async function buyCostume(costume: string): Promise<{ error: string | null; wardrobe?: Wardrobe }> {
  const id = await userId();
  const item = COSTUMES.find((c) => c.id === costume);
  if (!id || !item) return { error: "No disponible" };
  // Only if there are enough ✦ and it isn't owned yet, in one step.
  const done = await prisma.user.updateMany({
    where: { id, stars: { gte: item.price }, NOT: { costumes: { has: costume } } },
    data: { stars: { decrement: item.price }, costumes: { push: costume } },
  });
  if (done.count === 0) return { error: "Te faltan ✦" };
  return wear(id, costume);
}

export async function wearCostume(costume: string): Promise<{ error: string | null; wardrobe?: Wardrobe }> {
  const id = await userId();
  if (!id) return { error: "No has iniciado sesión" };
  const u = await prisma.user.findUnique({ where: { id }, select: { costumes: true } });
  if (costume && !u?.costumes.includes(costume)) return { error: "Aún no lo tienes" };
  return wear(id, costume);
}

async function wear(id: string, costume: string): Promise<{ error: string | null; wardrobe?: Wardrobe }> {
  const u = await prisma.user.findUnique({ where: { id }, select: { avatar: true } });
  const avatar = { ...parseAvatar(u?.avatar ?? {}), costume };
  await prisma.user.update({ where: { id }, data: { avatar } });
  revalidatePath("/", "layout");
  return { error: null, wardrobe: (await getWardrobe()) ?? undefined };
}
