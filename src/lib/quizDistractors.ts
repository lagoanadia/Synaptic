import "server-only";
import { prisma } from "@/lib/prisma";
import { arr, askJson, obj, str } from "@/lib/ai";
import type { ReviewCard } from "@/lib/review";
import { answerStandsOut } from "@/lib/learn";

// Fills in what a quiz needs per card and the card doesn't have yet: a
// short question and 2-6 word answer for the quiz, three equally short
// plausible wrong answers, and a vague hint. One AI call for up to
// 12 cards; results are saved. On failure the cards come back unchanged
// (the quiz then uses same-subject answers and no hint).
export async function withDistractors(cards: ReviewCard[], limit = 12): Promise<ReviewCard[]> {
  // Also cards whose right answer gives itself away by being the longest.
  const missing = cards.filter((c) => needsQuizText(c)).slice(0, limit);
  if (missing.length === 0) return cards;

  const data = obj(
    await askJson(
      `For each flashcard below, write a SHORT multiple-choice version, read on a phone in a second:
- "q": the question in at most 16 words, same meaning (rephrase it so a short answer works).
- "a": the correct answer in 4-10 words: a short phrase that fully answers, with the key detail ("El de hilos: comparten la memoria del proceso"). Not a long sentence, not a bare word.
- "wrong": exactly 3 WRONG answers, each 4-10 words, same shape and length as "a" (±2 words), plausible to someone who half-remembers. Never correct or partially correct; no "all/none of the above".
- "tf": a true/false version: "s" = one statement of at most 16 words about the same idea, "t" = whether it's true. Make it FALSE about half the time, by changing one key detail (never by adding "no").
- "hint": one short sentence that nudges toward the answer WITHOUT giving it away.
All in the card's language.

${missing.map((c) => `id: ${c.id}\nsubject: ${c.pursuitTitle}${c.context ? ` / ${c.context}` : ""}\nQ: ${c.question}\nA: ${c.answer}`).join("\n\n")}

Respond with ONLY JSON: {"items": [{"id": "...", "q": "...", "a": "...", "wrong": ["...", "...", "..."], "tf": {"s": "...", "t": true}, "hint": "..."}]}`,
      { maxTokens: 5000 },
    ),
  );
  const byId = new Map<string, { distractors?: string[]; hint?: string; quizQuestion?: string; quizAnswer?: string; tfStatement?: string; tfTrue?: boolean }>();
  for (const item of arr(data.items)) {
    const o = obj(item);
    const wrong = arr(o.wrong).map((w) => str(w, 80)).filter(Boolean).slice(0, 3);
    const hint = str(o.hint, 300);
    const q = str(o.q, 200);
    const a = str(o.a, 120);
    const tf = obj(o.tf);
    const tfStatement = str(tf.s, 200);
    // Short answer and short wrong ones come together, or not at all.
    const short = a && wrong.length === 3 ? { quizAnswer: a, distractors: wrong, ...(q ? { quizQuestion: q } : {}) } : {};
    const tfPart = tfStatement && typeof tf.t === "boolean" ? { tfStatement, tfTrue: tf.t } : {};
    const update = { ...short, ...tfPart, ...(hint ? { hint } : {}) };
    if (Object.keys(update).length) byId.set(str(o.id, 60), update);
  }
  const updates = [...byId].filter(([id]) => missing.some((c) => c.id === id));
  if (updates.length === 0) return cards;

  await prisma.$transaction(updates.map(([id, data]) => prisma.flashcard.update({ where: { id }, data })));
  return cards.map((c) => (byId.has(c.id) ? { ...c, ...byId.get(c.id) } : c));
}

// A card still lacking its short quiz version, wrong answers or hint.
export function needsQuizText(c: ReviewCard): boolean {
  return !c.quizAnswer || !c.tfStatement || (c.distractors?.length ?? 0) < 3 || !c.hint || answerStandsOut(c.quizAnswer, c.distractors ?? []);
}
