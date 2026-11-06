// Pure helpers behind the review games (/review): no database, no React,
// so they can be unit-tested and shared by server and client code alike.
// "Concept" here = an Organized Note; "card" = a Flashcard.

export type ReviewCard = {
  id: string;
  pursuitId: string;
  pursuitTitle: string;
  question: string;
  answer: string;
  // Title of the note the card came from, shown as context.
  context?: string | null;
  // AI-written wrong answers; used before any drawn from other cards.
  distractors?: string[];
  hint?: string | null;
};

// A quiz question is about either a flashcard or an Internalize concept;
// `kind` + `refId` say which, so the answer can update the right thing.
export type QuizQuestion = {
  kind: "card" | "concept";
  refId: string;
  pursuitId: string;
  pursuitTitle: string;
  context: string | null;
  question: string;
  options: string[];
  correctIndex: number;
};

type Rand = () => number;

// Fisher–Yates: every order equally likely. A plain
// `sort(() => Math.random() - 0.5)` looks like a shuffle but is biased.
export function shuffle<T>(items: readonly T[], rand: Rand = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function sample<T>(items: readonly T[], n: number, rand: Rand = Math.random): T[] {
  return shuffle(items, rand).slice(0, Math.max(0, n));
}

const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

// Multiple choice. Wrong options are the card's own AI-written distractors
// when it has them, otherwise other answers from the SAME subject only
// (mixing subjects produced absurd options).
export function buildQuiz(
  cards: readonly ReviewCard[],
  count: number,
  rand: Rand = Math.random,
  optionsPerQuestion = 4,
): QuizQuestion[] {
  const questions: QuizQuestion[] = [];
  for (const card of shuffle(cards, rand)) {
    if (questions.length >= count) break;
    const seen = new Set([normalize(card.answer)]);
    const distractors: string[] = [];
    const candidates = [
      ...shuffle(card.distractors ?? [], rand),
      ...shuffle(cards.filter((c) => c.pursuitId === card.pursuitId).map((c) => c.answer), rand),
    ];
    for (const option of candidates) {
      if (distractors.length >= optionsPerQuestion - 1) break;
      const key = normalize(option);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      distractors.push(option);
    }
    // Fewer than 2 wrong options isn't a real choice.
    if (distractors.length < 2) continue;
    const options = shuffle([card.answer, ...distractors], rand);
    questions.push({
      kind: "card",
      refId: card.id,
      pursuitId: card.pursuitId,
      pursuitTitle: card.pursuitTitle,
      context: card.context ?? null,
      question: card.question,
      options,
      correctIndex: options.indexOf(card.answer),
    });
  }
  return questions;
}

// A short plain-text preview of a note for the Recall game: drops the
// first line when it's a `#` heading (that's already the title), image
// markers, and the markdown shortcut characters, then cuts at a word.
export function conceptExcerpt(content: string, maxChars = 280): string {
  const lines = content
    .replace(/!\[image\]\([^)]*\)/g, " ")
    .split("\n")
    .map((l) => l.trim());
  if (lines[0] && /^#+/.test(lines[0])) lines.shift();
  const text = lines
    .filter((l) => l !== "" && !/^[<>]\s*\w*$/.test(l))
    .map((l) =>
      l
        .replace(/^(#+|!|-|○|▪|\d+\.|[a-zA-Z]\.)\s+/, "")
        .replace(/^\|(.+)\|$/, "$1")
        .replace(/\*\*|__|\*/g, ""),
    )
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= maxChars) return text;
  const cut = text.slice(0, maxChars);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > maxChars * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

// Monday 00:00 (local time of wherever this runs) of the week `date` is in
// — "this week's concepts" on a Section page.
export function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const daysSinceMonday = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - daysSinceMonday);
  return d;
}

export type ReviewConcept = {
  id: string;
  pursuitId: string;
  pursuitTitle: string;
  title: string;
  summary: string;
  status: string;
};

// "Which concept is this?" — the summary is the question, concept titles
// from the same pool are the options.
export function buildConceptQuiz(
  concepts: readonly ReviewConcept[],
  count: number,
  rand: Rand = Math.random,
): QuizQuestion[] {
  const withSummary = concepts.filter((c) => c.summary.trim() !== "");
  const asCards: ReviewCard[] = withSummary.map((c) => ({
    id: c.id,
    pursuitId: c.pursuitId,
    pursuitTitle: c.pursuitTitle,
    question: `¿Qué concepto es este? “${c.summary}”`,
    answer: c.title,
  }));
  return buildQuiz(asCards, count, rand).map((q) => ({ ...q, kind: "concept" as const }));
}
