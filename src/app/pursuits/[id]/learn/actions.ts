"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { aiBudget, requirePursuitAccess } from "@/lib/access";
import {
  MAX_SOURCE_CHARS,
  answerQuestion,
  breakDown,
  deepen,
  readRepo,
  writeConceptQuiz,
} from "@/lib/internalizeAi";
import { quizVerdict, type QuizQuestion } from "@/lib/conceptQuiz";
import { statusAfterCheck, statusAfterOpen, statusAfterReview, type Status } from "@/lib/internalize";

type Result<T = object> = ({ error: string } & Partial<T>) | ({ error: null } & T);

// A concept, only if the signed-in user can see its pursuit.
async function conceptWithAccess(conceptId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not signed in");
  const concept = await prisma.concept.findFirst({
    where: {
      id: conceptId,
      map: {
        pursuit: {
          OR: [{ ownerId: session.user.id }, { members: { some: { userId: session.user.id } } }],
        },
      },
    },
    include: { map: true },
  });
  if (!concept) throw new Error("Concept not found");
  return { session, concept };
}

const mapPath = (pursuitId: string, mapId: string) => `/pursuits/${pursuitId}/learn/${mapId}`;

async function setStatus(conceptId: string, status: Status) {
  await prisma.concept.update({ where: { id: conceptId }, data: { status, statusAt: new Date() } });
}

