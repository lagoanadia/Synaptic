// Quizlet-style "Learn" session, as pure functions. Every item climbs two
// stages: recognise it (multiple choice / true-false), then produce it
// (type the answer). A miss sends it back a stage and it returns in a
// later round; the session ends when everything is mastered.

export type LearnItem = {
  id: string;
  kind: "card" | "concept";
  pursuitId: string;
  pursuitTitle: string;
  context: string | null;
  prompt: string;
  answer: string;
  distractors: string[];
  hint?: string | null;
};

export type Stage = 0 | 1 | 2; // new/recognising → producing → mastered
export type QuestionType = "choice" | "truefalse" | "written" | "selfcheck";

export type Question = {
  item: LearnItem;
  type: QuestionType;
  options?: string[]; // choice
  shown?: string; // truefalse: the answer being proposed
  truth?: boolean; // truefalse: whether `shown` is right
};

export type LearnState = {
  items: LearnItem[];
  stage: Record<string, Stage>;
  misses: Record<string, number>;
  round: string[]; // item ids still to ask this round
  roundSize: number;
};

type Rand = () => number;
const pick = <T,>(xs: T[], rand: Rand) => xs[Math.floor(rand() * xs.length)];
function shuffle<T>(xs: readonly T[], rand: Rand): T[] {
  const out = [...xs];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function normalizeAnswer(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function levenshtein(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length];
}

// Typed answers: accents, case and punctuation don't matter, and small
// typos are forgiven (about 1 in 6 characters).
export function isCloseEnough(typed: string, answer: string): boolean {
  const a = normalizeAnswer(typed);
  const b = normalizeAnswer(answer);
  if (!a) return false;
  if (a === b) return true;
  return levenshtein(a, b) <= Math.max(1, Math.floor(b.length / 6));
}

// Answers longer than a few words can't fairly be typed exactly; those
// are written then self-checked against the real answer.
const isLong = (answer: string) => normalizeAnswer(answer).split(" ").length > 5;

export function startLearn(items: LearnItem[], roundSize = 7, rand: Rand = Math.random): LearnState {
  const state: LearnState = {
    items,
    stage: Object.fromEntries(items.map((i) => [i.id, 0 as Stage])),
    misses: Object.fromEntries(items.map((i) => [i.id, 0])),
    round: [],
    roundSize,
  };
  return { ...state, round: nextRound(state, rand) };
}

function nextRound(state: LearnState, rand: Rand): string[] {
  const open = state.items.filter((i) => state.stage[i.id] < 2);
  // Items already in progress first, then new ones.
  const ordered = [
    ...shuffle(open.filter((i) => state.stage[i.id] === 1), rand),
    ...shuffle(open.filter((i) => state.stage[i.id] === 0), rand),
  ];
  return ordered.slice(0, state.roundSize).map((i) => i.id);
}

export function isFinished(state: LearnState): boolean {
  return state.items.every((i) => state.stage[i.id] === 2);
}

export function currentQuestion(state: LearnState, rand: Rand = Math.random): Question | null {
  const id = state.round[0];
  const item = state.items.find((i) => i.id === id);
  if (!item) return null;
  const canChoose = item.distractors.length >= 2;
  if (state.stage[id] === 0 && canChoose) {
    if (rand() < 0.25) {
      const truth = rand() < 0.5;
      return { item, type: "truefalse", shown: truth ? item.answer : pick(item.distractors, rand), truth };
    }
    return { item, type: "choice", options: shuffle([item.answer, ...item.distractors.slice(0, 3)], rand) };
  }
  return { item, type: isLong(item.answer) ? "selfcheck" : "written" };
}

export function answer(state: LearnState, correct: boolean, rand: Rand = Math.random): LearnState {
  const id = state.round[0];
  if (!id) return state;
  const stage = { ...state.stage };
  const misses = { ...state.misses };
  if (correct) {
    // Items that can't be multiple-choiced skip straight to mastered.
    const item = state.items.find((i) => i.id === id)!;
    stage[id] = (stage[id] === 0 && item.distractors.length >= 2 ? 1 : 2) as Stage;
  } else {
    misses[id] += 1;
    stage[id] = 0;
  }
  const next: LearnState = { ...state, stage, misses, round: state.round.slice(1) };
  return next.round.length > 0 ? next : { ...next, round: nextRound(next, rand) };
}

// What a finished item means for spaced repetition (SM-2 quality 0-5).
export const qualityFor = (misses: number) => (misses === 0 ? 4 : misses === 1 ? 3 : 1);

// The right answer gives itself away when it's much longer than every wrong
// one (a classic tell). Cards like that get their wrong answers rewritten.
export function answerStandsOut(answer: string, distractors: string[]): boolean {
  if (distractors.length === 0) return false;
  const longest = Math.max(...distractors.map((d) => d.length));
  return answer.length > longest * 1.3 && answer.length - longest > 12;
}
