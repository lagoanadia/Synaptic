"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { accessiblePursuits } from "@/lib/reviewData";
import type { TaskStatus } from "@/lib/projects";

const STATUSES: TaskStatus[] = ["TODO", "IN_PROGRESS", "DONE"];
const date = (v: string | null | undefined) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T00:00:00Z`) : null);

async function userId() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No has iniciado sesión");
  return session.user.id;
}
async function canProject(uid: string, pursuitId: string) {
  return !!(await prisma.pursuit.findFirst({ where: { AND: [accessiblePursuits(uid), { id: pursuitId }] }, select: { id: true } }));
}
const taskWhere = (uid: string, id: string) => ({ id, pursuit: accessiblePursuits(uid) });
const refresh = () => revalidatePath("/pursuits", "layout");

export async function addTask(pursuitId: string, title: string, status: TaskStatus = "TODO", dueDate: string | null = null) {
  const uid = await userId();
  const t = title.replace(/\s+/g, " ").trim().slice(0, 200);
  if (!t || !STATUSES.includes(status) || !(await canProject(uid, pursuitId))) return null;
  const last = await prisma.task.aggregate({ where: { pursuitId, status }, _max: { order: true } });
  const task = await prisma.task.create({
    data: { pursuitId, title: t, status, order: (last._max.order ?? 0) + 1, dueDate: date(dueDate), doneAt: status === "DONE" ? new Date() : null },
  });
  refresh();
  return task.id;
}

export async function updateTask(id: string, data: { title?: string; status?: TaskStatus; dueDate?: string | null }) {
  const uid = await userId();
  const task = await prisma.task.findFirst({ where: taskWhere(uid, id), select: { status: true } });
  if (!task) return;
  const title = data.title?.replace(/\s+/g, " ").trim().slice(0, 200);
  const status = data.status && STATUSES.includes(data.status) ? data.status : undefined;
  await prisma.task.update({
    where: { id },
    data: {
      ...(title ? { title } : {}),
      ...(status ? { status, doneAt: status === "DONE" ? (task.status === "DONE" ? undefined : new Date()) : null } : {}),
      ...(data.dueDate !== undefined ? { dueDate: date(data.dueDate) } : {}),
    },
  });
  refresh();
}

// A column after a drag: its tasks in order (and their new status).
export async function setColumn(status: TaskStatus, ids: string[]) {
  const uid = await userId();
  if (!STATUSES.includes(status)) return;
  const mine = await prisma.task.findMany({ where: { id: { in: ids.slice(0, 500) }, pursuit: accessiblePursuits(uid) }, select: { id: true, status: true } });
  const was = new Map(mine.map((t) => [t.id, t.status]));
  await prisma.$transaction(
    ids
      .filter((id) => was.has(id))
      .map((id, order) =>
        prisma.task.update({ where: { id }, data: { order, status, ...(was.get(id) !== status ? { doneAt: status === "DONE" ? new Date() : null } : {}) } }),
      ),
  );
  refresh();
}

export async function deleteTask(id: string) {
  const uid = await userId();
  await prisma.task.deleteMany({ where: taskWhere(uid, id) });
  refresh();
}

export async function setProjectInfo(pursuitId: string, data: { startDate?: string | null; dueDate?: string | null; finished?: boolean }) {
  const uid = await userId();
  if (!(await canProject(uid, pursuitId))) return;
  await prisma.pursuit.update({
    where: { id: pursuitId },
    data: {
      ...(data.startDate !== undefined ? { startDate: date(data.startDate) } : {}),
      ...(data.dueDate !== undefined ? { dueDate: date(data.dueDate) } : {}),
      ...(data.finished !== undefined ? { status: data.finished ? "DONE" : "ACTIVE" } : {}),
    },
  });
  refresh();
}
