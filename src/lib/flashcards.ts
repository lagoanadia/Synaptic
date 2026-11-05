import { parseJsonLoosely } from "@/lib/json";

export type FlashcardDraft = { question: string; answer: string };

// AI text → question/answer pairs. Never throws; bad cards are dropped.
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
