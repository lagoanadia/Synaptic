import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { asLanguage } from "@/lib/challenge";
import { accessiblePursuits } from "@/lib/reviewData";
import { NewChallenge } from "./NewChallenge";
import { ChallengeList } from "./ChallengeList";

// Your challenges on the left, "Dame 3" on the right.
export default async function ChallengesPage({ searchParams }: { searchParams: Promise<{ pursuit?: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  const { pursuit } = await searchParams;
  const [challenges, subjects] = await Promise.all([
    prisma.challenge.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 300,
      select: { id: true, title: true, language: true, difficulty: true, skill: true, passed: true, code: true, pursuit: { select: { title: true } } },
    }),
    // Folders in notebooks with study tools (challenges are a study tool).
    prisma.pursuit.findMany({
      where: { AND: [accessiblePursuits(session.user.id), { OR: [{ section: null }, { section: { study: true } }] }] },
      orderBy: { lastTouchedAt: "desc" },
      select: { id: true, title: true },
    }),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-8 px-6 py-10 sm:px-12 lg:py-14">
      <h1 className="text-[2.4rem] leading-tight font-bold tracking-tight">Retos</h1>
      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="max-lg:order-last">
          <ChallengeList
            items={challenges.map((c) => ({
              id: c.id,
              title: c.title,
              language: asLanguage(c.language),
              difficulty: c.difficulty,
              skill: c.skill,
              passed: c.passed,
              subject: c.pursuit?.title ?? null,
            }))}
          />
        </div>
        <NewChallenge subjects={subjects} defaultSubject={pursuit ?? null} />
      </div>
    </div>
  );
}
