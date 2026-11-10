"use server";

import { getT } from "@/lib/i18n/server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { aiBudget } from "@/lib/access";
import { addNamedConcept } from "@/lib/autoMap";
import { answerQuestion, deepen, writeConceptQuiz } from "@/lib/internalizeAi";
import { quizVerdict, type QuizQuestion } from "@/lib/conceptQuiz";
import { statusAfterCheck, statusAfterOpen, statusAfterReview, type Status } from "@/lib/internalize";

type Result<T = object> = ({ error: string } & Partial<T>) | ({ error: null } & T);

// A concept, only if the signed-in user can see its pursuit.
async function conceptWithAccess(conceptId: string) {
  const t = await getT();
  const session = await auth();
  if (!session?.user?.id) throw new Error(t("No has iniciado sesión"));
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
  if (!concept) throw new Error(t("Concepto no encontrado"));
  return { session, concept };
}

const mapPath = (pursuitId: string, mapId: string) => `/pursuits/${pursuitId}/learn/${mapId}`;

async function setStatus(conceptId: string, status: Status) {
  await prisma.concept.update({ where: { id: conceptId }, data: { status, statusAt: new Date() } });
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
  const t = await getT();
  const { session, concept } = await conceptWithAccess(conceptId);
  const existing = await prisma.concept.count({ where: { parentId: conceptId } });
  if (existing > 0) return { error: null, count: existing };
  const budget = await aiBudget(session.user!.id!, session.user!.email);
  const limited = await budget.check();
  if (limited) return { error: limited };

  const children = await deepen(concept, concept.map.sourceText, concept.map.language);
  if (children.length === 0) return { error: t("Ahora mismo no he podido dividirlo más") };
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
  const t = await getT();
  const q = question.trim().slice(0, 500);
  if (!q) return { error: t("Pregunta algo primero") };
  const { session, concept } = await conceptWithAccess(conceptId);
  const budget = await aiBudget(session.user!.id!, session.user!.email);
  const limited = await budget.check();
  if (limited) return { error: limited };
  const answer = await answerQuestion(concept, q, concept.map.sourceText, concept.map.language);
  if (!answer) return { error: t("No se ha podido contactar con la IA ahora mismo") };
  await budget.charge();
  return { error: null, answer };
}

// ─── Quiz: a short mixed exam on a concept ─────────────────────────────

export async function makeConceptQuiz(conceptId: string): Promise<Result<{ questions: QuizQuestion[] }>> {
  const t = await getT();
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
  if (questions.length < 3) return { error: t("No he podido escribir el examen — inténtalo de nuevo") };
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
  const t = await getT();
  const session = await auth();
  if (!session?.user?.id) throw new Error(t("No has iniciado sesión"));
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


// The map's +: a concept by name, explained from the unit's notes.
export async function addConceptByName(mapId: string, text: string): Promise<Result<{ conceptId: string }>> {
  const t = await getT();
  const session = await auth();
  if (!session?.user?.id) return { error: t("No has iniciado sesión") };
  const map = await prisma.conceptMap.findUnique({ where: { id: mapId }, select: { pursuitId: true } });
  if (!map) return { error: t("Mapa no encontrado") };
  const r = await addNamedConcept(session.user.id, map.pursuitId, { mapId }, text);
  if (r.error !== null) return { error: r.error };
  revalidatePath(mapPath(map.pursuitId, mapId));
  return { error: null, conceptId: r.conceptId };
}
