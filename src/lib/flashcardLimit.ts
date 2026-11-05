import { prisma } from "@/lib/prisma";

// Matches the landing page's "10 flashcards/mo" line on the Free plan —
// Pro and Team both get unlimited generation.
export const FREE_MONTHLY_FLASHCARD_LIMIT = 10;

function startOfUtcMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

// Counted from the table directly; stays right if cards get deleted.
export async function getFlashcardsThisMonth(userId: string): Promise<number> {
  return prisma.flashcard.count({
    where: {
      pursuit: { ownerId: userId },
      createdAt: { gte: startOfUtcMonth(new Date()) },
    },
  });
}
