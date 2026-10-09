import { randomBytes, createHash } from "crypto";
import { prisma } from "@/lib/prisma";

// Shown once, at creation, never again — same as GitHub/Stripe's own API
// keys. Only the SHA-256 hash lives in the database (ApiKey.keyHash), so
// a leaked database dump doesn't hand out usable keys. The prefix (first
// 10 chars after "syn_") is kept in the clear alongside the hash purely
// so the settings UI can show "syn_a1b2c3d4…" in the list without ever
// needing the real key again.
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

// Resolves a raw bearer token (as handed to the MCP endpoint by a
// connecting client) to the user it belongs to — or null if it's missing,
// malformed, or revoked. Bumps lastUsedAt on every successful call so the
// settings page can show "last used" without needing separate telemetry.
export async function resolveApiKey(raw: string | null): Promise<{ userId: string } | null> {
  if (!raw || !raw.startsWith(PREFIX)) return null;

  const hash = hashApiKey(raw);
  const key = await prisma.apiKey.findUnique({ where: { keyHash: hash } });
  if (!key) return null;

  // Best-effort — a dropped update here shouldn't fail the actual request.
  prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } }).catch(() => {});

  return { userId: key.userId };
}
