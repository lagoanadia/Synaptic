import { prisma } from "@/lib/prisma";

// Owner-or-member check for MCP calls, which authenticate with an API key
// instead of a session.
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
