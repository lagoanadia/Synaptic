import { prisma } from "@/lib/prisma";

// Same owner-or-member check every Server Action in pursuits/[id]/actions.ts
// uses (see requireAccess there) — but parametrized by an already-resolved
// userId instead of pulling one out of a NextAuth session cookie, since an
// MCP call authenticates with a bearer token (see src/lib/apiKeys.ts)
// instead of a browser session.
export async function requireApiAccess(userId: string, pursuitId: string) {
  const pursuit = await prisma.pursuit.findFirst({
    where: {
      id: pursuitId,
      OR: [{ ownerId: userId }, { members: { some: { userId } } }],
    },
  });
  if (!pursuit) {
    throw new Error("Pursuit not found or access denied");
  }
  return pursuit;
}
