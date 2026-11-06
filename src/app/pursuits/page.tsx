import { ArrowRight } from "@/app/icons";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Logo } from "../Logo";
import { Onboarding } from "../onboarding/Onboarding";
import { SectionTiles, type Tile } from "./SectionTiles";
import { tileColor } from "@/lib/tileColor";
import { SHARED, UNSORTED, accessiblePursuits, getConcepts } from "@/lib/reviewData";
import { sample } from "@/lib/review";

// Home: your Sections as big tiles + a "Cross exam" panel that pulls random
// concepts from everything you've written, so old stuff keeps coming back
// instead of being forgotten. Each Section opens /pursuits/s/[sectionId].
export default async function HomePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/");
  }
  const userId = session.user.id;

  const [pursuits, sections, viewer, concepts] = await Promise.all([
    prisma.pursuit.findMany({
      where: accessiblePursuits(userId),
      select: {
        id: true,
        ownerId: true,
        sectionId: true,
        _count: { select: { flashcards: { where: { dueDate: { lte: new Date() } } } } },
      },
    }),
    prisma.section.findMany({ where: { userId }, orderBy: { order: "asc" } }),
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { onboardedAt: true },
    }),
    getConcepts(userId, { kind: "all" }),
  ]);


  // First visit: quick questions instead of an empty screen. Anyone who
  // already has subjects (accounts from before this existed) skips it.
  if (viewer.onboardedAt === null && pursuits.length === 0) {
    return <Onboarding name={session.user.name ?? null} />;
  }

  // Tally subjects and due cards per bucket in one pass. A pursuit someone
  // shared with you goes in "Shared" whatever section its owner put it in
  // — their private section names mean nothing on your home screen.
  const stats = new Map<string, { subjects: number; due: number }>();
  const bump = (key: string, due: number) => {
    const s = stats.get(key) ?? { subjects: 0, due: 0 };
    s.subjects++;
    s.due += due;
    stats.set(key, s);
  };
  for (const p of pursuits) {
    const key = p.ownerId !== userId ? SHARED : (p.sectionId ?? UNSORTED);
    bump(key, p._count.flashcards);
  }
  const totalDue = pursuits.reduce((n, p) => n + p._count.flashcards, 0);

  const describe = (key: string) => {
    const s = stats.get(key) ?? { subjects: 0, due: 0 };
    return {
      subtitle: `${s.subjects} subject${s.subjects === 1 ? "" : "s"}`,
      badge: s.due > 0 ? `${s.due} to review` : undefined,
    };
  };

  const tiles: Tile[] = sections.map((s, i) => ({
    id: s.id,
    href: `/pursuits/s/${s.id}`,
    movable: true,
    name: s.name,
    colorClass: tileColor(i),
    ...describe(s.id),
  }));
  if (stats.has(UNSORTED)) {
    tiles.push({
      id: UNSORTED,
      href: `/pursuits/s/${UNSORTED}`,
      movable: false,
      name: "Unsorted",
      colorClass: "bg-ink-muted",
      ...describe(UNSORTED),
    });
  }
  if (stats.has(SHARED)) {
    tiles.push({
      id: SHARED,
      href: `/pursuits/s/${SHARED}`,
      movable: false,
      name: "Shared",
      colorClass: "bg-tile-deep",
      ...describe(SHARED),
    });
  }

  const picks = sample(concepts, 3);

  return (
    <div className="mx-auto flex w-full max-w-[1800px] flex-1 flex-col gap-10 px-6 py-10 lg:px-14">
      <header className="flex items-center justify-between">
        <div className="flex items-baseline gap-3">
          <Logo href="/pursuits" />
          <span className="hidden text-sm text-ink-faint sm:inline">Think it. Dump it.</span>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section aria-label="Sections">
          <SectionTiles key={tiles.map((t) => t.id).join()} tiles={tiles} />
        </section>

        <aside className="flex flex-col gap-4 self-start rounded-3xl bg-white p-6 shadow-[0_1px_2px_rgba(13,13,13,0.06)]">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xl font-extrabold text-tile-sky">Cross exam</h2>
            {totalDue > 0 && (
              <span className="text-xs font-semibold text-ink-muted">{totalDue} cards due</span>
            )}
          </div>
          {picks.length === 0 ? (
            <p className="rounded-2xl bg-callout px-4 py-5 text-sm text-ink-muted">
              Organize a few Brain Dumps into notes and they&apos;ll start showing up here.
            </p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {picks.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/pursuits/${c.pursuitId}?tab=pages`}
                    className="flex flex-col rounded-2xl bg-tile-blue px-4 py-3 text-white transition-transform hover:-translate-y-0.5"
                  >
                    <span className="truncate text-sm font-semibold">{c.title}</span>
                    <span className="text-xs">{c.pursuitTitle}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link
            href="/review?mode=learn"
            className="mt-1 rounded-full bg-ink px-4 py-2.5 text-center text-sm font-semibold text-white transition-transform hover:-translate-y-0.5"
          >
            Start <ArrowRight />
          </Link>
        </aside>
      </div>

    </div>
  );
}
