import { asLanguage, LANGUAGE_INFO } from "@/lib/challenge";
import { ArrowLeft, CheckIcon } from "@/app/icons";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Logo } from "../Logo";
import { DeleteButton } from "../pursuits/DeleteButton";
import { accessiblePursuits } from "@/lib/reviewData";
import { NewChallenge } from "./NewChallenge";
import { deleteChallenge } from "./actions";

export default async function ChallengesPage({ searchParams }: { searchParams: Promise<{ pursuit?: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  const { pursuit } = await searchParams;
  const [challenges, subjects] = await Promise.all([
    prisma.challenge.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, title: true, language: true, difficulty: true, passed: true, pursuit: { select: { title: true } } },
    }),
    prisma.pursuit.findMany({
      where: accessiblePursuits(session.user.id),
      orderBy: { lastTouchedAt: "desc" },
      select: { id: true, title: true },
    }),
  ]);
  const solved = challenges.filter((c) => c.passed).length;

  return (
    <div className="mx-auto flex w-full max-w-[1800px] flex-1 flex-col gap-8 px-6 py-10 lg:px-14">
      <header className="flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <Logo href="/pursuits" />
          <span className="text-ink-faint">·</span>
          <h1 className="text-2xl font-extrabold text-mint italic">Challenges</h1>
        </div>
        <Link href="/pursuits" className="text-sm text-ink-muted hover:underline"><ArrowLeft /> Home</Link>
      </header>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_400px]">
        <section className="flex flex-col gap-3" aria-label="Your challenges">
          {challenges.length > 0 && (
            <p className="text-sm font-semibold text-ink-muted">
              {solved}/{challenges.length} solved
            </p>
          )}
          {challenges.length === 0 && (
            <p className="rounded-3xl bg-callout px-6 py-10 text-center text-sm text-ink-muted">
              None yet. Ask for one — it&apos;ll be built from what you&apos;re studying.
            </p>
          )}
          <ul className="flex flex-col gap-2">
            {challenges.map((c) => (
              <li key={c.id} className="group flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-[0_1px_2px_rgba(13,13,13,0.06)]">
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${c.passed ? "bg-mint text-white" : "bg-chip text-ink-muted"}`}>
                  {c.passed ? <CheckIcon size={14} /> : LANGUAGE_INFO[asLanguage(c.language)].short.toLowerCase()}
                </span>
                <Link href={`/challenges/${c.id}`} className="min-w-0 flex-1">
                  <span className="block truncate font-semibold hover:underline">{c.title}</span>
                  <span className="text-xs text-ink-muted">
                    {c.difficulty}{c.pursuit ? ` · ${c.pursuit.title}` : ""}
                  </span>
                </Link>
                <DeleteButton
                  action={deleteChallenge.bind(null, c.id)}
                  confirmMessage={`Delete "${c.title}"?`}
                  className="text-xs text-ink-faint opacity-0 group-hover:opacity-100 hover:text-red-600 focus:opacity-100"
                >
                  Delete
                </DeleteButton>
              </li>
            ))}
          </ul>
        </section>
        <NewChallenge subjects={subjects} defaultSubject={pursuit ?? null} />
      </div>
    </div>
  );
}
