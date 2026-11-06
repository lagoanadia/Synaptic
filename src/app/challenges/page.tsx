import { asLanguage } from "@/lib/challenge";
import { ArrowLeft } from "@/app/icons";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Logo } from "../Logo";
import { accessiblePursuits } from "@/lib/reviewData";
import { NewChallenge } from "./NewChallenge";
import { ChallengeList } from "./ChallengeList";

export default async function ChallengesPage({ searchParams }: { searchParams: Promise<{ pursuit?: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  const { pursuit } = await searchParams;
  const [challenges, subjects] = await Promise.all([
    prisma.challenge.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 300,
      select: { id: true, title: true, language: true, difficulty: true, passed: true, code: true, pursuit: { select: { title: true } } },
    }),
    prisma.pursuit.findMany({
      where: accessiblePursuits(session.user.id),
      orderBy: { lastTouchedAt: "desc" },
      select: { id: true, title: true },
    }),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-[1800px] flex-1 flex-col gap-8 px-6 py-10 lg:px-14">
      <header className="flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <Logo href="/pursuits" />
          <span className="text-ink-faint">·</span>
          <h1 className="text-2xl font-extrabold text-mint italic">Retos</h1>
        </div>
        <Link href="/pursuits" className="text-sm text-ink-muted hover:underline"><ArrowLeft /> Inicio</Link>
      </header>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_400px]">
        <section aria-label="Tus retos">
          <ChallengeList
            items={challenges.map((c) => ({
              id: c.id,
              title: c.title,
              language: asLanguage(c.language),
              difficulty: c.difficulty,
              passed: c.passed,
              started: !!c.code && !c.passed,
              subject: c.pursuit?.title ?? null,
            }))}
          />
        </section>
        <NewChallenge subjects={subjects} defaultSubject={pursuit ?? null} />
      </div>
    </div>
  );
}
