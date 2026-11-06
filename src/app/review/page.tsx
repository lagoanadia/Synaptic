import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ArrowLeft } from "@/app/icons";
import { NO_UNIT, SHARED, UNSORTED, getCards, getLearnConcepts, type ReviewScope } from "@/lib/reviewData";
import { shuffle } from "@/lib/review";
import type { LearnItem } from "@/lib/learn";
import { withDistractors } from "@/lib/quizDistractors";
import { aiBudget } from "@/lib/access";
import { ReviewGames, type Mode } from "./ReviewGames";

// Old links (?mode=quiz/recall/challenge) still land somewhere sensible.
const MODE_ALIASES: Record<string, Mode> = { learn: "learn", quiz: "learn", recall: "learn", match: "match", challenge: "match", flash: "flash" };

// Review for one scope: ?section= or ?pursuit= (default: everything).
export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; section?: string; pursuit?: string; unit?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  const userId = session.user.id;
  const params = await searchParams;
  const mode = MODE_ALIASES[params.mode ?? ""] ?? "learn";

  const scope: ReviewScope = params.pursuit
    ? { kind: "pursuit", pursuitId: params.pursuit, unitId: params.unit }
    : params.section
      ? { kind: "section", sectionId: params.section }
      : { kind: "all" };

  let scopeLabel = "Everything";
  let backHref = "/pursuits";
  if (scope.kind === "pursuit") {
    const p = await prisma.pursuit.findFirst({
      where: { id: scope.pursuitId, OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
      select: { title: true },
    });
    scopeLabel = p?.title ?? "Subject";
    backHref = `/pursuits/${scope.pursuitId}`;
    if (scope.unitId) {
      const u =
        scope.unitId === NO_UNIT
          ? null
          : await prisma.pursuitContentSection.findFirst({ where: { id: scope.unitId, pursuitId: scope.pursuitId }, select: { name: true } });
      scopeLabel += ` · ${u?.name ?? "No unit"}`;
      backHref = `/pursuits/${scope.pursuitId}?tab=pages`;
    }
  } else if (scope.kind === "section") {
    const s =
      scope.sectionId === UNSORTED || scope.sectionId === SHARED
        ? null
        : await prisma.section.findFirst({ where: { id: scope.sectionId, userId }, select: { name: true } });
    scopeLabel = s?.name ?? (scope.sectionId === SHARED ? "Shared" : "Unsorted");
    backHref = `/pursuits/s/${scope.sectionId}`;
  }

  const [allCards, dueCards, concepts] = await Promise.all([
    getCards(userId, scope),
    getCards(userId, scope, { dueOnly: true, take: 40 }),
    getLearnConcepts(userId, scope),
  ]);

  // A Learn session: due cards first, then the rest, plus concepts you
  // flagged to reread. Missing wrong answers are written once by the AI.
  const dueIds = new Set(dueCards.map((c) => c.id));
  let pool = [...allCards.filter((c) => dueIds.has(c.id)), ...shuffle(allCards.filter((c) => !dueIds.has(c.id)))].slice(0, 16);
  if (mode === "learn" && pool.some((c) => (c.distractors?.length ?? 0) < 3 || !c.hint)) {
    const budget = await aiBudget(userId, session.user.email);
    if (!(await budget.check())) {
      const filled = await withDistractors(pool);
      if (filled !== pool) await budget.charge();
      pool = filled;
    }
  }
  const cardItems: LearnItem[] = pool.map((c) => ({
    id: c.id,
    kind: "card",
    pursuitId: c.pursuitId,
    pursuitTitle: c.pursuitTitle,
    context: c.context ?? null,
    prompt: c.question,
    answer: c.answer,
    distractors: c.distractors ?? [],
    hint: c.hint ?? null,
  }));
  const conceptItems: LearnItem[] = concepts
    .filter((c) => c.summary && c.status !== "MASTERED")
    .slice(0, 6)
    .map((c) => ({
      id: c.id,
      kind: "concept",
      pursuitId: c.pursuitId,
      pursuitTitle: c.pursuitTitle,
      context: null,
      prompt: c.summary,
      answer: c.title,
      distractors: shuffle(concepts.filter((o) => o.pursuitId === c.pursuitId && o.id !== c.id).map((o) => o.title)).slice(0, 3),
    }));
  const items = [...cardItems, ...conceptItems];
  const matchItems = shuffle(items.filter((i) => i.answer.length <= 70 && i.prompt.length <= 120)).slice(0, 6);

  const scopeQuery =
    scope.kind === "pursuit" ? `pursuit=${scope.pursuitId}${scope.unitId ? `&unit=${scope.unitId}` : ""}` : scope.kind === "section" ? `section=${scope.sectionId}` : "";

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-8">
      <header className="flex items-center gap-3">
        <Link href={backHref} aria-label="Back" className="rounded-full p-2 text-ink-muted hover:bg-chip hover:text-ink">
          <ArrowLeft size={18} className="block" />
        </Link>
        <h1 className="text-2xl font-extrabold">{scopeLabel}</h1>
      </header>
      <ReviewGames
        key={`${mode}-${scopeQuery}`}
        mode={mode}
        scopeQuery={scopeQuery}
        scopeKey={scopeQuery || "all"}
        items={items}
        matchItems={matchItems}
        flash={dueCards.slice(0, 30)}
      />
    </div>
  );
}
