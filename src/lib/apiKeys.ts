import { randomBytes, createHash } from "crypto";
import { prisma } from "@/lib/prisma";

// Shown once. Only the SHA-256 hash is stored; a short prefix is kept so the
// settings page can tell keys apart.
const PREFIX = "syn_";

export function generateApiKey(): { raw: string; hash: string; prefix: string } {
  const raw = PREFIX + randomBytes(24).toString("hex");
  const hash = hashApiKey(raw);
  const prefix = raw.slice(0, PREFIX.length + 10);
  return { raw, hash, prefix };
}

export function hashApiKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

// Bearer token → user (or null). Updates lastUsedAt.
export async function resolveApiKey(raw: string | null): Promise<{ userId: string } | null> {
  if (!raw || !raw.startsWith(PREFIX)) return null;

  const hash = hashApiKey(raw);
  const key = await prisma.apiKey.findUnique({ where: { keyHash: hash } });
  if (!key) return null;

  // Best-effort — a dropped update here shouldn't fail the actual request.
  prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } }).catch(() => {});

  return { userId: key.userId };
}
