import { prisma } from "@/lib/prisma";

// A plain constant, not an env var or external service — this is a
// personal-cost guardrail (Groq's free tier), not a security boundary,
// so there's no need for anything fancier than a number in code.
export const DAILY_ORGANIZE_LIMIT = 15;

// Truncates to UTC midnight so "today" means the same instant for every
// user regardless of their own timezone, and matches how dates are
// already pinned to UTC elsewhere in this app (see the DumpControls /
// MergeControls date-formatting fix) — using the server's local time
// instead would make the day boundary silently shift with wherever the
// server happens to be deployed.
function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

// Read-only — call this BEFORE spending a Groq request, so a user who's
// already at the limit doesn't cost anything on Groq's side.
export async function getOrganizeUsageToday(userId: string): Promise<number> {
  const usage = await prisma.organizeUsage.findUnique({
    where: { userId_date: { userId, date: startOfUtcDay(new Date()) } },
  });
  return usage?.count ?? 0;
}

// Call this AFTER Groq successfully responds — if Groq itself fails
// (down, its own quota, network), incrementing here is skipped, so a
// failed attempt doesn't burn the user's daily quota for nothing.
//
// Note: reading the count (above) and incrementing it (here) are two
// separate queries, not one atomic operation — two Organize clicks
// arriving at the exact same instant could both pass the check before
// either increment lands, letting the count go one or two over the
// limit. That's an accepted tradeoff for a soft personal-usage cap, not
// something worth an atomic UPSERT ... RETURNING for.
export async function incrementOrganizeUsage(userId: string): Promise<void> {
  const date = startOfUtcDay(new Date());
  await prisma.organizeUsage.upsert({
    where: { userId_date: { userId, date } },
    create: { userId, date, count: 1 },
    update: { count: { increment: 1 } },
  });
}
