"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { HANDLE, parseAvatar } from "@/lib/avatar";

async function me() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No has iniciado sesión");
  return session.user.id;
}

export async function saveAvatar(raw: unknown) {
  const id = await me();
  await prisma.user.update({ where: { id }, data: { avatar: parseAvatar(raw) } });
  revalidatePath("/", "layout");
}

// "@Nadia_L" → "nadia_l"; taken or badly formed → an error to show.
export async function setUsername(raw: string): Promise<{ error: string | null; username?: string }> {
  const id = await me();
  const username = raw.trim().replace(/^@/, "").toLowerCase();
  if (!HANDLE.test(username)) return { error: "De 3 a 20: letras, números, punto o _" };
  const taken = await prisma.user.findFirst({ where: { username, NOT: { id } }, select: { id: true } });
  if (taken) return { error: "Ese ya está cogido" };
  await prisma.user.update({ where: { id }, data: { username } });
  revalidatePath("/profile");
  return { error: null, username };
}
