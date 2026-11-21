import "server-only";
import { prisma } from "./prisma";
import { subjectOf } from "./materialName";
import { readConfig, type Target } from "./driveAgentPlan";

// Per unit of a subject, what "Unificar con Drive" placed in its Entrega
// folder: the teacher's assignment, the student's handed-in work and the
// reference code. Drive file ids, opened in Drive.
export type UnitDelivery = {
  unit: number;
  statement: string | null;
  submission: string | null;
  code: { id: string; name: string }[];
};

// The first time a folder has deliveries, "Mis entregas" joins its blocks
// (once: if the student removes it, it stays removed).
export async function offerDeliveryBlock(userId: string, pursuitId: string, blocks: { id: string; type: string }[]) {
  const agent = await prisma.driveAgent.findUnique({ where: { userId }, select: { config: true } });
  if (!agent) return blocks;
  const config = readConfig(agent.config);
  if (config.offered.includes(pursuitId) || blocks.some((b) => b.type === "delivery")) return blocks;
  const next = [...blocks, { id: "delivery", type: "delivery" }];
  await prisma.$transaction([
    prisma.pursuit.update({ where: { id: pursuitId }, data: { blocks: next } }),
    prisma.driveAgent.update({ where: { userId }, data: { config: { ...config, offered: [...config.offered, pursuitId] } } }),
  ]);
  return next;
}

export async function unitDeliveries(userId: string, folderTitle: string): Promise<UnitDelivery[]> {
  const agent = await prisma.driveAgent.findUnique({ where: { userId }, select: { config: true } });
  if (!agent) return [];
  const subject = subjectOf(folderTitle, readConfig(agent.config).folders);
  if (!subject) return [];
  const rows = await prisma.driveSource.findMany({ where: { userId, status: "done", outputId: { not: null } }, orderBy: { createdAt: "asc" }, select: { placement: true, outputId: true } });
  const units = new Map<number, UnitDelivery>();
  for (const r of rows) {
    const p = r.placement as Target | null;
    if (!p || p.subject !== subject || !["statement", "submission", "code"].includes(p.kind)) continue;
    const n = Number(/^UD(\d+)$/.exec(p.folder[1] ?? "")?.[1]);
    if (!n) continue;
    const u = units.get(n) ?? { unit: n, statement: null, submission: null, code: [] };
    if (p.kind === "statement") u.statement = r.outputId;
    else if (p.kind === "submission") u.submission = r.outputId;
    else if (!u.code.some((c) => c.name === p.name)) u.code.push({ id: r.outputId!, name: p.name });
    units.set(n, u);
  }
  return [...units.values()].sort((a, b) => a.unit - b.unit);
}
