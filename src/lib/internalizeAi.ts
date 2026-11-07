import "server-only";
import { arr, askJson, obj, str } from "@/lib/ai";
import { excerptInSource } from "@/lib/internalize";
import { parseQuiz, type QuizQuestion } from "@/lib/conceptQuiz";

export const MAX_SOURCE_CHARS = 60000;

export type DraftConcept = {
  key: string;
  title: string;
  summary: string;
  explanation: string;
  excerpt: string | null;
  excerptFrom: string | null;
  // How the notes write it, when it's really there.
  term: string | null;
};
export type Breakdown = {
  title: string;
  concepts: DraftConcept[];
  links: { from: string; to: string; label: string | null }[];
};

const RULES = (language: string) => `Rules:
- Write titles, summaries and explanations in ${language}. Keep code identifiers as they are.
- Explanations are for a curious learner: plain words, one idea, a concrete example when it helps. 3-6 sentences.
- "excerpt" MUST be copied character-for-character from the source (max ~20 lines), or null. Never invent or edit code/text in an excerpt.
- "excerpt_from" is where the excerpt is (file path from the "=== FILE: ... ===" markers, page, or section), or null.
- Only describe what the source actually contains.`;

// A term only counts if the notes really contain it (any case).
function termIn(term: string, source: string): string | null {
  return term.length >= 2 && source.toLowerCase().includes(term.toLowerCase()) ? term : null;
}

function readConcepts(data: Record<string, unknown>, source: string): DraftConcept[] {
  return arr(data.concepts)
    .map((c, i) => {
      const o = obj(c);
      const excerpt = str(o.excerpt, 3000);
      const real = excerpt && excerptInSource(excerpt, source);
      return {
        key: str(o.key, 60) || `c${i}`,
        title: str(o.title, 120),
        summary: str(o.summary, 400),
        explanation: str(o.explanation, 3000),
        excerpt: real ? excerpt : null,
        excerptFrom: real ? str(o.excerpt_from, 200) || null : null,
        term: termIn(str(o.term, 80), source),
      };
    })
    .filter((c) => c.title && c.explanation);
}

export async function breakDown(source: string, language: string, hint: string): Promise<Breakdown | null> {
  const data = obj(
    await askJson(
      `Break the SOURCE below into the concepts someone needs to understand it — a map they can explore one concept at a time. ${hint}

Make 4-8 concepts: only the KEY ones, no sub-concepts or details (the student can add more later). Order them as a learning path (foundations first). Each must be small enough to explain in a few sentences. Add links where one concept is needed to understand another ("needs") or they're closely related ("related").

${RULES(language)}

Respond with ONLY JSON:
{"title": "the topic in 1-3 words, no 'Mapa de', e.g. 'Bases de datos'",
 "concepts": [{"key": "short-id", "title": "...", "term": "the exact word or short phrase that names it, copied as written in the SOURCE", "summary": "one sentence", "explanation": "...", "excerpt": "verbatim or null", "excerpt_from": "... or null"}],
 "links": [{"from": "key", "to": "key", "label": "needs" | "related"}]}

SOURCE:
${source}`,
      { maxTokens: 12000 },
    ),
  );
  const concepts = readConcepts(data, source);
  if (concepts.length === 0) return null;
  const keys = new Set(concepts.map((c) => c.key));
  const links = arr(data.links)
    .map((l) => ({ from: str(obj(l).from, 60), to: str(obj(l).to, 60), label: str(obj(l).label, 30) || null }))
    .filter((l) => keys.has(l.from) && keys.has(l.to) && l.from !== l.to);
  return { title: str(data.title, 120) || "Mapa de conceptos", concepts, links };
}

// A map grows with the notes: only the concepts in SOURCE that the map
// doesn't cover yet (0-8), linked to existing ones by title.
export async function newConcepts(source: string, existing: string[], language: string): Promise<{ concepts: Breakdown["concepts"]; links: { from: string; toTitle: string; label: string | null }[] } | null> {
  const data = obj(
    await askJson(
      `A concept map already has these concepts: ${existing.map((t) => `"${t}"`).join(", ")}.
From the SOURCE below (a student's notes), list ONLY the concepts it covers that are NOT already in the map (0-8; none is fine). Same rules as the existing ones.

${RULES(language)}

Respond with ONLY JSON:
{"concepts": [{"key": "short-id", "title": "...", "term": "the exact word or short phrase that names it, copied as written in the SOURCE", "summary": "one sentence", "explanation": "...", "excerpt": "verbatim or null", "excerpt_from": "... or null"}],
 "links": [{"from": "new key", "to_title": "title of an existing concept", "label": "needs" | "related"}]}

SOURCE:
${source}`,
      { maxTokens: 8000 },
    ),
  );
  if (!data || typeof data !== "object") return null;
  const concepts = readConcepts(data, source);
  const keys = new Set(concepts.map((c) => c.key));
  const links = arr(data.links)
    .map((l) => ({ from: str(obj(l).from, 60), toTitle: str(obj(l).to_title, 120), label: str(obj(l).label, 30) || null }))
    .filter((l) => keys.has(l.from) && existing.includes(l.toTitle));
  return { concepts, links };
}

