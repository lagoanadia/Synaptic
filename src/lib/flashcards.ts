import { parseJsonLoosely } from "@/lib/json";

export type FlashcardDraft = { question: string; answer: string };

// Turns Groq's raw completion text into a list of question/answer pairs.
// Never throws — invalid JSON, a missing "cards" array, or individual
// cards missing a question/answer just get dropped rather than crashing
// the whole generation for the pursuit.
export function parseFlashcardsResponse(rawText: string): FlashcardDraft[] {
  const parsed = parseJsonLoosely(rawText);
  const obj =
    parsed !== null && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : {};

  const cards = Array.isArray(obj.cards) ? obj.cards : [];

  return cards
    .filter((c): c is Record<string, unknown> => c !== null && typeof c === "object")
    .map((c) => ({
      question: typeof c.question === "string" ? c.question.trim() : "",
      answer: typeof c.answer === "string" ? c.answer.trim() : "",
    }))
    .filter((c) => c.question !== "" && c.answer !== "");
}
