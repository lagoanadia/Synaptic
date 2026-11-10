"use server";

import { getT } from "@/lib/i18n/server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { aiBudget } from "@/lib/access";
import { arr, askJson, obj, str } from "@/lib/ai";
import { shuffle } from "@/lib/review";
import { asLanguage, formatReview, isTheoryLookup, LANGUAGE_INFO, parseChallenge, pickBySkill, type ChallengeDraft, type ChallengeTest, type Language } from "@/lib/challenge";
import { accessiblePursuits } from "@/lib/reviewData";

// No code ever runs on the server. The server drafts a challenge (with a
// reference solution); the browser checks that solution in its sandbox and
// saves only the tests it passes.

async function signedIn() {
  const t = await getT();
  const session = await auth();
  if (!session?.user?.id) throw new Error(t("No has iniciado sesión"));
  return { userId: session.user.id, email: session.user.email };
}

export type DraftForBrowser = ChallengeDraft & {
  skill: string | null;
  language: Language;
  difficulty: string;
  pursuitId: string | null;
};

export async function draftChallenge(input: {
  language: Language;
  difficulty: "easy" | "medium" | "hard";
  pursuitId: string | null;
  topic: string;
}): Promise<{ error: string | null; drafts?: DraftForBrowser[] }> {
  const t = await getT();
  const { userId, email } = await signedIn();
  const budget = await aiBudget(userId, email);
  const limited = await budget.check();
  if (limited) return { error: limited };

  const language = asLanguage(input.language);
  const difficulty = ["easy", "medium", "hard"].includes(input.difficulty) ? input.difficulty : "easy";

  // Built from your notes: excerpts from a few of them (one subject, or
  // across everything), picked at random so it isn't always the same note.
  const notes = await prisma.note.findMany({
    where: {
      pursuit: input.pursuitId
        ? { AND: [accessiblePursuits(userId), { id: input.pursuitId }] }
        : accessiblePursuits(userId),
    },
    orderBy: { createdAt: "desc" },
    take: 40,
    select: { content: true, pursuit: { select: { id: true, title: true } } },
  });
  const picked = shuffle(notes).slice(0, 5);
  const pursuitId = input.pursuitId && notes[0] ? notes[0].pursuit.id : null;
  const context = picked.length
    ? `Build the challenge FROM these notes the learner wrote (pick ONE idea from them and make it the core of the exercise). If the notes aren't about programming, design a small function that models or checks the concept (e.g. a database-normalization note → a function that detects a repeated group; a grammar note → a function that conjugates). Put the note's title in "based_on".

${picked.map((n, i) => `--- NOTE ${i + 1} (${n.pursuit.title}) ---\n${n.content.slice(0, 900)}`).join("\n\n")}`
    : "The learner has no notes yet: make a general exercise.";
  const topic = input.topic.trim().slice(0, 200);

  // Everything already made, so nothing repeats.
  const existing = await prisma.challenge.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 60,
    select: { title: true, skill: true, passed: true },
  });
  const taken = existing.map((c) => c.title);
  // Skills already trained (solved), so new ones go to the gaps.
  const practised = [...new Set(existing.filter((c) => c.passed && c.skill).map((c) => c.skill!))].slice(0, 20);

  const ask = async (context: string): Promise<DraftForBrowser[]> => {
  const t = await getT();
    const data = obj(
      await askJson(
        `Create FIVE different small coding challenges in ${LANGUAGE_INFO[language].label} for someone getting back into coding after a break. Difficulty: ${difficulty} (easy = 5-15 lines, medium = loops/conditions/data structures, hard = a small algorithm).
  ${context}
  ${topic ? `The learner asked for this — EVERY challenge must practise it: ${topic}` : ""}
  FIRST work out the SKILL MAP for this material: the 4-6 concrete programming skills someone who learned it should be able to APPLY (e.g. "recorrer una lista acumulando un total", "contar apariciones con un diccionario", "validar datos con condiciones", "transformar una lista de objetos", "recursividad sobre una estructura"). Skills, not topics or facts. ${practised.length ? `Already practised (put these last): ${practised.map((p) => `"${p}"`).join(", ")}.` : ""}
  THEN write each challenge to train ONE skill from the map, every challenge a DIFFERENT skill. If the notes contain exercises from class, AT MOST ONE challenge may be close to one of them ("from_class": true); every other one must be ORIGINAL — a new situation that needs the same skill, never a copy or light rewording of a class exercise.
  None may be the same as or a variant of these existing challenges: ${taken.length ? taken.map((t) => `"${t}"`).join(", ") : "(none yet)"}.

  Be strict about what makes a GOOD coding challenge: solving it must take real programming — processing input data with loops, conditions, accumulating, transforming, validating, counting, searching or simulating. The notes give the DOMAIN (the kind of data and rules), never text to copy.
  REJECT (never write) challenges that are theory turned into code:
  - mapping a number/key to a description or definition from the notes ("phase 3 → 'Execution: …'")
  - returning memorized sentences, names or facts; lookup tables of strings
  - anything whose solution is mostly copied text or a big switch/if-chain of constants
  Instead, turn the idea into DATA + RULES. Example: a note on an app's lifecycle phases → "Given a list of lifecycle events, return the final state, or 'invalid' if a transition isn't allowed" (a state machine), not "return the description of phase N". A note on colour theory → "Given a list of RGB colours, return those that are greys", not "return the name of a colour".
  EVERYTHING the learner reads is in the user's language (title, prompt, comments); identifiers in code may stay in English.
  Expected outputs are short values: numbers, booleans, short strings (< 40 characters), arrays or objects — never sentences.

  ${SHAPE[language]}

  Respond with ONLY JSON: {"skills": ["…", "…"], "challenges": [
    {
      "skill": "the skill from the map it trains, in the user's language, short",
      "from_class": false,
      "title": "short title, in the user's language",
      "prompt": "the task, in the user's language, as markdown: one or two plain sentences on what to do; then a line **Recibe:** followed by one '- \`param\`: what it is' line per parameter; then **Devuelve:** and what it returns; then one example as a fenced code block (\`\`\`), e.g. \`\`\`\\nnombreFuncion(...) → resultado\\n\`\`\`. Never glue the example into the prose.",
      "entry": "functionName",
      "starter_code": "the function signature with a placeholder body and a short comment IN THE USER'S LANGUAGE (e.g. // Escribe tu código aquí)",
      "tests": [{"args": [...], "expected": ...}],
      "solution": "a correct reference solution",
      "based_on": "title of the note it practices, or null"
    }
  ]}
  5-8 tests each, normal and edge cases. Only JSON values in args/expected.`,
        { maxTokens: 12000 },
      ),
    );
    const seen = new Set(taken.map(titleKey));
    const candidates: (DraftForBrowser & { fromClass: boolean })[] = [];
    for (const raw of arr(data.challenges)) {
      const draft = parseChallenge(raw);
      if (!draft || seen.has(titleKey(draft.title)) || isTheoryLookup(draft, language === "react")) continue;
      seen.add(titleKey(draft.title));
      const o = obj(raw);
      const basedOn = str(o.based_on, 120);
      const prompt = basedOn ? t("De tu nota “{0}”\n\n{1}", { 0: basedOn, 1: draft.prompt }) : draft.prompt;
      candidates.push({ ...draft, prompt, skill: str(o.skill, 80) || null, fromClass: o.from_class === true, language, difficulty, pursuitId });
    }
    // fromClass only matters for picking; the rest goes to the browser. Up
    // to 5 go back: some fail the sandbox check, the browser keeps 3.
    return pickBySkill(candidates, practised, 5).map((d) => ({ ...d, fromClass: undefined }));
  };
  let drafts = await ask(context);
  // Nothing good came out of the notes: small general exercises instead,
  // a step up from what's already solved.
  if (drafts.length === 0 && picked.length) drafts = await ask(LADDER);
  if (drafts.length === 0) return { error: t("No eran retos de programación de verdad — inténtalo de nuevo") };
  await budget.charge();
  return { error: null, drafts };
}

