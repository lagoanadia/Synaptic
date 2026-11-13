"use server";

import { prisma } from "@/lib/prisma";
import { aiBudget, requirePursuitAccess } from "@/lib/access";
import { askJson } from "@/lib/ai";
import { getT } from "@/lib/i18n/server";
import { cleanMindMap, layoutMindMap } from "@/lib/mindmap";
import { cleanShapes } from "@/lib/whiteboard";

// "/ Pizarra": a new empty board in this folder; the page stores its URL.
export async function createBoard(pursuitId: string): Promise<string> {
  await requirePursuitAccess(pursuitId);
  const b = await prisma.whiteboard.create({ data: { pursuitId, data: [] } });
  return `/api/boards/${b.id}`;
}

export async function saveBoard(id: string, shapes: unknown) {
  const b = await prisma.whiteboard.findUnique({ where: { id }, select: { pursuitId: true } });
  if (!b) return;
  await requirePursuitAccess(b.pursuitId);
  await prisma.whiteboard.update({ where: { id }, data: { data: cleanShapes(shapes) } });
}

// The toolbar's mind map: the AI reads the page and returns topic → ideas →
// details; it becomes a whiteboard (editable boxes + connectors) in the page.
export async function generateMindMap(pursuitId: string, notes: string): Promise<{ error: string | null; src?: string }> {
  const t = await getT();
  const { userId, session } = await requirePursuitAccess(pursuitId);
  const text = notes.replace(/!\[[^\]]*\]\([^)]*\)/g, "").trim();
  if (text.length < 40) return { error: t("Escribe algo más en la página para hacer un mapa mental") };
  const budget = await aiBudget(userId, session.user?.email);
  const limited = await budget.check();
  if (limited) return { error: limited };
  const map = cleanMindMap(
    await askJson(
      `Make a mind map of the student's NOTES below, using only what they contain.
- "center": the topic in 1-4 words
- 3-6 "branches": the main ideas, 1-3 words each, in the order they appear
- each branch: 0-4 "children": key details, 1-4 words each (terms, examples, values) — no sentences
Write in the notes' language. Respond with ONLY JSON: {"center": "...", "branches": [{"label": "...", "children": ["..."]}]}

NOTES:
${text.slice(0, 20000)}`,
      { maxTokens: 1500 },
    ),
  );
  if (!map) return { error: t("No se ha podido contactar con la IA ahora mismo") };
  await budget.charge();
  const b = await prisma.whiteboard.create({ data: { pursuitId, data: cleanShapes(layoutMindMap(map)) } });
  return { error: null, src: `/api/boards/${b.id}` };
}
