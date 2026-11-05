import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Logo } from "../Logo";
import { SHARED, UNSORTED, getCards, getConcepts, type ReviewScope } from "@/lib/reviewData";
import { buildQuiz, conceptExcerpt, sample } from "@/lib/review";
import { ReviewGames, type Mode } from "./ReviewGames";

const MODES: Mode[] = ["quiz", "recall", "flash", "challenge"];

// One page for every review game. ?mode= picks the game; ?section= or
// ?pursuit= narrows what it draws from (default: everything you can see).
export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; section?: string; pursuit?: string; concept?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/");
  }
  const userId = session.user.id;
  const params = await searchParams;
  const mode: Mode = MODES.includes(params.mode as Mode) ? (params.mode as Mode) : "quiz";

  const scope: ReviewScope = params.pursuit
    ? { kind: "pursuit", pursuitId: params.pursuit }
    : params.section
      ? { kind: "section", sectionId: params.section }
      : { kind: "all" };

  // Only for the heading and the back link — the data queries below
  // already filter by access on their own.
  let scopeLabel = "Everything";
  let backHref = "/pursuits";
  if (scope.kind === "pursuit") {
    const p = await prisma.pursuit.findFirst({
      where: {
        id: scope.pursuitId,
        OR: [{ ownerId: userId }, { members: { some: { userId } } }],
      },
      select: { title: true },
    });
    scopeLabel = p?.title ?? "Subject";
    backHref = `/pursuits/${scope.pursuitId}`;
  } else if (scope.kind === "section") {
    if (scope.sectionId === UNSORTED) scopeLabel = "Unsorted";
    else if (scope.sectionId === SHARED) scopeLabel = "Shared";
    else {
      const s = await prisma.section.findFirst({
        where: { id: scope.sectionId, userId },
        select: { name: true },
      });
      scopeLabel = s?.name ?? "Section";
    }
    backHref = `/pursuits/s/${scope.sectionId}`;
  }

  const [cards, dueCards, concepts] = await Promise.all([
    getCards(userId, scope),
    getCards(userId, scope, { dueOnly: true, take: 30 }),
    getConcepts(userId, scope),
  ]);

  // A concept clicked on the home screen goes first; the rest are random.
  const chosen = params.concept ? concepts.filter((c) => c.id === params.concept) : [];
  const recallPool = [
    ...chosen,
    ...sample(
      concepts.filter((c) => c.id !== params.concept),
      10 - chosen.length,
    ),
  ].map((c) => ({
    id: c.id,
    pursuitId: c.pursuitId,
    pursuitTitle: c.pursuitTitle,
    title: c.title,
    excerpt: conceptExcerpt(c.content),
  }));

  const scopeQuery =
    scope.kind === "pursuit"
      ? `pursuit=${scope.pursuitId}`
      : scope.kind === "section"
        ? `section=${scope.sectionId}`
        : "";

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-10">
      <header className="flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <Logo href="/pursuits" />
          <span className="text-ink-faint">·</span>
          <span className="text-lg font-extrabold text-tile-cyan italic">{scopeLabel}</span>
        </div>
        <Link href={backHref} className="text-sm text-ink-muted hover:underline">
          ← Back
        </Link>
      </header>

      <ReviewGames
        key={`${mode}-${scopeQuery}-${params.concept ?? ""}`}
        mode={mode}
        scopeQuery={scopeQuery}
        scopeKey={scopeQuery || "all"}
        quiz={buildQuiz(cards, 10)}
        challenge={buildQuiz(cards, 60)}
        recall={recallPool}
        flash={dueCards}
        cardCount={cards.length}
      />
    </div>
  );
}
