import "server-only";
import { prisma } from "@/lib/prisma";
import { arr, askJson, obj, str } from "@/lib/ai";
import type { ReviewCard } from "@/lib/review";
import { answerStandsOut } from "@/lib/learn";

// Fills in what a quiz needs per card and the card doesn't have yet:
// three plausible wrong answers and a vague hint. One AI call for up to
// 12 cards; results are saved. On failure the cards come back unchanged
// (the quiz then uses same-subject answers and no hint).
export async function withDistractors(cards: ReviewCard[], limit = 12): Promise<ReviewCard[]> {
  // Also cards whose right answer gives itself away by being the longest.
  const missing = cards.filter((c) => (c.distractors?.length ?? 0) < 3 || !c.hint || answerStandsOut(c.answer, c.distractors ?? [])).slice(0, limit);
  if (missing.length === 0) return cards;

  const data = obj(
    await askJson(
      `For each flashcard below:
- "wrong": exactly 3 WRONG answers for a multiple-choice quiz. Plausible to someone who half-remembers: same language, type and subject. Each one about AS LONG as the correct answer (±20%) and with the same level of detail and structure (if the answer has two parts or names two things, so does each wrong one): the correct answer must never stand out as the longest or most detailed. Never correct or partially correct; no "all/none of the above".
- "hint": one short sentence that nudges toward the answer WITHOUT giving it away (the area it belongs to, what it's for, or a related idea). Same language as the card.

${missing.map((c) => `id: ${c.id}\nsubject: ${c.pursuitTitle}${c.context ? ` / ${c.context}` : ""}\nQ: ${c.question}\nA: ${c.answer}`).join("\n\n")}

Respond with ONLY JSON: {"items": [{"id": "...", "wrong": ["...", "...", "..."], "hint": "..."}]}`,
      { maxTokens: 5000 },
    ),
  );
  const byId = new Map<string, { distractors?: string[]; hint?: string }>();
  for (const item of arr(data.items)) {
    const o = obj(item);
    const wrong = arr(o.wrong).map((w) => str(w, 300)).filter(Boolean).slice(0, 3);
    const hint = str(o.hint, 300);
    const update = { ...(wrong.length === 3 ? { distractors: wrong } : {}), ...(hint ? { hint } : {}) };
    if (Object.keys(update).length) byId.set(str(o.id, 60), update);
  }
  const updates = [...byId].filter(([id]) => missing.some((c) => c.id === id));
  if (updates.length === 0) return cards;

  await prisma.$transaction(updates.map(([id, data]) => prisma.flashcard.update({ where: { id }, data })));
  return cards.map((c) => (byId.has(c.id) ? { ...c, ...byId.get(c.id) } : c));
}
