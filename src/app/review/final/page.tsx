import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getCards, getLearnConcepts, type ReviewScope } from "@/lib/reviewData";
import { shuffle } from "@/lib/review";
import { getLang, getT } from "@/lib/i18n/server";
import { LOCALE } from "@/lib/i18n";
import { FinalTest, type FinalQuestion } from "./FinalTest";

const SIZE = 8;

// The final test: questions from your cards and concepts, answered in your
// own words and marked by the AI. ?test= takes a saved one again.
export default async function FinalTestPage({ searchParams }: { searchParams: Promise<{ pursuit?: string; unit?: string; test?: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  const userId = session.user.id;
  const params = await searchParams;
  const t = await getT();

  if (params.test) {
    const test = await prisma.savedTest.findFirst({ where: { id: params.test, userId, kind: "final" }, select: { id: true, items: true } });
    if (!test) redirect("/review/tests");
    return <FinalTest questions={test.items as unknown as FinalQuestion[]} testId={test.id} saveAs={null} />;
  }

  const scope: ReviewScope = params.pursuit ? { kind: "pursuit", pursuitId: params.pursuit, unitId: params.unit } : { kind: "all" };
  const [cards, concepts] = await Promise.all([getCards(userId, scope), getLearnConcepts(userId, scope)]);
  const fromCards: FinalQuestion[] = cards.map((c) => ({ id: c.id, prompt: c.question, reference: c.answer, subject: c.pursuitTitle }));
  const fromConcepts: FinalQuestion[] = concepts
    .filter((c) => c.summary)
    .map((c) => ({ id: c.id, prompt: t("Explica con tus palabras: {0}", { 0: c.title }), reference: [c.summary, c.explanation].filter(Boolean).join("\n").slice(0, 1500), subject: c.pursuitTitle }));
  // Mostly cards, a few concepts to explain.
  const questions = shuffle([...shuffle(fromCards).slice(0, SIZE - Math.min(3, fromConcepts.length)), ...shuffle(fromConcepts).slice(0, 3)]).slice(0, SIZE);

  const folder = scope.kind === "pursuit" ? await prisma.pursuit.findFirst({ where: { id: scope.pursuitId }, select: { id: true, title: true } }) : null;
  const when = new Date().toLocaleDateString(LOCALE[await getLang()], { day: "numeric", month: "short" });
  const saveAs = { title: [t("Final"), folder?.title ?? t("Todo"), when].join(" · "), pursuitId: folder?.id ?? null, unitId: params.unit ?? null };
  return <FinalTest questions={questions} testId={null} saveAs={saveAs} />;
}