export async function createConceptMap(
  pursuitId: string,
  input: { kind: "text" | "pdf" | "pptx" | "notes" | "repo"; text?: string; ref?: string; language: string },
): Promise<Result<{ mapId: string }>> {
  const { session, userId } = await requirePursuitAccess(pursuitId);
  const budget = await aiBudget(userId, session.user.email);
  const limited = await budget.check();
  if (limited) return { error: limited };

  let source = "";
  let ref: string | null = input.ref?.slice(0, 200) ?? null;
  let hint = "";
  try {
    if (input.kind === "repo") {
      const repo = await readRepo(input.ref ?? "");
      source = repo.text;
      ref = repo.ref;
      hint = "The source is a code repository (file list + key files). Cover the architecture, the main moving parts and how a request flows through them — not every file.";
    } else if (input.kind === "notes") {
      const notes = await prisma.note.findMany({
        where: { pursuitId },
        orderBy: { createdAt: "asc" },
        select: { content: true },
      });
      source = notes.map((n) => n.content).join("\n\n---\n\n");
      ref = "Your notes";
      hint = "The source is a student's own notes on one subject.";
    } else {
      source = (input.text ?? "").trim();
      hint =
        input.kind === "pdf"
          ? "The source is text extracted from a PDF ([p3] marks page 3)."
          : input.kind === "pptx"
            ? "The source is a teacher's slide deck: each '##' is a slide title, '- ' its bullets, '!' the speaker notes. Slides are terse — fill in the reasoning between bullets, and use the slide title as excerpt_from."
            : "";
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Couldn't read that source" };
  }
  source = source.slice(0, MAX_SOURCE_CHARS);
  if (source.length < 40) return { error: "There's not enough material there to break down" };

  const language = input.language.slice(0, 30) || "English";
  const breakdown = await breakDown(source, language, hint);
  if (!breakdown) return { error: "The AI couldn't break that down right now — try again" };
  await budget.charge();

  const map = await prisma.conceptMap.create({
    data: {
      pursuitId,
      title: breakdown.title,
      sourceKind: input.kind,
      sourceRef: ref,
      sourceText: source,
      language,
    },
  });
  const idByKey = new Map<string, string>();
  for (const [order, c] of breakdown.concepts.entries()) {
    const row = await prisma.concept.create({
      data: {
        mapId: map.id,
        order,
        title: c.title,
        summary: c.summary,
        explanation: c.explanation,
        excerpt: c.excerpt,
        excerptFrom: c.excerptFrom,
      },
    });
    idByKey.set(c.key, row.id);
  }
  if (breakdown.links.length > 0) {
    await prisma.conceptLink.createMany({
      data: breakdown.links.map((l) => ({ fromId: idByKey.get(l.from)!, toId: idByKey.get(l.to)!, label: l.label })),
      skipDuplicates: true,
    });
  }
  revalidatePath(`/pursuits/${pursuitId}`);
  return { error: null, mapId: map.id };
}

export async function openConcept(conceptId: string) {
  const { concept } = await conceptWithAccess(conceptId);
  const next = statusAfterOpen(concept.status);
  if (next !== concept.status) await setStatus(conceptId, next);
}

// "I don't know" — no shame, it just goes in the reread pile.
export async function markReread(conceptId: string) {
  const { concept } = await conceptWithAccess(conceptId);
  await setStatus(conceptId, "REREAD");
  revalidatePath(mapPath(concept.map.pursuitId, concept.mapId));
}

export async function setConceptStatus(conceptId: string, status: Status) {
  const { concept } = await conceptWithAccess(conceptId);
  if (!["NEW", "SEEN", "REREAD", "UNDERSTOOD", "MASTERED"].includes(status)) return;
  await setStatus(conceptId, status);
  revalidatePath(mapPath(concept.map.pursuitId, concept.mapId));
}

// From Quiz / Recall.
export async function reviewConcept(conceptId: string, correct: boolean) {
  const { concept } = await conceptWithAccess(conceptId);
  await setStatus(conceptId, statusAfterReview(concept.status, correct));
}

export async function goDeeper(conceptId: string): Promise<Result<{ count: number }>> {
  const { session, concept } = await conceptWithAccess(conceptId);
  const existing = await prisma.concept.count({ where: { parentId: conceptId } });
  if (existing > 0) return { error: null, count: existing };
  const budget = await aiBudget(session.user!.id!, session.user!.email);
  const limited = await budget.check();
  if (limited) return { error: limited };

  const children = await deepen(concept, concept.map.sourceText, concept.map.language);
  if (children.length === 0) return { error: "Couldn't split this one further right now" };
  await budget.charge();
  for (const [order, c] of children.entries()) {
    const child = await prisma.concept.create({
      data: {
        mapId: concept.mapId,
        parentId: conceptId,
        depth: concept.depth + 1,
        order,
        title: c.title,
        summary: c.summary,
        explanation: c.explanation,
        excerpt: c.excerpt,
        excerptFrom: c.excerptFrom,
      },
    });
    await prisma.conceptLink.create({ data: { fromId: conceptId, toId: child.id, label: "part of" } });
  }
  revalidatePath(mapPath(concept.map.pursuitId, concept.mapId));
  return { error: null, count: children.length };
}

export async function askAboutConcept(conceptId: string, question: string): Promise<Result<{ answer: string }>> {
  const q = question.trim().slice(0, 500);
  if (!q) return { error: "Ask something first" };
  const { session, concept } = await conceptWithAccess(conceptId);
  const budget = await aiBudget(session.user!.id!, session.user!.email);
  const limited = await budget.check();
  if (limited) return { error: limited };
  const answer = await answerQuestion(concept, q, concept.map.sourceText, concept.map.language);
  if (!answer) return { error: "Couldn't reach the AI right now" };
  await budget.charge();
  return { error: null, answer };
}

// ─── Quiz: a short mixed exam on a concept ─────────────────────────────

export async function makeConceptQuiz(conceptId: string): Promise<Result<{ questions: QuizQuestion[] }>> {
  const { session, concept } = await conceptWithAccess(conceptId);
  const budget = await aiBudget(session.user!.id!, session.user!.email);
  const limited = await budget.check();
  if (limited) return { error: limited };
  const inside = await prisma.concept.findMany({
    where: { parentId: conceptId },
    orderBy: { order: "asc" },
    select: { title: true, explanation: true },
  });
  const questions = await writeConceptQuiz(concept, inside, concept.map.sourceText, concept.map.language);
  if (questions.length < 3) return { error: "Couldn't write a quiz right now — try again" };
  await budget.charge();
  return { error: null, questions };
}

// Grading happens in the browser; this records the result.
export async function recordConceptQuiz(conceptId: string, correct: number, total: number): Promise<Result<{ status: Status }>> {
  const { concept } = await conceptWithAccess(conceptId);
  const n = Math.max(0, Math.min(Math.floor(total), 20));
  const k = Math.max(0, Math.min(Math.floor(correct), n));
  const status = statusAfterCheck(concept.status, quizVerdict(k, n));
  await prisma.concept.update({
    where: { id: conceptId },
    data: { status, statusAt: new Date(), feedback: `Quiz: ${k}/${n}` },
  });
  revalidatePath(mapPath(concept.map.pursuitId, concept.mapId));
  return { error: null, status };
}

// ─── Editing the map by hand ───────────────────────────────────────────

export async function editConcept(
  conceptId: string,
  fields: { title: string; summary: string; explanation: string },
) {
  const { concept } = await conceptWithAccess(conceptId);
  const title = fields.title.trim().slice(0, 120);
  if (!title) return;
  await prisma.concept.update({
    where: { id: conceptId },
    data: {
      title,
      summary: fields.summary.trim().slice(0, 400),
      explanation: fields.explanation.trim().slice(0, 3000),
    },
  });
  revalidatePath(mapPath(concept.map.pursuitId, concept.mapId));
}

export async function addConcept(mapId: string, title: string, parentId: string | null) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not signed in");
  const map = await prisma.conceptMap.findFirst({
    where: { id: mapId, pursuit: { OR: [{ ownerId: session.user.id }, { members: { some: { userId: session.user.id } } }] } },
  });
  const clean = title.trim().slice(0, 120);
  if (!map || !clean) return null;
  const parent = parentId ? await prisma.concept.findFirst({ where: { id: parentId, mapId } }) : null;
  const order = await prisma.concept.count({ where: { mapId, parentId: parent?.id ?? null } });
  const concept = await prisma.concept.create({
    data: { mapId, title: clean, summary: "", explanation: "", order, depth: parent ? parent.depth + 1 : 0, parentId: parent?.id ?? null },
  });
  if (parent) await prisma.conceptLink.create({ data: { fromId: parent.id, toId: concept.id, label: "part of" } });
  revalidatePath(mapPath(map.pursuitId, mapId));
  return concept.id;
}

