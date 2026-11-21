"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { newAgentToken, replan } from "@/lib/driveAgent";
import { driveId, readConfig } from "@/lib/driveAgentPlan";
import { agentManifest, agentScript, type AgentMode } from "@/lib/driveAgentScript";
import type { Prisma } from "@/generated/prisma/client";

async function me() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("No has iniciado sesión");
  return session.user.id;
}
const done = () => revalidatePath("/drive");

// A fresh script (with a new token: an older copy stops working).
export async function makeScript(mode: AgentMode = "gmail"): Promise<{ script: string; manifest: string }> {
  const userId = await me();
  const token = await newAgentToken(userId);
  const h = await headers();
  const base = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
  done();
  return { script: agentScript(base, token), manifest: agentManifest(mode === "classroom" ? "classroom" : "gmail") };
}

async function updateConfig(userId: string, change: (c: ReturnType<typeof readConfig>) => void) {
  const agent = await prisma.driveAgent.findUnique({ where: { userId } });
  if (!agent) throw new Error("Primero instala el script");
  const config = readConfig(agent.config);
  change(config);
  await prisma.driveAgent.update({ where: { userId }, data: { config: config as unknown as Prisma.InputJsonValue } });
}

export async function saveSettings(data: { studentNames: string; links: string; autoApply: boolean; pages: boolean }) {
  const userId = await me();
  await updateConfig(userId, (c) => {
    c.studentNames = data.studentNames.split(/[,\n]/).map((s) => s.trim()).filter((s) => s.length > 1).slice(0, 10);
    c.extraIds = [...new Set(data.links.split(/\s+/).map(driveId).filter((x): x is string => !!x))].slice(0, 500);
    c.pages = data.pages;
  });
  await prisma.driveAgent.update({ where: { userId }, data: { autoApply: data.autoApply } });
  await replan(userId);
  done();
}

// A Classroom course (or class folder) → its subject; "" = not a subject
// (its files are left alone); null = let Synaptic guess again.
export async function setCourse(course: string, subject: string | null) {
  const userId = await me();
  await updateConfig(userId, (c) => {
    if (subject === null) delete c.courses[course];
    else c.courses[course.slice(0, 120)] = subject;
  });
  await prisma.driveSource.updateMany({ where: { userId, course, status: { in: ["skipped", "review", "planned"] } }, data: { status: "planned" } });
  await replan(userId);
  done();
}

// A file the name doesn't place: its unit / subject, or leave it alone.
export async function fixSource(sourceId: string, fix: { unit?: number | null; subject?: string | null; skip?: boolean }) {
  const userId = await me();
  await updateConfig(userId, (c) => {
    const o = { ...(c.overrides[sourceId] ?? {}) };
    if (fix.unit !== undefined) o.unit = fix.unit && fix.unit > 0 && fix.unit < 50 ? Math.round(fix.unit) : undefined;
    if (fix.subject !== undefined) o.subject = fix.subject || undefined;
    if (fix.skip !== undefined) o.skip = fix.skip || undefined;
    c.overrides[sourceId] = o;
  });
  // Un-skip / re-decide: let replan place it again.
  await prisma.driveSource.updateMany({ where: { userId, sourceId, status: { in: ["skipped", "review"] } }, data: { status: "planned" } });
  await replan(userId);
  done();
}

// "Aplicar": everything planned goes on the next run.
export async function approveAll() {
  const userId = await me();
  await replan(userId, { approveAll: true });
  done();
}

// A topic whose page failed (no folder yet, AI busy…): try again.
export async function retryPage(sourceId: string) {
  const userId = await me();
  await prisma.driveSource.updateMany({ where: { userId, sourceId, pageStatus: "error" }, data: { pageStatus: null, pageError: null } });
  done();
}

export async function retry(sourceId: string) {
  const userId = await me();
  await prisma.driveSource.updateMany({ where: { userId, sourceId, status: "error" }, data: { status: "approved", error: null } });
  done();
}

// Undo one change, or every change of a run: the script does it next hour.
export async function undo(target: { changeId?: string; runId?: string }) {
  const userId = await me();
  const where = target.changeId ? { userId, id: target.changeId } : { userId, runId: target.runId ?? "-" };
  const changes = await prisma.driveChange.findMany({ where: { ...where, undo: null }, select: { id: true, sourceId: true, action: true } });
  await prisma.driveChange.updateMany({ where: { id: { in: changes.map((c) => c.id) } }, data: { undo: "requested" } });
  // Don't put them back on the next run.
  // Taking a draft out of the bin isn't undoing the file it made way for.
  const ids = changes.filter((c) => c.action !== "trash").map((c) => c.sourceId).filter((x): x is string => !!x);
  await updateConfig(userId, (c) => ids.forEach((id) => (c.overrides[id] = { ...(c.overrides[id] ?? {}), skip: true })));
  await prisma.driveSource.updateMany({ where: { userId, sourceId: { in: ids } }, data: { status: "skipped", reason: "deshecho" } });
  done();
}
