import { prisma } from "@/lib/prisma";

// Matches the landing page's "10 flashcards/mo" line on the Free plan —
// Pro and Team both get unlimited generation.
export const FREE_MONTHLY_FLASHCARD_LIMIT = 10;

function startOfUtcMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

// Counted straight from the Flashcard table instead of a separate usage
// counter (unlike OrganizeUsage) — flashcards aren't deleted often enough
// for that count to need its own running tally, and this stays correct
// even if some get deleted mid-month.
export async function getFlashcardsThisMonth(userId: string): Promise<number> {
  return prisma.flashcard.count({
    where: {
      pursuit: { ownerId: userId },
      createdAt: { gte: startOfUtcMonth(new Date()) },
    },
  });
}
