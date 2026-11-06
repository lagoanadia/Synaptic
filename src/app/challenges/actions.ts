"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { aiBudget } from "@/lib/access";
import { arr, askJson, obj, str } from "@/lib/ai";
import { shuffle } from "@/lib/review";
import { asLanguage, formatReview, LANGUAGE_INFO, parseChallenge, type ChallengeDraft, type ChallengeTest, type Language } from "@/lib/challenge";
import { accessiblePursuits } from "@/lib/reviewData";

// No code ever runs on the server. The server drafts a challenge (with a
// reference solution); the browser checks that solution in its sandbox and
// saves only the tests it passes.

async function signedIn() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not signed in");
  return { userId: session.user.id, email: session.user.email };
}

export type DraftForBrowser = ChallengeDraft & {
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
    select: { title: true },
  });
  const taken = existing.map((c) => c.title);

  const data = obj(
    await askJson(
      `Create THREE different small coding challenges in ${LANGUAGE_INFO[language].label} for someone getting back into coding after a break. Difficulty: ${difficulty} (easy = 5-15 lines, medium = loops/conditions/data structures, hard = a small algorithm).
${context}
${topic ? `Topic requested: ${topic}.` : ""}
Each of the three must practice a DIFFERENT idea (ideally from a different note), and none may be the same as or a variant of these existing challenges: ${taken.length ? taken.map((t) => `"${t}"`).join(", ") : "(none yet)"}.

${SHAPE[language]}

Respond with ONLY JSON: {"challenges": [
  {
    "title": "short title",
    "prompt": "the task in plain language: what the function receives and returns, 1-2 examples. In the learner's language if the notes aren't English.",
    "entry": "functionName",
    "starter_code": "the function signature with a placeholder body and a short comment",
    "tests": [{"args": [...], "expected": ...}],
    "solution": "a correct reference solution",
    "based_on": "title of the note it practices, or null"
  }
]}
5-8 tests each, normal and edge cases. Only JSON values in args/expected.`,
      { maxTokens: 9000 },
    ),
  );
  const seen = new Set(taken.map(titleKey));
  const drafts: DraftForBrowser[] = [];
  for (const raw of arr(data.challenges)) {
    const draft = parseChallenge(raw);
    if (!draft || seen.has(titleKey(draft.title))) continue;
    seen.add(titleKey(draft.title));
    const basedOn = str(obj(raw).based_on, 120);
    const prompt = basedOn ? `From your note “${basedOn}”\n\n${draft.prompt}` : draft.prompt;
    drafts.push({ ...draft, prompt, language, difficulty, pursuitId });
  }
  if (drafts.length === 0) return { error: "The AI made broken challenges — try again" };
  await budget.charge();
  return { error: null, drafts };
}

// How each language's challenges are tested, for the prompt.
const SHAPE: Record<Language, string> = {
  javascript: "Each must be solvable as ONE pure function (no input, files, network or randomness), tested by calling it with arguments and comparing the JSON-serializable return value.",
  typescript: "Each must be solvable as ONE pure, typed function (typed parameters and return type; no input, files, network or randomness), tested by calling it with arguments and comparing the JSON-serializable return value. starter_code and solution are TypeScript.",
  python: "Each must be solvable as ONE pure function (no input(), files, network or randomness), tested by calling it with arguments and comparing the JSON-serializable return value.",
  react: `Each is ONE React function component (named "entry", may use hooks like useState/useMemo, written with JSX, may \`import { useState } from "react"\`; no fetch, effects that change what renders, timers or CSS). It is tested by rendering it ONCE with props: each test is {"args": [props object], "expected": "the visible text it renders"} — text only (tags removed, whitespace collapsed), e.g. a list of items renders "Milk Eggs Bread". Make tests cover different props: empty lists, conditional text, counts, formatting.`,
};

// "Mezcla de colores (RGB)" and "Mezcla de colores RGB" are the same challenge.
const titleKey = (t: string) =>
  t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

export async function saveChallenge(
  draft: DraftForBrowser,
  passingTests: ChallengeTest[],
): Promise<{ error: string | null; id?: string }> {
  const { userId } = await signedIn();
  // Re-validated: it came back from the browser.
  const clean = parseChallenge({ ...draft, starter_code: draft.starterCode, tests: passingTests });
  if (!clean) return { error: "The AI made a broken challenge — try again" };
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
  const { userId, email } = await signedIn();
  const challenge = await prisma.challenge.findFirst({ where: { id, userId } });
  if (!challenge) return { error: "Challenge not found" };
  if (code.trim().length < 10) return { error: "Write some code first" };
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
- "next": one or two things to try or learn next
Each point: ONE short sentence (max ~12 words). Put code in \`backticks\`. No full solutions.

Respond with ONLY JSON: {"good": ["..."], "fix": ["..."], "next": ["..."]}`,
      { maxTokens: 2000 },
    ),
  );
  const points = (v: unknown) => arr(v).map((x) => str(x, 300)).filter(Boolean).slice(0, 3);
  const review = formatReview({ good: points(data.good), fix: points(data.fix), next: points(data.next) });
  if (!review) return { error: "Couldn't reach the AI right now" };
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
  const { userId, email } = await signedIn();
  const challenge = await prisma.challenge.findFirst({ where: { id, userId } });
  if (!challenge) return { error: "Challenge not found" };
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
  if (!hint) return { error: "Couldn't reach the AI right now" };
  await budget.charge();
  return { error: null, hint };
}