const LADDER = "Make small, general exercises that build the basics step by step (accumulate a total, filter a list, count with an object/dictionary, find a max, transform strings…), each a small step up from the previous one. No notes needed.";

// How each language's challenges are tested, for the prompt.
const SHAPE: Record<Language, string> = {
  javascript: "Each must be solvable as ONE pure function (no input, files, network or randomness), tested by calling it with arguments and comparing the JSON-serializable return value.",
  typescript: "Each must be solvable as ONE pure, typed function (typed parameters and return type; no input, files, network or randomness), tested by calling it with arguments and comparing the JSON-serializable return value. starter_code and solution are TypeScript.",
  python: "Each must be solvable as ONE pure function (no input(), files, network or randomness), tested by calling it with arguments and comparing the JSON-serializable return value.",
  react: `Each is ONE React function component. "entry" is the component's name in PascalCase (e.g. "CartSummary"), and the code defines a component with exactly that name (it may use hooks like useState/useMemo, written with JSX, may \`import { useState } from "react"\`; no fetch, effects that change what renders, timers or CSS). It is tested by rendering it ONCE with props: each test is {"args": [props object], "expected": "the visible text it renders"} — text only (tags removed, whitespace collapsed), e.g. a list of items renders "Milk Eggs Bread". Make tests cover different props: empty lists, conditional text, counts, formatting. The component must compute what it shows from its props (filter, count, sort, group, format) — not pick a prewritten text.`,
};

