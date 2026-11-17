"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { aiBudget } from "@/lib/access";
import { askJson } from "@/lib/ai";
import { getT } from "@/lib/i18n/server";

async function me() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No autorizado");
  return { id: session.user.id, email: session.user.email ?? null };
}

// A finished test, kept to take again: the questions exactly as they were.
export async function saveTest(input: { title: string; kind: "quiz" | "final"; pursuitId: string | null; unitId: string | null; items: unknown[]; score: number }): Promise<string | null> {
  const user = await me();
  if (!Array.isArray(input.items) || input.items.length === 0) return null;
  const items = input.items.slice(0, 100);
  if (JSON.stringify(items).length > 400_000) return null;
  const pursuit = input.pursuitId ? await prisma.pursuit.findFirst({ where: { id: input.pursuitId, OR: [{ ownerId: user.id }, { members: { some: { userId: user.id } } }] }, select: { id: true } }) : null;
  const score = Math.max(0, Math.min(Math.round(input.score), items.length * 2));
  const test = await prisma.savedTest.create({
    data: {
      userId: user.id,
      title: input.title.trim().slice(0, 80) || "Test",
      kind: input.kind === "final" ? "final" : "quiz",
      pursuitId: pursuit?.id ?? null,
      unitId: pursuit ? (input.unitId ?? null) : null,
      items: items as object[],
      total: items.length,
      attempts: 1,
      lastScore: score,
      bestScore: score,
    },
    select: { id: true },
  });
  revalidatePath("/review/tests");
  return test.id;
}

// Took a saved test again: last and best score.
export async function recordTestScore(id: string, score: number) {
  const user = await me();
  const test = await prisma.savedTest.findFirst({ where: { id, userId: user.id }, select: { bestScore: true, total: true, kind: true } });
  if (!test) return;
  const max = test.kind === "final" ? test.total * 2 : test.total;
  const s = Math.max(0, Math.min(Math.round(score), max));
  await prisma.savedTest.update({ where: { id }, data: { attempts: { increment: 1 }, lastScore: s, bestScore: Math.max(test.bestScore ?? 0, s) } });
  revalidatePath("/review/tests");
}

export async function deleteTest(id: string) {
  const user = await me();
  await prisma.savedTest.deleteMany({ where: { id, userId: user.id } });
  revalidatePath("/review/tests");
}

export async function renameTest(id: string, title: string) {
  const user = await me();
  const clean = title.trim().slice(0, 80);
  if (!clean) return;
  await prisma.savedTest.updateMany({ where: { id, userId: user.id }, data: { title: clean } });
  revalidatePath("/review/tests");
}

export type Grade = { score: 0 | 1 | 2; feedback: string; missing: string };

// Marks one written answer against the notes' answer: 2 right (even in other
// words), 1 partly, 0 wrong or empty, with a line on what's missing. One AI
// use is charged per test (on its first question).
export async function gradeAnswer(input: { prompt: string; reference: string; written: string; first: boolean }): Promise<{ error: string | null; grade?: Grade }> {
  const t = await getT();
  const user = await me();
  const written = input.written.trim().slice(0, 3000);
  if (!written) return { error: null, grade: { score: 0, feedback: t("Sin respuesta."), missing: input.reference.slice(0, 400) } };
  const budget = await aiBudget(user.id, user.email);
  if (input.first) {
    const over = await budget.check();
    if (over) return { error: over };
  }
  const out = (await askJson(
    `Eres un profesor que corrige un examen de respuesta escrita. Compara la respuesta del alumno con la respuesta de referencia (sacada de sus apuntes).
Pregunta: ${input.prompt.slice(0, 1500)}
Respuesta de referencia: ${input.reference.slice(0, 2500)}
Respuesta del alumno: ${written}

Puntúa con criterio, no palabra por palabra: si dice lo mismo con otras palabras o con un ejemplo correcto, está bien.
- 2: correcta y suficientemente completa.
- 1: va bien encaminada pero le falta algo importante o tiene un error menor.
- 0: incorrecta, vacía o no responde a la pregunta.
Responde en el idioma de la pregunta, en JSON: {"score": 0|1|2, "feedback": "una o dos frases dirigidas al alumno (tú) sobre su respuesta", "missing": "lo que le faltó o corregiría, breve; vacío si nada"}`,
    { maxTokens: 600 },
  )) as { score?: unknown; feedback?: unknown; missing?: unknown } | null;
  if (!out) return { error: t("No he podido corregirla ahora. Inténtalo otra vez.") };
  if (input.first) await budget.charge();
  const score = out.score === 2 || out.score === "2" ? 2 : out.score === 1 || out.score === "1" ? 1 : 0;
  return { error: null, grade: { score, feedback: String(out.feedback ?? "").slice(0, 600), missing: String(out.missing ?? "").slice(0, 600) } };
}