// "Go deeper": split one concept into the smaller ideas inside it.
export async function deepen(
  concept: { title: string; explanation: string; excerpt: string | null },
  source: string,
  language: string,
): Promise<DraftConcept[]> {
  const data = obj(
    await askJson(
      `A learner wants to go deeper into the concept "${concept.title}":
${concept.explanation}
${concept.excerpt ? `\nRelevant part of the source:\n${concept.excerpt}\n` : ""}
Split it into 3-5 smaller sub-concepts that together explain it, ordered from simplest to hardest. Use the SOURCE for excerpts.

${RULES(language)}

Respond with ONLY JSON: {"concepts": [{"key": "...", "title": "...", "summary": "...", "explanation": "...", "excerpt": "verbatim or null", "excerpt_from": "... or null"}]}

SOURCE:
${source}`,
      { maxTokens: 6000 },
    ),
  );
  return readConcepts(data, source).slice(0, 6);
}

export async function answerQuestion(
  concept: { title: string; explanation: string; excerpt: string | null },
  question: string,
  source: string,
  language: string,
): Promise<string | null> {
  const data = obj(
    await askJson(
      `A learner is studying the concept "${concept.title}" (${concept.explanation}) and asks: "${question}"

Answer in ${language}, in at most 6 sentences, grounded in the SOURCE below. If the source doesn't cover it, say so and answer briefly from general knowledge, marked as such. Encourage them to connect it to what they know.

Respond with ONLY JSON: {"answer": "..."}

SOURCE:
${source.slice(0, 30000)}`,
      { maxTokens: 2000 },
    ),
  );
  return str(data.answer, 3000) || null;
}

// A short exam on a concept (and what's inside it), grounded in the source.
export async function writeConceptQuiz(
  concept: { title: string; explanation: string; excerpt: string | null },
  inside: { title: string; explanation: string }[],
  source: string,
  language: string,
): Promise<QuizQuestion[]> {
  const parts = inside.map((c) => `- ${c.title}: ${c.explanation}`).join("\n");
  const data = obj(
    await askJson(
      `Write a quick check (4 questions) checking whether a student understood "${concept.title}".
What it is: ${concept.explanation}
${parts ? `What it contains:\n${parts}\n` : ""}${concept.excerpt ? `Excerpt from the source:\n${concept.excerpt}\n` : ""}
Mix the question types — use each at least once:
- "choice": 4 options, exactly one right; wrong options must be plausible (common confusions), as long and as detailed as the right one (±20%), so it never stands out as the longest
- "truefalse": a statement that is clearly true or clearly false per the material — make about half false
- "blank": a sentence with ONE gap written as ___ ; "accepted" lists the short answer (1-3 words) and its obvious variants
- "match": 3-5 pairs to connect (term → definition, item → its role…)

Test understanding (why, what for, which one applies), not trivia or exact wording. Everything must be answerable from the material. Write in ${language}. "why" is a one-sentence explanation shown after answering.

Respond with ONLY JSON:
{"questions": [
 {"kind":"choice","prompt":"...","options":["...","...","...","..."],"answer":0,"why":"..."},
 {"kind":"truefalse","prompt":"...","answer":false,"why":"..."},
 {"kind":"blank","prompt":"... ___ ...","accepted":["..."],"why":"..."},
 {"kind":"match","prompt":"...","pairs":[{"left":"...","right":"..."}],"why":"..."}
]}

SOURCE (for grounding):
${source.slice(0, 20000)}`,
      { maxTokens: 4000 },
    ),
  );
  return parseQuiz(data.questions);
}

// "Añadir al mapa": one concept the student names, explained from their
// notes (or briefly from general knowledge when the notes don't cover it).
export async function explainTerm(term: string, source: string, language: string): Promise<DraftConcept | null> {
  const data = obj(
    await askJson(
      `A student wants "${term}" added to the concept map of their notes. Find it in the SOURCE and explain it as one concept. If the source doesn't cover it, explain it briefly from general knowledge (excerpt null).

${RULES(language)}

Respond with ONLY JSON:
{"concepts": [{"key": "c", "title": "short name (as the student wrote it if it fits)", "term": "the exact word or short phrase, copied as written in the SOURCE, or null", "summary": "one sentence", "explanation": "...", "excerpt": "verbatim or null", "excerpt_from": "... or null"}]}

SOURCE:
${source.slice(0, 30000)}`,
      { maxTokens: 2500 },
    ),
  );
  return readConcepts(data, source)[0] ?? null;
}
