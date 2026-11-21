import "server-only";
// "Unificar con Drive", database side: the script's token, the plan it
// gets each hour, what it reports back, and undo. Decisions: driveAgentPlan.ts.
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "./prisma";
import type { Prisma } from "@/generated/prisma/client";
import { readConfig, resolve, type Candidate, type Target } from "./driveAgentPlan";

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

// A new token for the student's script (shown once, in the script itself).
export async function newAgentToken(userId: string): Promise<string> {
  const token = `syn_${randomBytes(24).toString("base64url")}`;
  await prisma.driveAgent.upsert({ where: { userId }, create: { userId, tokenHash: hashToken(token) }, update: { tokenHash: hashToken(token) } });
  return token;
}

export async function agentFor(token: string | null) {
  if (!token || !token.startsWith("syn_")) return null;
  const agent = await prisma.driveAgent.findUnique({ where: { tokenHash: hashToken(token) } });
  if (agent) await prisma.driveAgent.update({ where: { id: agent.id }, data: { lastSeenAt: new Date() } });
  return agent;
}

const asTarget = (j: unknown) => (j && typeof j === "object" ? (j as Target) : null);

// Re-decides every source of a user (after new files, a config change or an
// approval) and saves what changed.
export async function replan(userId: string, opts: { approveAll?: boolean } = {}) {
  const agent = await prisma.driveAgent.findUnique({ where: { userId } });
  if (!agent) return;
  const config = readConfig(agent.config);
  const rows = await prisma.driveSource.findMany({ where: { userId } });
  const resolved = resolve(
    rows.map((r) => ({ id: r.sourceId, name: r.name, mimeType: r.mimeType, createdAt: r.createdAt, course: r.course, submission: asTarget(r.placement)?.kind === "submission" && !!r.placement, status: opts.approveAll && r.status === "planned" ? "approved" : r.status })),
    config,
    agent.autoApply || !!opts.approveAll,
  );
  const byId = new Map(rows.map((r) => [r.sourceId, r]));
  await prisma.$transaction(
    resolved
      .filter((s) => {
        const r = byId.get(s.id)!;
        return r.status !== s.status || JSON.stringify(r.placement) !== JSON.stringify(s.target) || r.reason !== (s.reason ?? null);
      })
      .map((s) => prisma.driveSource.update({ where: { userId_sourceId: { userId, sourceId: s.id } }, data: { status: s.status, placement: (s.target ?? undefined) as Prisma.InputJsonValue | undefined, reason: s.reason ?? null } })),
  );
}

export type ScriptAction = { id: string; target: Target };

// The script's hourly call: here are the files I found; what do I do?
export async function plan(userId: string, found: Candidate[]): Promise<ScriptAction[]> {
  const known = new Set((await prisma.driveSource.findMany({ where: { userId, sourceId: { in: found.map((f) => f.id) } }, select: { sourceId: true } })).map((r) => r.sourceId));
  const fresh = found.filter((f) => !known.has(f.id)).slice(0, 300);
  if (fresh.length)
    await prisma.driveSource.createMany({
      data: fresh.map((f) => ({ userId, sourceId: f.id, name: f.name.slice(0, 300), mimeType: f.mimeType ?? null, createdAt: f.createdAt, course: f.course ?? null, status: "planned", placement: f.submission ? ({ kind: "submission" } as Prisma.InputJsonValue) : undefined })),
      skipDuplicates: true,
    });
  await replan(userId);
  const todo = await prisma.driveSource.findMany({ where: { userId, status: "approved" }, orderBy: { createdAt: "asc" }, take: 25 });
  return todo.map((r) => ({ id: r.sourceId, target: asTarget(r.placement)! })).filter((a) => a.target?.folder);
}

// trashed: the student's drafts the script put in the bin once the
// official submission arrived (undo takes them back out).
// text: a topic's text (phase d). textOnly: just that, for a topic placed
// before (nothing else changes).
export type Report = { id: string; ok: boolean; error?: string; outputId?: string; path?: string; oldId?: string | null; trashed?: { id: string; path: string }[]; text?: string | null; textOnly?: boolean };

// The script did (or failed) these; log every change for undo.
export async function report(userId: string, runId: string, results: Report[], undone: string[]) {
  const pages = readConfig((await prisma.driveAgent.findUnique({ where: { userId }, select: { config: true } }))?.config).pages;
  for (const r of results.slice(0, 100)) {
    const text = typeof r.text === "string" && r.text.trim().length > 200 ? r.text.slice(0, 30000) : null;
    if (r.textOnly) {
      await prisma.driveSource.updateMany({ where: { userId, sourceId: r.id, noteId: null }, data: text && pages ? { text, pageStatus: "pending" } : { pageStatus: "skipped" } });
      continue;
    }
    if (r.ok && text && pages) await prisma.driveSource.updateMany({ where: { userId, sourceId: r.id }, data: { text, pageStatus: "pending" } });
    await prisma.driveSource.updateMany({
      where: { userId, sourceId: r.id },
      data: r.ok ? { status: "done", outputId: r.outputId ?? null, error: null } : { status: "error", error: (r.error ?? "error").slice(0, 300) },
    });
    if (r.ok && r.outputId && r.path)
      await prisma.driveChange.create({ data: { userId, runId, action: r.oldId ? "replace" : "create", path: r.path.slice(0, 500), fileId: r.outputId, oldId: r.oldId ?? null, sourceId: r.id } });
    const drafts = (Array.isArray(r.trashed) ? r.trashed : []).filter((d) => d && typeof d.id === "string" && typeof d.path === "string").slice(0, 50);
    if (r.ok && drafts.length)
      await prisma.driveChange.createMany({ data: drafts.map((d) => ({ userId, runId, action: "trash", path: d.path.slice(0, 500), fileId: d.id.slice(0, 100), sourceId: r.id })) });
  }
  if (undone.length) await prisma.driveChange.updateMany({ where: { userId, id: { in: undone.slice(0, 200) } }, data: { undo: "done" } });
}

// Topics placed before pages existed: the script sends their text (a few per run).
export async function needText(userId: string) {
  const agent = await prisma.driveAgent.findUnique({ where: { userId }, select: { config: true } });
  if (!readConfig(agent?.config).pages) return [];
  const rows = await prisma.driveSource.findMany({
    where: { userId, status: "done", outputId: { not: null }, pageStatus: null, OR: [{ placement: { path: ["kind"], equals: "topic" } }, { placement: { path: ["kind"], equals: "session" } }] },
    orderBy: { createdAt: "asc" },
    take: 5,
    select: { sourceId: true, outputId: true },
  });
  return rows.map((r) => ({ id: r.sourceId, fileId: r.outputId! }));
}

// Undo requests waiting for the script.
export const pendingUndo = (userId: string) =>
  prisma.driveChange.findMany({ where: { userId, undo: "requested" }, select: { id: true, action: true, fileId: true, oldId: true, sourceId: true }, take: 100 });
