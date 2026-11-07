import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { SHARED, UNSORTED, getCards, getLearnConcepts, type ReviewScope } from "@/lib/reviewData";
import { shuffle } from "@/lib/review";
import { answerStandsOut, type LearnItem } from "@/lib/learn";
import { withDistractors } from "@/lib/quizDistractors";
import { aiBudget } from "@/lib/access";
import { ReviewGames } from "./ReviewGames";

// Never more than this many cards a day, whatever the backlog.
const DAILY_CAP = 12;

// Repasar: one game for any scope (?section=, ?pursuit=, &unit=; default
// everything). Today's due cards, capped; reviewing a folder or unit with
// nothing due gives a practice round instead of an empty screen.
// (?mode= from old links is ignored.)
export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string; pursuit?: string; unit?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  const userId = session.user.id;
  const params = await searchParams;

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
  const practice = scope.kind === "pursuit" && dueCards.slice(0, left).length === 0;
  let pool = practice ? shuffle(allCards).slice(0, DAILY_CAP) : dueCards.slice(0, left);
  if (pool.some((c) => (c.distractors?.length ?? 0) < 3 || !c.hint || answerStandsOut(c.answer, c.distractors ?? []))) {
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
    .filter((c) => c.summary && (practice ? c.status !== "MASTERED" : c.status === "REREAD"))
    .slice(0, practice ? 4 : 2)
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

  return <ReviewGames backHref={backHref} items={items} />;
}
