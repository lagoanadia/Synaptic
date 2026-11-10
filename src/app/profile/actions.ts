"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { HANDLE, cleanHandle, parseAvatar } from "@/lib/avatar";

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

// "@Nadia_L" → "nadia_l"; taken or badly formed → a message to show.
export async function setUsername(raw: string): Promise<{ error: string | null; username?: string }> {
  const id = await me();
  const username = cleanHandle(raw);
  if (!HANDLE.test(username)) return { error: "De 3 a 20: letras, números, punto o _" };
  const taken = await prisma.user.findFirst({ where: { username, NOT: { id } }, select: { id: true } });
  if (taken) return { error: "Ese ya está cogido" };
  await prisma.user.update({ where: { id }, data: { username } });
  revalidatePath("/profile");
  return { error: null, username };
}

// Friends: send a request by @handle. If they already asked you, that
// accepts it instead.
export async function addFriend(raw: string): Promise<{ error: string | null }> {
  const id = await me();
  const username = cleanHandle(raw);
  if (!username) return { error: null };
  const other = await prisma.user.findUnique({ where: { username }, select: { id: true } });
  if (!other) return { error: "No hay nadie con ese @usuario" };
  if (other.id === id) return { error: "Ese eres tú" };
  const theirs = await prisma.friendship.findUnique({ where: { fromId_toId: { fromId: other.id, toId: id } } });
  if (theirs) {
    if (theirs.status === "PENDING") await prisma.friendship.update({ where: { id: theirs.id }, data: { status: "ACCEPTED" } });
  } else {
    await prisma.friendship.upsert({ where: { fromId_toId: { fromId: id, toId: other.id } }, create: { fromId: id, toId: other.id }, update: {} });
  }
  revalidatePath("/profile");
  return { error: null };
}

// Accept a request sent to you.
export async function acceptFriend(friendshipId: string) {
  const id = await me();
  await prisma.friendship.updateMany({ where: { id: friendshipId, toId: id }, data: { status: "ACCEPTED" } });
  revalidatePath("/profile");
}

// Decline a request, cancel yours, or unfriend: either side can remove it.
export async function removeFriend(friendshipId: string) {
  const id = await me();
  await prisma.friendship.deleteMany({ where: { id: friendshipId, OR: [{ fromId: id }, { toId: id }] } });
  revalidatePath("/profile");
}
