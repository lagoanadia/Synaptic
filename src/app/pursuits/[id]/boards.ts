"use server";

import { prisma } from "@/lib/prisma";
import { requirePursuitAccess } from "@/lib/access";
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
