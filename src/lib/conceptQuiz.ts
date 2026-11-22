// A short exam on one concept: a mix of question types, graded in the
// browser so feedback is instant. Pure — the AI only writes the questions.
import type { Verdict } from "@/lib/internalize";

export type QuizQuestion =
  | { kind: "choice"; prompt: string; options: string[]; answer: number; why: string }
  | { kind: "truefalse"; prompt: string; answer: boolean; why: string }
  // One list of accepted answers per gap (___), in order.
  | { kind: "blank"; prompt: string; gaps: string[][]; why: string }
  | { kind: "match"; prompt: string; pairs: { left: string; right: string }[]; why: string };

// A blank's answer is one string per gap.
export type QuizAnswer = number | boolean | string | string[] | Record<number, number> | null;

export const GAP = /_{3,}/g;
export const gapCount = (prompt: string) => prompt.match(GAP)?.length ?? 0;

// The AI sometimes writes HTML entities ("&quot;gradlew.bat&quot;"): turn
// them back into the characters they stand for.
const NAMED: Record<string, string> = { quot: '"', amp: "&", lt: "<", gt: ">", apos: "'", nbsp: " ", laquo: "«", raquo: "»", ndash: "–", mdash: "—", hellip: "…" };
export const decodeEntities = (t: string) =>
  t.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const n = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m;
    }
    return NAMED[e.toLowerCase()] ?? m;
  });
const s = (v: unknown, max = 400) => (typeof v === "string" ? decodeEntities(v).trim().slice(0, max) : "");
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
      const gaps = readGaps(q.accepted, gapCount(prompt));
      if (gaps) out.push({ kind: "blank", prompt, gaps, why });
    } else if (q.kind === "match") {
      const pairs = list(q.pairs)
        .map((p) => (p && typeof p === "object" ? { left: s((p as Record<string, unknown>).left, 150), right: s((p as Record<string, unknown>).right, 200) } : null))
        .filter((p): p is { left: string; right: string } => !!p && !!p.left && !!p.right);
      if (pairs.length >= 3 && pairs.length <= 5 && new Set(pairs.map((p) => p.right)).size === pairs.length) out.push({ kind: "match", prompt, pairs, why });
    }
  }
  return out;
}

// The AI's "accepted" → one list per gap, or null when it doesn't fit the
// sentence (e.g. two gaps but a single answer), so the question is dropped
// rather than marking right answers wrong.
function readGaps(raw: unknown, n: number): string[][] | null {
  if (n < 1 || n > 4) return null;
  const items = list(raw);
  const strs = (v: unknown) => list(v).map((a) => s(a, 100)).filter(Boolean);
  let gaps: string[][];
  if (items.length && items.every(Array.isArray)) gaps = items.map(strs);
  else {
    const flat = strs(items);
    if (n === 1) gaps = [flat];
    else if (flat.length === n) gaps = flat.map((a) => [a]);
    else if (flat.length === 1) gaps = flat[0].split(/\s*[,;/]\s*|\s+(?:y|e|and)\s+/).filter(Boolean).map((a) => [a]);
    else return null;
  }
  return gaps.length === n && gaps.every((g) => g.length > 0) ? gaps : null;
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

// A typed gap is right when it matches an accepted answer, or one holds the
// other as whole words ("restaurante" for "sala del restaurante") — the
// key word is what counts, not how much of the phrase was typed.
export function gapOk(accepted: string[], given: string): boolean {
  const g = normalize(given);
  if (!g) return false;
  const words = (s: string) => ` ${s} `;
  return accepted.some((x) => {
    const a = normalize(x);
    if (a === g) return true;
    const [short, long] = a.length < g.length ? [a, g] : [g, a];
    return short.length >= 4 && words(long).includes(words(short));
  });
}

export function isCorrect(q: QuizQuestion, a: QuizAnswer): boolean {
  switch (q.kind) {
    case "choice":
      return a === q.answer;
    case "truefalse":
      return a === q.answer;
    case "blank": {
      const given = Array.isArray(a) ? a : typeof a === "string" ? [a] : [];
      return given.length === q.gaps.length && q.gaps.every((ok, i) => gapOk(ok, given[i] ?? ""));
    }
    case "match": {
      if (!a || typeof a !== "object") return false;
      const m = a as Record<number, number>;
      return q.pairs.every((_, i) => m[i] === i);
    }
  }
}

// The AI tends to put the right option first: shuffle every question's
// options (moving the answer with them), and the questions' order too.
export function shuffleQuiz(qs: QuizQuestion[], rand: () => number = Math.random): QuizQuestion[] {
  const mix = <T,>(a: T[]) => {
    const b = [...a];
    for (let i = b.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [b[i], b[j]] = [b[j], b[i]];
    }
    return b;
  };
  return mix(qs).map((q) => {
    if (q.kind !== "choice") return q;
    const order = mix(q.options.map((_, k) => k));
    return { ...q, options: order.map((k) => q.options[k]), answer: order.indexOf(q.answer) };
  });
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