// "Mezcla de colores (RGB)" and "Mezcla de colores RGB" are the same challenge.
const titleKey = (t: string) =>
  t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

export async function saveChallenge(
  draft: DraftForBrowser,
  passingTests: ChallengeTest[],
): Promise<{ error: string | null; id?: string }> {
  const t = await getT();
  const { userId } = await signedIn();
  // Re-validated: it came back from the browser.
  const clean = parseChallenge({ ...draft, starter_code: draft.starterCode, tests: passingTests });
  if (!clean) return { error: t("La IA ha hecho un reto roto — inténtalo de nuevo") };
  const pursuit = draft.pursuitId
    ? await prisma.pursuit.findFirst({
        where: { AND: [accessiblePursuits(userId), { id: draft.pursuitId }] },
        select: { id: true },
      })
    : null;
  const challenge = await prisma.challenge.create({
    data: {
      userId,
      pursuitId: pursuit?.id ?? null,
      title: clean.title,
      prompt: clean.prompt,
      language: asLanguage(draft.language),
      entry: clean.entry,
      starterCode: clean.starterCode,
      tests: clean.tests as object[],
      difficulty: ["easy", "medium", "hard"].includes(draft.difficulty) ? draft.difficulty : "easy",
      skill: typeof draft.skill === "string" ? draft.skill.trim().slice(0, 80) || null : null,
    },
  });
  revalidatePath("/challenges");
  return { error: null, id: challenge.id };
}

// Saves your code after a run; the first all-green run marks it solved.
export async function saveRun(id: string, code: string, passed: boolean) {
  const { userId } = await signedIn();
  const challenge = await prisma.challenge.findFirst({ where: { id, userId }, select: { passed: true } });
  if (!challenge) return;
  await prisma.challenge.update({
    where: { id },
    data: {
      code: code.slice(0, 20000),
      ...(passed && !challenge.passed ? { passed: true, solvedAt: new Date() } : {}),
    },
  });
  revalidatePath("/challenges");
}

// Feedback like a kind senior dev in code review — no full rewrite.
export async function reviewSolution(id: string, code: string): Promise<{ error: string | null; review?: string }> {
  const t = await getT();
  const { userId, email } = await signedIn();
  const challenge = await prisma.challenge.findFirst({ where: { id, userId } });
  if (!challenge) return { error: t("Reto no encontrado") };
  if (code.trim().length < 10) return { error: t("Escribe algo de código primero") };
  const budget = await aiBudget(userId, email);
  const limited = await budget.check();
  if (limited) return { error: limited };

  const data = obj(
    await askJson(
      `Review this ${challenge.language} solution like a kind senior developer helping someone who's getting back into coding.

Task: ${challenge.prompt}

Their code:
${code.slice(0, 8000)}

Write in the same language as the task, in plain, simple words — like a friend explaining, not a textbook. Be specific to THEIR code.
- "good": what they did right (1-2 points)
- "fix": what's wrong or missing, most important first (0-3 points; empty if nothing)
- "next": one or two things to try next, each something they can do RIGHT HERE in plain ${challenge.language} code (another way to write it, a method worth learning, an edge case to handle) — never tools, libraries, testing frameworks or setup (no Jest, npm, linters). Say it so a beginner knows what it means.
Each point: ONE short sentence (max ~16 words). Put code in \`backticks\`. No full solutions.

Respond with ONLY JSON: {"good": ["..."], "fix": ["..."], "next": ["..."]}`,
      { maxTokens: 2000 },
    ),
  );
  const points = (v: unknown) => arr(v).map((x) => str(x, 300)).filter(Boolean).slice(0, 3);
  const review = formatReview({ good: points(data.good), fix: points(data.fix), next: points(data.next) });
  if (!review) return { error: t("No se ha podido contactar con la IA ahora mismo") };
  await budget.charge();
  await prisma.challenge.update({ where: { id }, data: { review, code: code.slice(0, 20000) } });
  return { error: null, review };
}

export async function deleteChallenge(id: string) {
  const { userId } = await signedIn();
  await prisma.challenge.deleteMany({ where: { id, userId } });
  revalidatePath("/challenges");
}

