import { prisma } from "@/lib/prisma";

// A plain constant, not an env var or external service — this is a
// personal-cost guardrail (Groq's free tier), not a security boundary,
// so there's no need for anything fancier than a number in code.
export const DAILY_ORGANIZE_LIMIT = 15;

// Accounts exempt from the daily limit (the app's owner/tester), via env var.
const UNLIMITED_EMAILS = new Set(
  (process.env.ORGANIZE_UNLIMITED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
);

function hasUnlimitedOrganize(email: string | null | undefined): boolean {
  return !!email && UNLIMITED_EMAILS.has(email.toLowerCase());
}

// Paid plans and allowlisted emails have no daily AI limit.
export async function hasUnlimitedAccess(
  userId: string,
  email: string | null | undefined,
): Promise<boolean> {
  if (hasUnlimitedOrganize(email)) return true;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { plan: true } });
  return user?.plan !== "FREE";
}

// UTC day, so "today" doesn't depend on where the server runs.
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

// Only after the AI answered, so failures don't cost a use. Check and
// increment aren't atomic; a double click can go one over. Fine for a soft cap.
export async function incrementOrganizeUsage(userId: string): Promise<void> {
  const date = startOfUtcDay(new Date());
  await prisma.organizeUsage.upsert({
    where: { userId_date: { userId, date } },
    create: { userId, date, count: 1 },
    update: { count: { increment: 1 } },
  });
}
