import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { asLanguage, type ChallengeTest } from "@/lib/challenge";
import { ChallengeIDE } from "./ChallengeIDE";
import { ensureSpanish } from "@/lib/challengeSpanish";

export default async function ChallengePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  const c = await prisma.challenge.findFirst({
    where: { id, userId: session.user.id },
    include: { pursuit: { select: { title: true } } },
  });
  if (!c) notFound();
  // Everything in Spanish: older English challenges are translated once.
  const es = await ensureSpanish(c).catch(() => c);
  return (
    <ChallengeIDE
      challenge={{
        id: c.id,
        title: es.title,
        prompt: es.prompt,
        language: asLanguage(c.language),
        entry: c.entry,
        starterCode: es.starterCode,
        tests: c.tests as ChallengeTest[],
        difficulty: c.difficulty,
        code: es.code,
        passed: c.passed,
        review: c.review,
        pursuitTitle: c.pursuit?.title ?? null,
        pursuitId: c.pursuitId,
      }}
    />
  );
}
