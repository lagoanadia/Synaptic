import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { accessiblePursuits } from "@/lib/reviewData";
import { folderColor, folderCover } from "@/lib/covers";
import { dayOf, type ProjectItem } from "@/lib/projects";

const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

const select = {
  id: true,
  title: true,
  cover: true,
  status: true,
  startDate: true,
  dueDate: true,
  tasks: { orderBy: [{ order: "asc" }, { createdAt: "asc" }], select: { id: true, title: true, status: true, dueDate: true, order: true, doneAt: true } },
} satisfies Prisma.PursuitSelect;

type Row = {
  id: string;
  title: string;
  cover: string | null;
  status: string;
  startDate: Date | null;
  dueDate: Date | null;
  tasks: { id: string; title: string; status: "TODO" | "IN_PROGRESS" | "DONE"; dueDate: Date | null; order: number; doneAt: Date | null }[];
};

function toItem(p: Row): ProjectItem & { doneToday: Set<string> } {
  const today = dayOf(new Date());
  return {
    id: p.id,
    title: p.title,
    cover: folderCover(p.id, p.cover),
    color: folderColor(p.id, p.cover),
    startDate: day(p.startDate),
    dueDate: day(p.dueDate),
    finished: p.status === "DONE",
    tasks: p.tasks.map((t) => ({ id: t.id, title: t.title, status: t.status, dueDate: day(t.dueDate), order: t.order, pursuitId: p.id })),
    doneToday: new Set(p.tasks.filter((t) => t.doneAt && dayOf(t.doneAt) === today).map((t) => t.id)),
  };
}

// The projects (folders) of one notebook.
export async function notebookProjects(userId: string, sectionId: string) {
  const rows = await prisma.pursuit.findMany({ where: { AND: [accessiblePursuits(userId), { sectionId }] }, orderBy: { createdAt: "asc" }, select });
  return rows.map(toItem);
}

export async function oneProject(userId: string, pursuitId: string) {
  const row = await prisma.pursuit.findFirst({ where: { AND: [accessiblePursuits(userId), { id: pursuitId }] }, select });
  return row ? toItem(row) : null;
}

// Every project of yours, from notebooks without study tools (and any
// folder that already has tasks).
export async function allProjects(userId: string) {
  const rows = await prisma.pursuit.findMany({
    where: { AND: [accessiblePursuits(userId), { OR: [{ section: { study: false } }, { tasks: { some: {} } }] }] },
    orderBy: { createdAt: "asc" },
    select,
  });
  return rows.map(toItem);
}
