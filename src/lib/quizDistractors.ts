import "server-only";
import { prisma } from "@/lib/prisma";
import { arr, askJson, obj, str } from "@/lib/ai";
import type { ReviewCard } from "@/lib/review";
import { answerStandsOut } from "@/lib/learn";

// Fills in what a quiz needs per card and the card doesn't have yet: a
// short question and 2-6 word answer for the quiz, three equally short
// plausible wrong answers, and a vague hint. Up to 12 cards, in batches
// of 4 at once; results are saved. On failure the cards come back unchanged
// (the quiz then uses same-subject answers and no hint).
export async function withDistractors(cards: ReviewCard[], limit = 12): Promise<ReviewCard[]> {
  // Also cards whose right answer gives itself away by being the longest.
  const missing = cards.filter((c) => needsQuizText(c)).slice(0, limit);
  if (missing.length === 0) return cards;
  // Small batches side by side: a round's worth comes back in a few
  // seconds instead of one long answer for all of them.
  const batches: ReviewCard[][] = [];
  for (let i = 0; i < missing.length; i += 4) batches.push(missing.slice(i, i + 4));
  const done = await Promise.all(batches.map((b) => quizTextFor(b).catch(() => new Map<string, Partial<ReviewCard>>())));
  const byId = new Map(done.flatMap((m) => [...m]));
  if (byId.size === 0) return cards;
  return cards.map((c) => (byId.has(c.id) ? { ...c, ...byId.get(c.id) } : c));
}

// One AI call for a few cards; what it wrote is saved and returned by id.
async function quizTextFor(missing: ReviewCard[]): Promise<Map<string, Partial<ReviewCard>>> {
  const data = obj(
    await askJson(
      `For each flashcard below, write a SHORT multiple-choice version, read on a phone in a second:
First, what to ask. Test the CONCEPT the card is about: what it is, what it's for, why, how it differs from a close one, when it applies. If the card asks about a detail of an example used to explain it (a price, an amount, "la licencia X", "la empresa A", a name or number someone picked), ask about the idea that example shows instead. Every question and statement must make sense on its own months later, with no notes in front: name the topic, and never lean on "el ejemplo", "la recomendación", "el caso", "esta empresa" or anything only the notes define.
If the card itself is about such a detail (an emulator's name, a version or API number someone picked, a file name in an exercise), ask what that thing IS or what it's FOR in the subject — never "which number/name does X have".
Bad: "¿Qué API corresponde al emulador llamado 'objetivo'?" (a setting from one exercise). Good: "¿Para qué sirve elegir el nivel de API de un emulador?"
- "q": the question in at most 16 words.
- "a": the correct answer in 4-10 words: a short phrase that fully answers, with the key detail ("El de hilos: comparten la memoria del proceso"). Not a long sentence, not a bare word.
- "wrong": exactly 3 WRONG answers, each 4-10 words, same shape and length as "a" (±2 words), plausible to someone who half-remembers (common confusions). They answer THIS question: the same kind of thing as "a" and about the same topic (if "a" says what a tool does, each wrong one says something else that tool could plausibly do) — never an answer to a different question. Never correct or partially correct; no "all/none of the above". The four must differ in their idea, not just in one swapped word or letter ("licencia X / licencia Y"), and don't let only the right one echo the question.
- "tf": a true/false version: "s" = one statement of at most 16 words about the same idea, clearly true or clearly false from the subject itself (not a vague claim), "t" = whether it's true. Make it FALSE about half the time, by changing one key idea (never by adding "no"). It must test understanding (what something does, why, how things relate), never a specific number, version, name or value: if the card is about such a detail, state the concept behind it instead.
- "hint": one short sentence that nudges toward the answer WITHOUT giving it away.
Before answering, check each item: would a classmate who studied understand the question with nothing else in front of them, and do all four options answer it? If not, rewrite it.
All in the card's language.

${missing.map((c) => `id: ${c.id}\nsubject: ${c.pursuitTitle}${c.context ? ` / ${c.context}` : ""}\nQ: ${c.question}\nA: ${c.answer}`).join("\n\n")}

Respond with ONLY JSON: {"items": [{"id": "...", "q": "...", "a": "...", "wrong": ["...", "...", "..."], "tf": {"s": "...", "t": true}, "hint": "..."}]}`,
      { maxTokens: 2200 },
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
  if (updates.length === 0) return new Map();
  await prisma.$transaction(updates.map(([id, data]) => prisma.flashcard.update({ where: { id }, data })));
  return new Map(updates);
}

// A card still lacking its short quiz version, wrong answers or hint.
export function needsQuizText(c: ReviewCard): boolean {
  return !c.quizAnswer || !c.tfStatement || (c.distractors?.length ?? 0) < 3 || !c.hint || answerStandsOut(c.quizAnswer, c.distractors ?? []);
}
