// A short exam on one concept: a mix of question types, graded in the
// browser so feedback is instant. Pure — the AI only writes the questions.
import type { Verdict } from "@/lib/internalize";

export type QuizQuestion =
  | { kind: "choice"; prompt: string; options: string[]; answer: number; why: string }
  | { kind: "truefalse"; prompt: string; answer: boolean; why: string }
  | { kind: "blank"; prompt: string; accepted: string[]; why: string }
  | { kind: "match"; prompt: string; pairs: { left: string; right: string }[]; why: string };

export type QuizAnswer = number | boolean | string | Record<number, number> | null;

const s = (v: unknown, max = 400) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const list = (v: unknown) => (Array.isArray(v) ? v : []);

// The AI's JSON → questions we can trust: anything malformed is dropped.
export function parseQuiz(raw: unknown): QuizQuestion[] {
  const out: QuizQuestion[] = [];
  for (const item of list(raw)) {
    if (!item || typeof item !== "object") continue;
    const q = item as Record<string, unknown>;
    const prompt = s(q.prompt);
    const why = s(q.why, 600);
    if (!prompt) continue;
    if (q.kind === "choice") {
      const options = list(q.options).map((o) => s(o, 200)).filter(Boolean);
      const answer = Number(q.answer);
      if (options.length >= 2 && options.length <= 6 && Number.isInteger(answer) && answer >= 0 && answer < options.length && new Set(options).size === options.length)
        out.push({ kind: "choice", prompt, options, answer, why });
    } else if (q.kind === "truefalse") {
      if (typeof q.answer === "boolean") out.push({ kind: "truefalse", prompt, answer: q.answer, why });
    } else if (q.kind === "blank") {
      const accepted = list(q.accepted).map((a) => s(a, 100)).filter(Boolean);
      if (accepted.length > 0 && prompt.includes("___")) out.push({ kind: "blank", prompt, accepted, why });
    } else if (q.kind === "match") {
      const pairs = list(q.pairs)
        .map((p) => (p && typeof p === "object" ? { left: s((p as Record<string, unknown>).left, 150), right: s((p as Record<string, unknown>).right, 200) } : null))
        .filter((p): p is { left: string; right: string } => !!p && !!p.left && !!p.right);
      if (pairs.length >= 3 && pairs.length <= 5 && new Set(pairs.map((p) => p.right)).size === pairs.length) out.push({ kind: "match", prompt, pairs, why });
    }
  }
  return out;
}

// Forgiving comparison for typed answers: case, accents, punctuation and
// leading articles don't matter.
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/^\s*(el|la|los|las|un|una|the|a|an)\s+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function isCorrect(q: QuizQuestion, a: QuizAnswer): boolean {
  switch (q.kind) {
    case "choice":
      return a === q.answer;
    case "truefalse":
      return a === q.answer;
    case "blank":
      return typeof a === "string" && q.accepted.some((x) => normalize(x) === normalize(a));
    case "match": {
      if (!a || typeof a !== "object") return false;
      const m = a as Record<number, number>;
      return q.pairs.every((_, i) => m[i] === i);
    }
  }
}

// Score → the same verdicts "explain it back" used, so status rules stay.
export function quizVerdict(correct: number, total: number): Verdict {
  if (total === 0) return "partly";
  const r = correct / total;
  return r >= 0.8 ? "got_it" : r >= 0.5 ? "partly" : "not_yet";
}

// A stable shuffle (for match's right column) so the order doesn't jump
// between renders.
export function shuffledOrder(n: number, seed: string): number[] {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const idx = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
    const j = h % (i + 1);
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  // Never show it already solved.
  if (n > 1 && idx.every((v, i) => v === i)) idx.push(idx.shift()!);
  return idx;
}
