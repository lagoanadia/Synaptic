import { redirect } from "next/navigation";
import { after } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { SHARED, UNSORTED, getCards, getLearnConcepts, type ReviewScope } from "@/lib/reviewData";
import { shuffle } from "@/lib/review";
import type { LearnItem } from "@/lib/learn";
import { needsQuizText, withDistractors } from "@/lib/quizDistractors";
import { aiBudget } from "@/lib/access";
import { ReviewGames } from "./ReviewGames";
import { ReviewMenu } from "./ReviewMenu";
import { accessiblePursuits } from "@/lib/reviewData";
import { folderCover, type FolderCover } from "@/lib/covers";
import { getLang, getT } from "@/lib/i18n/server";
import { LOCALE } from "@/lib/i18n";

// Never more than this many cards a day, whatever the backlog.
const DAILY_CAP = 12;

// Repasar: one game for any scope (?section=, ?pursuit=, &unit=; default
// everything). Today's due cards, capped; reviewing a folder or unit with
// nothing due gives a practice round instead of an empty screen.
// (?mode= from old links is ignored.)
export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string; pursuit?: string; unit?: string; practice?: string; test?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  const userId = session.user.id;
  const params = await searchParams;

  // A saved test, taken again with the same questions.
  if (params.test) {
    const test = await prisma.savedTest.findFirst({ where: { id: params.test, userId, kind: "quiz" }, select: { id: true, items: true } });
    if (!test) redirect("/review/tests");
    return <ReviewGames key={test.id} backHref="/review/tests" items={test.items as unknown as LearnItem[]} testId={test.id} />;
  }

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
  // ?practice=1: a quiz on everything in scope, whether due or not, to
  // brush up on notes you already know.
  const practice = params.practice === "1" || (scope.kind === "pursuit" && dueCards.slice(0, left).length === 0);
  let pool = practice ? shuffle(allCards).slice(0, DAILY_CAP) : dueCards.slice(0, left);
  // Cards still without their short quiz version get it from the AI — but
  // the game doesn't wait long for it: past that it starts
  // with what there is (wrong answers borrowed from other cards, below) and
  // the AI finishes in the background, saved for next time.
  if (pool.some(needsQuizText)) {
    const budget = await aiBudget(userId, session.user.email);
    if (!(await budget.check())) {
      const start = pool;
      const job = withDistractors(start).then(async (filled) => {
        if (filled !== start) await budget.charge();
        return filled;
      });
      after(() => job.catch(() => {}));
      // Most of the round without its quiz version: worth waiting a little
      // longer than when it's just one or two cards.
      const wait = start.filter(needsQuizText).length > start.length / 2 ? 8000 : 2500;
      pool = await Promise.race([job.catch(() => start), new Promise<typeof start>((r) => setTimeout(() => r(start), wait))]);
    }
  }
  const cardItems: LearnItem[] = pool.map((c) => ({
    id: c.id,
    kind: "card",
    pursuitId: c.pursuitId,
    pursuitTitle: c.pursuitTitle,
    context: c.context ?? null,
    // The short quiz version once it exists; the card's own text until then.
    prompt: c.quizQuestion || c.question,
    answer: c.quizAnswer || c.answer,
    distractors: c.distractors ?? [],
    hint: c.hint ?? null,
    tf: c.tfStatement && typeof c.tfTrue === "boolean" ? { statement: c.tfStatement, isTrue: c.tfTrue } : null,
  }));
  const tq = await getT();
  const conceptItems: LearnItem[] = (practice ? shuffle(concepts) : concepts)
    // Practice: concepts too, even ones you know (more of them when there
    // are few cards).
    .filter((c) => c.summary && (practice ? true : c.status === "REREAD"))
    .slice(0, practice ? Math.max(4, DAILY_CAP - pool.length) : 2)
    .map((c) => ({
      id: c.id,
      kind: "concept",
      pursuitId: c.pursuitId,
      pursuitTitle: c.pursuitTitle,
      // The prompt is a definition: say what's being asked.
      context: tq("¿Qué concepto es?"),
      prompt: c.summary,
      answer: c.title,
      distractors: shuffle(concepts.filter((o) => o.pursuitId === c.pursuitId && o.id !== c.id).map((o) => o.title)).slice(0, 3),
    }));
  // Anything still short of wrong answers borrows others of the same kind:
  // a concept other concepts' names, a card other cards' answers.
  const cardAnswers = [...new Set(allCards.map((c) => c.answer))];
  const conceptNames = [...new Set(concepts.map((c) => c.title))];
  const items = [...cardItems, ...conceptItems].map((i) => {
    if (i.distractors.length >= 3) return i;
    const pool = i.kind === "concept" ? [...shuffle(conceptNames), ...shuffle(cardAnswers)] : [...shuffle(cardAnswers), ...shuffle(conceptNames)];
    return { ...i, distractors: [...i.distractors, ...pool.filter((a) => a !== i.answer && !i.distractors.includes(a))].slice(0, 3) };
  });

  // The side menu: every folder, and each one's units.
  const folders = await prisma.pursuit.findMany({
    // Only subjects from School-type (study) notebooks.
    where: { AND: [accessiblePursuits(userId), { loose: false }, { section: { study: true, OR: [{ kind: "study" }, { kind: null }] } }] },
    orderBy: [{ section: { order: "asc" } }, { createdAt: "asc" }],
    select: { id: true, title: true, cover: true, contentSections: { orderBy: { order: "asc" }, select: { id: true, name: true } } },
  });
  const menu = (
    <ReviewMenu
      folders={folders.map((f) => ({ id: f.id, title: f.title, cover: folderCover(f.id, f.cover) as FolderCover, units: f.contentSections }))}
      pursuitId={scope.kind === "pursuit" ? scope.pursuitId : null}
      unitId={scope.kind === "pursuit" ? (scope.unitId ?? null) : null}
    />
  );

  const q = new URLSearchParams({ ...(params.pursuit ? { pursuit: params.pursuit } : {}), ...(params.unit ? { unit: params.unit } : {}), ...(params.section ? { section: params.section } : {}), practice: "1" });
  const practiceHref = !practice && (allCards.length > 0 || concepts.some((c) => c.summary)) ? `/review?${q}` : null;
  // What a test from here would be called: "PMDM · UD2 · 17 nov".
  const folder = scope.kind === "pursuit" ? folders.find((f) => f.id === scope.pursuitId) : null;
  const unit = folder?.contentSections.find((u) => u.id === (scope.kind === "pursuit" ? scope.unitId : null));
  const t = await getT();
  const when = new Date().toLocaleDateString(LOCALE[await getLang()], { day: "numeric", month: "short" });
  const saveAs = { title: [folder?.title ?? t("Todo"), unit?.name, when].filter(Boolean).join(" · "), pursuitId: folder?.id ?? null, unitId: unit?.id ?? null };
  return <ReviewGames key={`${params.pursuit ?? ""}-${params.unit ?? ""}-${practice ? "p" : ""}`} backHref={backHref} items={items} menu={menu} practiceHref={practiceHref} saveAs={saveAs} />;
}