// Progressive hints: level 1 is a direction, level 2 a concrete pointer at
// their code, level 3 the key step in words. Never the solution in code.
export async function getHint(id: string, code: string, level: number): Promise<{ error: string | null; hint?: string }> {
  const t = await getT();
  const { userId, email } = await signedIn();
  const challenge = await prisma.challenge.findFirst({ where: { id, userId } });
  if (!challenge) return { error: t("Reto no encontrado") };
  const budget = await aiBudget(userId, email);
  const limited = await budget.check();
  if (limited) return { error: limited };
  const depth = ["a gentle direction: which idea or approach to think about", "a concrete pointer at what in THEIR code is wrong or missing", "the key step described in words, still without writing the code"][Math.min(Math.max(level, 1), 3) - 1];
  const data = obj(
    await askJson(
      `A learner is solving this ${challenge.language} challenge and asked for hint level ${level}/3.
Task: ${challenge.prompt}
Their code so far:
${code.slice(0, 6000)}

Give ${depth}. 1-3 sentences, in the same language as the task. NEVER write the solution or a full function.
Respond with ONLY JSON: {"hint": "..."}`,
      { maxTokens: 800 },
    ),
  );
  const hint = str(data.hint, 800);
  if (!hint) return { error: t("No se ha podido contactar con la IA ahora mismo") };
  await budget.charge();
  return { error: null, hint };
}

// "No lo sé": how to solve it, explained like a teacher at the board —
// the idea, the steps, then a solution with every line commented.
export type ExplainStep = { say: string; code: string };

export async function explainSolution(id: string): Promise<{ error: string | null; steps?: ExplainStep[]; code?: string }> {
  const t = await getT();
  const { userId, email } = await signedIn();
  const challenge = await prisma.challenge.findFirst({ where: { id, userId } });
  if (!challenge) return { error: t("Reto no encontrado") };
  const budget = await aiBudget(userId, email);
  const limited = await budget.check();
  if (limited) return { error: limited };
  const data = obj(
    await askJson(
      `A beginner is stuck on this ${challenge.language} challenge and pressed "I don't know". Teach them how to solve it, like a patient teacher at the board.
Task: ${challenge.prompt}
Starter code:
${challenge.starterCode}

In the user's language, plain simple words:
- "steps": 3-5 steps that build the solution piece by piece. Each step: "say" = ONE short, friendly sentence (max ~14 words) saying what we do and why; "code" = ONLY the 1-4 lines this step adds (no comments).
- "code": the whole solution put together: simple and readable (no clever one-liners), NO comments, short lines (under 45 characters; break long ones).
Use ONLY first-year basics: variables, if/else, for loops, arrays, plain objects, simple functions. Never \`??\`, \`?.\`, reduce, map/filter chains, destructuring, spread, ternaries, regex or utility types — unless the starter code already uses them.

Respond with ONLY JSON: {"steps": [{"say": "...", "code": "..."}], "code": "..."}`,
      { maxTokens: 2500 },
    ),
  );
  const steps = arr(data.steps)
    .map((x) => ({ say: str(obj(x).say, 300), code: str(obj(x).code, 1500) }))
    .filter((x) => x.say)
    .slice(0, 6);
  const code = str(data.code, 6000);
  if (!steps.length || !code) return { error: t("No se ha podido contactar con la IA ahora mismo") };
  await budget.charge();
  return { error: null, steps, code };
}

// A question about the "No lo sé" explanation ("¿qué es Record?"),
// answered for a beginner, with the conversation so far.
export async function askAboutSolution(
  id: string,
  explanation: string,
  history: { q: string; a: string }[],
  question: string,
): Promise<{ error: string | null; answer?: string }> {
  const t = await getT();
  const { userId, email } = await signedIn();
  const challenge = await prisma.challenge.findFirst({ where: { id, userId }, select: { prompt: true, language: true } });
  if (!challenge) return { error: t("Reto no encontrado") };
  const q = question.trim().slice(0, 500);
  if (!q) return { error: t("Escribe tu pregunta") };
  const budget = await aiBudget(userId, email);
  const limited = await budget.check();
  if (limited) return { error: limited };
  const data = obj(
    await askJson(
      `A first-year programming student is reading how to solve this ${challenge.language} challenge and has a question.
Task: ${challenge.prompt}
The explanation they're reading:
${explanation.slice(0, 4000)}
${history.slice(-4).map((h) => `They asked: ${h.q}\nYou answered: ${h.a}`).join("\n")}

Their question: ${q}

Answer in the user's language, like a patient friend: 1-4 short sentences, plain words, a tiny example in \`backticks\` if it helps. If they ask what something is, say what it does and why it's used here.
Respond with ONLY JSON: {"answer": "..."}`,
      { maxTokens: 800 },
    ),
  );
  const answer = str(data.answer, 1200);
  if (!answer) return { error: t("No se ha podido contactar con la IA ahora mismo") };
  await budget.charge();
  return { error: null, answer };
}
