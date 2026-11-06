import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { SHARED, UNSORTED, getCards, getLearnConcepts, type ReviewScope } from "@/lib/reviewData";
import { shuffle } from "@/lib/review";
import type { LearnItem } from "@/lib/learn";
import { withDistractors } from "@/lib/quizDistractors";
import { aiBudget } from "@/lib/access";
import { folderCover } from "@/lib/covers";
import { ReviewGames, type Mode } from "./ReviewGames";

// Old links (?mode=quiz/recall/challenge) still land somewhere sensible.
const MODE_ALIASES: Record<string, Mode> = { learn: "learn", quiz: "learn", recall: "learn", match: "match", challenge: "match", flash: "flash" };

// Never more than this many cards a day, whatever the backlog.
const DAILY_CAP = 12;

// Review for one scope: ?section= or ?pursuit= (default: everything).
// Tarjetas is today's review (due cards, capped); Aprender and Unir
// practise anything in scope.
export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; section?: string; pursuit?: string; unit?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  const userId = session.user.id;
  const params = await searchParams;
  const mode = MODE_ALIASES[params.mode ?? ""] ?? "flash";

  const scope: ReviewScope = params.pursuit
    ? { kind: "pursuit", pursuitId: params.pursuit, unitId: params.unit }
    : params.section
      ? { kind: "section", sectionId: params.section }
      : { kind: "all" };

  let backHref = "/pursuits";
  if (scope.kind === "pursuit") backHref = `/pursuits/${scope.pursuitId}`;
  else if (scope.kind === "section" && scope.sectionId !== UNSORTED && scope.sectionId !== SHARED) backHref = `/pursuits/s/${scope.sectionId}`;

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const [allCards, dueCards, concepts, reviewedToday] = await Promise.all([
    getCards(userId, scope),
    getCards(userId, scope, { dueOnly: true, take: DAILY_CAP }),
    getLearnConcepts(userId, scope),
    prisma.flashcard.count({ where: { pursuit: { ownerId: userId }, reviewedAt: { gte: startOfDay } } }),
  ]);
  const left = Math.max(0, DAILY_CAP - reviewedToday);

  // Today: due cards up to what's left of the cap, plus a couple of concepts
  // you flagged to reread. Practice: a mix of everything.
  let pool =
    mode === "flash"
      ? dueCards.slice(0, left)
      : [...dueCards, ...shuffle(allCards.filter((c) => !dueCards.some((d) => d.id === c.id)))].slice(0, DAILY_CAP);
  if (mode !== "match" && pool.some((c) => (c.distractors?.length ?? 0) < 3 || !c.hint)) {
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
    .filter((c) => c.summary && (mode === "flash" ? c.status === "REREAD" : c.status !== "MASTERED"))
    .slice(0, mode === "flash" ? 2 : 4)
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
  // Anything still short of wrong answers borrows other answers in scope.
  const answers = [...new Set([...allCards.map((c) => c.answer), ...concepts.map((c) => c.title)])];
  const items = [...cardItems, ...conceptItems].map((i) =>
    i.distractors.length >= 3 ? i : { ...i, distractors: [...i.distractors, ...shuffle(answers.filter((a) => a !== i.answer && !i.distractors.includes(a)))].slice(0, 3) },
  );
  const matchItems = shuffle(items.filter((i) => i.answer.length <= 70 && i.prompt.length <= 120)).slice(0, 6);

  // Folders for the "done" screen.
  const ids = [...new Set(items.map((i) => i.pursuitId))];
  const covers = await prisma.pursuit.findMany({ where: { id: { in: ids } }, select: { id: true, title: true, cover: true } });
  const folders = covers.map((p) => ({ id: p.id, title: p.title, cover: folderCover(p.id, p.cover) }));

  const scopeQuery =
    scope.kind === "pursuit" ? `pursuit=${scope.pursuitId}${scope.unitId ? `&unit=${scope.unitId}` : ""}` : scope.kind === "section" ? `section=${scope.sectionId}` : "";

  return (
    <ReviewGames
      key={`${mode}-${scopeQuery}`}
      mode={mode}
      scopeQuery={scopeQuery}
      scopeKey={scopeQuery || "all"}
      backHref={backHref}
      items={items}
      matchItems={matchItems}
      folders={folders}
    />
  );
}
