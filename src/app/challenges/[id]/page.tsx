import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { ChallengeTest, Language } from "@/lib/challenge";
import { ChallengeIDE } from "./ChallengeIDE";

export default async function ChallengePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  const c = await prisma.challenge.findFirst({
    where: { id, userId: session.user.id },
    include: { pursuit: { select: { title: true } } },
  });
  if (!c) notFound();
  return (
    <ChallengeIDE
      challenge={{
        id: c.id,
        title: c.title,
        prompt: c.prompt,
        language: c.language as Language,
        entry: c.entry,
        starterCode: c.starterCode,
        tests: c.tests as ChallengeTest[],
        difficulty: c.difficulty,
        code: c.code,
        passed: c.passed,
        review: c.review,
        pursuitTitle: c.pursuit?.title ?? null,
      }}
    />
  );
}
