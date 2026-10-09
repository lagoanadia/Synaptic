"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { generateApiKey } from "@/lib/apiKeys";

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Not signed in");
  }
  return session.user.id;
}

// Returns the raw key exactly once — the caller (the client component)
// holds it in memory just long enough to show it, then it's gone for
// good; only the hash this writes to the database survives.
export async function createApiKey(name: string): Promise<{ rawKey: string; prefix: string }> {
  const userId = await requireUser();
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("Name can't be empty");
  }

  const { raw, hash, prefix } = generateApiKey();
  await prisma.apiKey.create({
    data: { userId, name: trimmed, keyHash: hash, prefix },
  });

  revalidatePath("/settings/api-keys");
  return { rawKey: raw, prefix };
}

export async function revokeApiKey(keyId: string) {
  const userId = await requireUser();
  await prisma.apiKey.deleteMany({ where: { id: keyId, userId } });
  revalidatePath("/settings/api-keys");
}
