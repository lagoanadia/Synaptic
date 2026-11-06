import "server-only";
import { prisma } from "@/lib/prisma";
import { arr, askJson, obj, str } from "@/lib/ai";
import type { ReviewCard } from "@/lib/review";

// Fills in AI-written wrong answers for cards that don't have them yet
// (one call for up to 12 cards), saves them, and returns the cards with
// distractors attached. On any failure the cards come back unchanged and
// the quiz falls back to same-subject answers.
export async function withDistractors(cards: ReviewCard[], limit = 12): Promise<ReviewCard[]> {
  const missing = cards.filter((c) => (c.distractors?.length ?? 0) < 3).slice(0, limit);
  if (missing.length === 0) return cards;

  const data = obj(
    await askJson(
      `For each flashcard below, write exactly 3 WRONG answers for a multiple-choice quiz.
They must be plausible to someone who half-remembers the topic: same language, same type and similar length as the correct answer, on the same subject. Never write a correct or partially correct answer, and never use "all/none of the above".

${missing.map((c) => `id: ${c.id}\nsubject: ${c.pursuitTitle}${c.context ? ` / ${c.context}` : ""}\nQ: ${c.question}\nA: ${c.answer}`).join("\n\n")}

Respond with ONLY JSON: {"items": [{"id": "...", "wrong": ["...", "...", "..."]}]}`,
      { maxTokens: 4000 },
    ),
  );
  const byId = new Map<string, string[]>();
  for (const item of arr(data.items)) {
    const o = obj(item);
    const wrong = arr(o.wrong).map((w) => str(w, 300)).filter(Boolean).slice(0, 3);
    if (wrong.length === 3) byId.set(str(o.id, 60), wrong);
  }
  if (byId.size === 0) return cards;

  await prisma.$transaction(
    [...byId].filter(([id]) => missing.some((c) => c.id === id)).map(([id, distractors]) =>
      prisma.flashcard.update({ where: { id }, data: { distractors } }),
    ),
  );
  return cards.map((c) => (byId.has(c.id) ? { ...c, distractors: byId.get(c.id) } : c));
}
