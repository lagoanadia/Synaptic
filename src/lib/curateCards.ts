import "server-only";
import { prisma } from "@/lib/prisma";
import { arr, askJson, obj, str } from "@/lib/ai";

// Few, clear cards instead of many confusing ones: for each note, the AI
// keeps the 2-4 cards about its most important ideas, rewrites them so they
// read at a glance, and the rest go. Kept cards keep their review progress;
// their quiz version is cleared to be written again from the new text.
export const MAX_CARDS_PER_NOTE = 4;

export const CARD_STYLE = `How a good card reads:
- One idea per card, the kind a teacher would ask in an exam: what something is, what it's for, why, or how it differs from a close one.
- Question: at most 12 words, plain everyday words, a real question that makes sense alone months later (name the topic). No stacked clauses, no "según el texto", no "en el ejemplo".
- Answer: at most 12 words, a clear phrase a student could say aloud.
- Never about one-off details: version or API numbers, file names, an emulator's name, values chosen in an exercise.
Good: "¿Para qué sirve un emulador en Android Studio?" → "Para probar la app sin un móvil físico".
Bad: "En los frameworks que compilan a nativo, ¿aproximadamente qué porcentaje del código se comparte?"`;

async function curateNote(noteId: string): Promise<void> {
  const note = await prisma.note.findUnique({ where: { id: noteId }, select: { content: true, flashcards: { select: { id: true, question: true, answer: true } } } });
  if (!note) return;
  if (note.flashcards.length === 0) {
    await prisma.note.update({ where: { id: noteId }, data: { cardsCuratedAt: new Date() } });
    return;
  }
  const out = obj(
    await askJson(
      `A student's study note and the flashcards made from it. There are too many and they're hard to read.
Keep only the ${MAX_CARDS_PER_NOTE} (or fewer) cards about the MOST important ideas of the note, and rewrite each so it reads clearly. Drop the rest (trivia, near-duplicates, confusing ones).
${CARD_STYLE}
Write in the note's language.

NOTE:
${note.content.slice(0, 6000)}

CARDS:
${note.flashcards.map((c) => `id: ${c.id}\nQ: ${c.question}\nA: ${c.answer}`).join("\n\n")}

Respond with ONLY JSON: {"keep": [{"id": "...", "question": "...", "answer": "..."}]}`,
      { maxTokens: 1500 },
    ),
  );
  const ids = new Set(note.flashcards.map((c) => c.id));
  const keep = arr(out.keep)
    .map((k) => obj(k))
    .map((k) => ({ id: str(k.id, 60), question: str(k.question, 300), answer: str(k.answer, 300) }))
    .filter((k) => ids.has(k.id) && k.question && k.answer)
    .slice(0, MAX_CARDS_PER_NOTE);
  // Nothing usable back (AI down): try again another time, change nothing.
  if (keep.length === 0) return;
  const kept = new Set(keep.map((k) => k.id));
  await prisma.$transaction([
    ...keep.map((k) =>
      prisma.flashcard.update({ where: { id: k.id }, data: { question: k.question, answer: k.answer, quizQuestion: null, quizAnswer: null, distractors: [], tfStatement: null, tfTrue: null, hint: null } }),
    ),
    prisma.flashcard.deleteMany({ where: { noteId, id: { notIn: [...kept] } } }),
    prisma.note.update({ where: { id: noteId }, data: { cardsCuratedAt: new Date() } }),
  ]);
}

// Up to `limit` of this user's notes not trimmed yet, a few at a time.
export async function curateNotes(userId: string, limit = 6, pursuitIds?: string[]): Promise<number> {
  const notes = await prisma.note.findMany({
    where: { cardsCuratedAt: null, flashcards: { some: {} }, pursuit: { ownerId: userId, ...(pursuitIds ? { id: { in: pursuitIds } } : {}) } },
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: { id: true },
  });
  let done = 0;
  for (let i = 0; i < notes.length; i += 3) {
    await Promise.all(notes.slice(i, i + 3).map((n) => curateNote(n.id).then(() => done++).catch((e) => console.error("curateNote failed", e))));
  }
  return done;
}
