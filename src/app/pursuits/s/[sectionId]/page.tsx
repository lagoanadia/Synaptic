import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Logo } from "../../../Logo";
import { ProfileMenu } from "../../../ProfileMenu";
import { DeleteButton } from "../../DeleteButton";
import { createPursuit, deletePursuit, deleteSection, reorderSection } from "../../actions";
import { BellIcon, BrainIcon, CalendarIcon } from "../../../icons";
import { GameTiles } from "../../../review/GameTiles";
import { SHARED, UNSORTED, getConcepts, pursuitWhere, type ReviewScope } from "@/lib/reviewData";
import { startOfWeek } from "@/lib/review";
import { isLocale } from "@/lib/i18n";

const shortDate = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });

// "Synaptic · School": one Section's concepts of the week + games on the
// left, its subjects ("Activities") on the right with three at-a-glance
// columns — next deadline, open tasks, cards due.
export default async function SectionPage({
  params,
}: {
  params: Promise<{ sectionId: string }>;
}) {
  const { sectionId } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/");
  }
  const userId = session.user.id;

  const isVirtual = sectionId === UNSORTED || sectionId === SHARED;
  const section = isVirtual
    ? null
    : await prisma.section.findFirst({ where: { id: sectionId, userId } });
  if (!isVirtual && !section) notFound();

  const name = section?.name ?? (sectionId === SHARED ? "Shared" : "Unsorted");
  const scope: ReviewScope = { kind: "section", sectionId };
  const now = new Date();

  const [pursuits, weekConcepts, latestConcepts, cardCount, dueCount, allSections, viewer] =
    await Promise.all([
      prisma.pursuit.findMany({
        where: pursuitWhere(userId, scope),
        orderBy: { lastTouchedAt: "desc" },
        select: {
          id: true,
          title: true,
          type: true,
          status: true,
          ownerId: true,
          projects: {
            select: { dueDate: true, cards: { select: { status: true } } },
          },
          _count: { select: { flashcards: { where: { dueDate: { lte: now } } } } },
        },
      }),
      getConcepts(userId, scope, { since: startOfWeek(now), take: 8 }),
      getConcepts(userId, scope, { take: 5 }),
      prisma.flashcard.count({ where: { pursuit: pursuitWhere(userId, scope) } }),
      prisma.flashcard.count({
        where: { pursuit: pursuitWhere(userId, scope), dueDate: { lte: now } },
      }),
      prisma.section.findMany({ where: { userId }, orderBy: { order: "asc" }, select: { id: true } }),
      prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { plan: true, locale: true } }),
    ]);

  // Nothing new this week? Show the latest few instead of an empty box.
  const concepts = weekConcepts.length > 0 ? weekConcepts : latestConcepts;
  const conceptsLabel = weekConcepts.length > 0 ? "This week" : "Latest";
  const sectionIndex = section ? allSections.findIndex((s) => s.id === section.id) : -1;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-10 px-6 py-10 lg:px-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-baseline gap-2">
          <Logo href="/pursuits" />
          <span className="text-base text-ink-faint">·</span>
          <h1 className="text-2xl font-extrabold text-tile-cyan italic">{name}</h1>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/pursuits" className="text-sm text-ink-muted hover:underline">
            ← All sections
          </Link>
          <ProfileMenu
            name={session.user.name}
            email={session.user.email}
            image={session.user.image}
            plan={viewer.plan}
            locale={isLocale(viewer.locale) ? viewer.locale : "en"}
          />
        </div>
      </header>

      <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
        {/* Left: concepts + games */}
        <div className="flex flex-col gap-10">
          <section className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between">
              <h2 className="text-xl font-extrabold">Concepts</h2>
              <span className="text-xs font-semibold text-ink-muted">{conceptsLabel}</span>
            </div>
            {concepts.length === 0 ? (
              <p className="rounded-2xl bg-callout px-4 py-5 text-sm text-ink-muted">
                No concepts here yet. Dump something in a subject and hit Organize.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {concepts.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/pursuits/${c.pursuitId}?tab=organized`}
                      className="flex items-center justify-between gap-3 rounded-2xl bg-tile-sky px-4 py-3 text-white transition-transform hover:-translate-y-0.5"
                    >
                      <span className="truncate text-sm font-semibold">{c.title}</span>
                      <span className="shrink-0 text-xs">{c.pursuitTitle}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <GameTiles
            scopeQuery={`section=${sectionId}`}
            cardCount={cardCount}
            dueCount={dueCount}
            conceptCount={latestConcepts.length}
          />
        </div>

        {/* Right: subjects */}
        <section className="flex flex-col gap-3">
          <div className="grid grid-cols-[minmax(0,1fr)_repeat(3,3.5rem)] items-end gap-2">
            <h2 className="text-xl font-extrabold">Activities</h2>
            <span className="flex justify-center text-ink-muted" title="Next deadline">
              <CalendarIcon title="Next deadline" />
            </span>
            <span className="flex justify-center text-ink-muted" title="Open tasks">
              <BellIcon title="Open tasks" />
            </span>
            <span className="flex justify-center text-ink-muted" title="Cards to review">
              <BrainIcon title="Cards to review" />
            </span>
          </div>

          {pursuits.length === 0 && (
            <p className="rounded-2xl bg-callout px-4 py-5 text-sm text-ink-muted">
              No subjects in {name} yet.
            </p>
          )}

          <ul className="flex flex-col gap-2">
            {pursuits.map((p) => {
              const upcoming = p.projects
                .map((pr) => pr.dueDate)
                .filter((d): d is Date => !!d && d >= startOfDay(now))
                .sort((a, b) => a.getTime() - b.getTime())[0];
              const openTasks = p.projects.reduce(
                (n, pr) => n + pr.cards.filter((c) => c.status !== "DONE").length,
                0,
              );
              const due = p._count.flashcards;
              return (
                <li
                  key={p.id}
                  className="group grid grid-cols-[minmax(0,1fr)_repeat(3,3.5rem)] items-center gap-2"
                >
                  <Link
                    href={`/pursuits/${p.id}`}
                    className={`flex items-center justify-between gap-2 rounded-2xl px-4 py-3 text-white transition-transform hover:-translate-y-0.5 ${
                      p.status === "ACTIVE" ? "bg-tile-sky" : "bg-ink-muted"
                    }`}
                  >
                    <span className="truncate text-sm font-semibold">{p.title}</span>
                    {p.status !== "ACTIVE" && (
                      <span className="shrink-0 text-xs">{p.status.toLowerCase()}</span>
                    )}
                  </Link>
                  <Cell value={upcoming ? shortDate(upcoming) : null} />
                  <Cell value={openTasks > 0 ? String(openTasks) : null} />
                  <Cell value={due > 0 ? String(due) : null} highlight={due > 0} />
                </li>
              );
            })}
          </ul>

          {sectionId !== SHARED && (
            <form action={createPursuit} className="mt-2 flex gap-2">
              <input type="hidden" name="section" value={section?.name ?? ""} />
              <input
                type="text"
                name="title"
                required
                placeholder={`New subject in ${name}`}
                className="flex-1 rounded-2xl border border-border-subtle bg-white px-4 py-3 text-sm"
              />
              <button
                type="submit"
                className="rounded-full bg-ink px-5 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5"
              >
                + Add
              </button>
            </form>
          )}

          {/* Housekeeping, kept small and out of the way */}
          <details className="mt-6 text-xs text-ink-muted">
            <summary className="cursor-pointer select-none hover:text-ink">Manage</summary>
            <div className="mt-3 flex flex-col gap-3">
              {section && (
                <div className="flex flex-wrap items-center gap-2">
                  <span>Order on home:</span>
                  <form action={reorderSection.bind(null, section.id, "up")}>
                    <button type="submit" disabled={sectionIndex <= 0} className="rounded-full bg-chip px-3 py-1 hover:text-ink disabled:opacity-40">
                      ← Earlier
                    </button>
                  </form>
                  <form action={reorderSection.bind(null, section.id, "down")}>
                    <button type="submit" disabled={sectionIndex === allSections.length - 1} className="rounded-full bg-chip px-3 py-1 hover:text-ink disabled:opacity-40">
                      Later →
                    </button>
                  </form>
                  <DeleteButton
                    action={deleteSection.bind(null, section.id)}
                    confirmMessage={`Delete section "${section.name}"? Its subjects move to Unsorted — nothing inside them is deleted.`}
                    className="rounded-full bg-chip px-3 py-1 hover:text-red-600"
                  >
                    Delete section
                  </DeleteButton>
                </div>
              )}
              {pursuits.some((p) => p.ownerId === userId) && (
                <div className="flex flex-col gap-1.5">
                  <span>Delete a subject (and everything inside it):</span>
                  <div className="flex flex-wrap gap-1.5">
                    {pursuits
                      .filter((p) => p.ownerId === userId)
                      .map((p) => (
                        <DeleteButton
                          key={p.id}
                          action={deletePursuit.bind(null, p.id)}
                          confirmMessage={`Delete "${p.title}"? This deletes everything inside it and can't be undone.`}
                          className="rounded-full bg-chip px-3 py-1 hover:text-red-600"
                        >
                          {p.title} ×
                        </DeleteButton>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </details>
        </section>
      </div>
    </div>
  );
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function Cell({ value, highlight = false }: { value: string | null; highlight?: boolean }) {
  return (
    <span
      className={`flex h-full min-h-11 items-center justify-center rounded-xl text-xs font-semibold ${
        highlight ? "bg-tile-aqua text-white" : value ? "bg-white text-ink" : "bg-white/50 text-ink-faint"
      }`}
    >
      {value ?? "—"}
    </span>
  );
}
