import "server-only";
import { arr, askJson, obj, str } from "@/lib/ai";
import { excerptInSource, parseRepoUrl, pickRepoFiles } from "@/lib/internalize";
import { parseQuiz, type QuizQuestion } from "@/lib/conceptQuiz";

export const MAX_SOURCE_CHARS = 60000;

// ─── Reading a public GitHub repo ──────────────────────────────────────
// Unauthenticated GitHub API: 60 requests/hour per server IP. Set
// GITHUB_TOKEN to raise that (a read-only token is enough).
async function gh(url: string) {
  const res = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`GitHub ${res.status}`);
  return res;
}

export async function readRepo(input: string): Promise<{ ref: string; text: string }> {
  const parsed = parseRepoUrl(input);
  if (!parsed) throw new Error("Eso no parece un repositorio de GitHub (usuario/nombre)");
  const { owner, repo } = parsed;
  const meta = (await (await gh(`https://api.github.com/repos/${owner}/${repo}`)).json()) as {
    default_branch: string;
  };
  const tree = (await (
    await gh(`https://api.github.com/repos/${owner}/${repo}/git/trees/${meta.default_branch}?recursive=1`)
  ).json()) as { tree: { path: string; type: string; size?: number }[] };
  const files = tree.tree.filter((t) => t.type === "blob").map((t) => ({ path: t.path, size: t.size ?? 0 }));
  const picked = pickRepoFiles(files);
  const parts = await Promise.all(
    picked.map(async (path) => {
      const res = await fetch(
        `https://raw.githubusercontent.com/${owner}/${repo}/${meta.default_branch}/${path}`,
        { cache: "no-store" },
      );
      return res.ok ? `=== FILE: ${path} ===\n${(await res.text()).slice(0, 8000)}` : "";
    }),
  );
  // The file list itself is useful context (it's the project's shape).
  const listing = `=== FILE LIST ===\n${files.map((f) => f.path).filter((p) => !p.includes("node_modules")).slice(0, 400).join("\n")}`;
  return {
    ref: `github.com/${owner}/${repo}`,
    text: [listing, ...parts.filter(Boolean)].join("\n\n").slice(0, MAX_SOURCE_CHARS),
  };
}

// ─── Breaking a source into concepts ───────────────────────────────────
export type DraftConcept = {
  key: string;
  title: string;
  summary: string;
  explanation: string;
  excerpt: string | null;
  excerptFrom: string | null;
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
      };
    })
    .filter((c) => c.title && c.explanation);
}

export async function breakDown(source: string, language: string, hint: string): Promise<Breakdown | null> {
  const data = obj(
    await askJson(
      `Break the SOURCE below into the concepts someone needs to understand it — a map they can explore one concept at a time. ${hint}

Make 8-18 concepts, ordered as a learning path (foundations first). Each concept must be small enough to explain in a few sentences. Add links where one concept is needed to understand another ("needs") or they're closely related ("related").

${RULES(language)}

Respond with ONLY JSON:
{"title": "short name for this map",
 "concepts": [{"key": "short-id", "title": "...", "summary": "one sentence", "explanation": "...", "excerpt": "verbatim or null", "excerpt_from": "... or null"}],
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
      `Write a short exam (6 questions) checking whether a student understood "${concept.title}".
What it is: ${concept.explanation}
${parts ? `What it contains:\n${parts}\n` : ""}${concept.excerpt ? `Excerpt from the source:\n${concept.excerpt}\n` : ""}
Mix the question types — use each at least once:
- "choice": 4 options, exactly one right; wrong options must be plausible (common confusions), similar length to the right one
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