export async function deleteConcept(conceptId: string) {
  const { concept } = await conceptWithAccess(conceptId);
  await prisma.concept.delete({ where: { id: conceptId } });
  revalidatePath(mapPath(concept.map.pursuitId, concept.mapId));
}

export async function linkConcepts(fromId: string, toId: string, label: string | null) {
  if (fromId === toId) return;
  const { concept } = await conceptWithAccess(fromId);
  const other = await prisma.concept.findFirst({ where: { id: toId, mapId: concept.mapId } });
  if (!other) return;
  await prisma.conceptLink.upsert({
    where: { fromId_toId: { fromId, toId } },
    create: { fromId, toId, label: label?.slice(0, 30) ?? null },
    update: { label: label?.slice(0, 30) ?? null },
  });
  revalidatePath(mapPath(concept.map.pursuitId, concept.mapId));
}

export async function unlinkConcepts(fromId: string, toId: string) {
  const { concept } = await conceptWithAccess(fromId);
  await prisma.conceptLink.deleteMany({ where: { fromId, toId } });
  revalidatePath(mapPath(concept.map.pursuitId, concept.mapId));
}

export async function deleteConceptMap(pursuitId: string, mapId: string) {
  await requirePursuitAccess(pursuitId);
  await prisma.conceptMap.deleteMany({ where: { id: mapId, pursuitId } });
  revalidatePath(`/pursuits/${pursuitId}`);
}
