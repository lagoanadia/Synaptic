import { redirect } from "next/navigation";
import { after } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { SHARED, UNSORTED, getCards, getLearnConcepts, type ReviewScope } from "@/lib/reviewData";
import { shuffle } from "@/lib/review";
import type { LearnItem } from "@/lib/learn";
import { needsQuizText, withDistractors } from "@/lib/quizDistractors";
import { curateNotes } from "@/lib/curateCards";
import { aiBudget } from "@/lib/access";
import { ReviewGames } from "./ReviewGames";
import { ReviewMenu } from "./ReviewMenu";
import { accessiblePursuits } from "@/lib/reviewData";
import { folderCover, type FolderCover } from "@/lib/covers";
import { getLang, getT } from "@/lib/i18n/server";
import { LOCALE } from "@/lib/i18n";

// Never more than this many cards a day, whatever the backlog.
const DAILY_CAP = 8;

// Repasar: one game for any scope (?section=, ?pursuit=, &unit=; default
// everything). Today's due cards, capped; reviewing a folder or unit with
// nothing due gives a practice round instead of an empty screen.
// (?mode= from old links is ignored.)
export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string; pursuit?: string; unit?: string; practice?: string; test?: string; concepts?: string; back?: string }>;
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

  // Concepts picked on a unit's map ("Elegir conceptos"): a quiz on just
  // those — each one's definition, pick its name.
  if (params.concepts) {
    const ids = params.concepts.split(",").filter(Boolean).slice(0, 40);
    const back = params.back?.startsWith("/review/map/") ? params.back : "/review/map";
    const picked = await prisma.concept.findMany({
      where: { id: { in: ids }, map: { pursuit: accessiblePursuits(userId) } },
      select: { id: true, title: true, summary: true, map: { select: { pursuit: { select: { id: true, title: true } } } } },
    });
    const pursuitIds = [...new Set(picked.map((c) => c.map.pursuit.id))];
    const others = await prisma.concept.findMany({ where: { map: { pursuitId: { in: pursuitIds } } }, select: { title: true, map: { select: { pursuitId: true } } }, take: 400 });
    const tq = await getT();
    const items: LearnItem[] = shuffle(picked.filter((c) => c.summary)).map((c) => ({
      id: c.id,
      kind: "concept",
      pursuitId: c.map.pursuit.id,
      pursuitTitle: c.map.pursuit.title,
      context: tq("¿Qué concepto es?"),
      prompt: c.summary,
      answer: c.title,
      distractors: shuffle(others.filter((o) => o.map.pursuitId === c.map.pursuit.id && o.title !== c.title).map((o) => o.title)).slice(0, 3),
    }));
    return <ReviewGames key={`picked-${ids.join("")}`} backHref={back} items={items} />;
  }

  const scope: ReviewScope = params.pursuit
    ? { kind: "pursuit", pursuitId: params.pursuit, unitId: params.unit }
    : params.section
      ? { kind: "section", sectionId: params.section }
      : { kind: "all" };

  let backHref = "/pursuits";
  if (scope.kind === "pursuit") backHref = `/pursuits/${scope.pursuitId}`;
  else if (scope.kind === "section" && scope.sectionId !== UNSORTED && scope.sectionId !== SHARED) backHref = `/pursuits/s/${scope.sectionId}`;

  // Notes whose cards haven't been trimmed to the few clear ones: a few now
  // (waiting a little), the rest in the background for next time.
  const pursuitIds = scope.kind === "pursuit" ? [scope.pursuitId] : undefined;
  if (await prisma.note.count({ where: { cardsCuratedAt: null, flashcards: { some: {} }, pursuit: { ownerId: userId, ...(pursuitIds ? { id: { in: pursuitIds } } : {}) } } })) {
    const curate = (await (await aiBudget(userId, session.user.email)).check()) ? null : curateNotes(userId, 6, pursuitIds);
    if (curate) {
      await Promise.race([curate.catch(() => 0), new Promise((r) => setTimeout(r, 12000))]);
      after(() => curateNotes(userId, 12, pursuitIds).catch(() => 0));
    }
  }

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  // If nothing is trimmed yet (the AI couldn't), the cards as they are.
  const trimmed = await getCards(userId, scope, { take: 1 });
  const untrimmed = trimmed.length === 0;
  const [allCards, dueCards, concepts, reviewedToday] = await Promise.all([
    getCards(userId, scope, { untrimmed }),
    getCards(userId, scope, { dueOnly: true, take: DAILY_CAP, untrimmed }),
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
      const missing = start.filter(needsQuizText).length;
      const wait = missing === start.length ? 15000 : missing > start.length / 2 ? 8000 : 2500;
      pool = await Promise.race([job.catch(() => start), new Promise<typeof start>((r) => setTimeout(() => r(start), wait))]);
    }
    // Cards still without their quiz version sit this round out (they're
    // being written for the next one) rather than show other cards'
    // answers as options — unless that would leave almost nothing.
    // (Borrowing other cards' answers made nonsense options.)
    const ready = pool.filter((c) => (c.distractors?.length ?? 0) >= 3);
    if (ready.length > 0) pool = ready;
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
    // Only to fill in when there are few cards: "¿Qué concepto es?" with a
    // summary as the question is easy to guess and hard to read.
    .slice(0, pool.length >= 4 ? 0 : practice ? Math.max(4, DAILY_CAP - pool.length) : 2)
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
  // Wrong options are never borrowed from other cards' answers (they were
  // about something else entirely). A concept's options are other concepts
  // of the same subject; an item without 3 real ones sits this round out.
  const items = [...cardItems, ...conceptItems].filter((i) => i.distractors.length >= 3);

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
