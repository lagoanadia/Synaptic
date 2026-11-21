import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getT } from "@/lib/i18n/server";
import { readConfig, type Target } from "@/lib/driveAgentPlan";
import { DriveView, type SourceRow } from "./DriveView";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("Unificar con Drive") };
}

// "Unificar con Drive": install the script, set it up, check the plan
// before anything moves, and undo what it did.
export default async function DrivePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  const userId = session.user.id;
  const [agent, sources, changes] = await Promise.all([
    prisma.driveAgent.findUnique({ where: { userId } }),
    prisma.driveSource.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 1000 }),
    prisma.driveChange.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 80 }),
  ]);
  const config = readConfig(agent?.config);
  const rows: SourceRow[] = sources.map((s) => {
    const target = s.placement && typeof s.placement === "object" && "folder" in s.placement ? (s.placement as Target) : null;
    return { id: s.sourceId, name: s.name, status: s.status, reason: s.reason, error: s.error, path: target ? [...target.folder, target.name].join("/") : null, kind: target?.kind ?? null, unit: config.overrides[s.sourceId]?.unit ?? null, subject: config.overrides[s.sourceId]?.subject ?? null, createdAt: s.createdAt.toISOString() };
  });
  return (
    <DriveView
      installed={!!agent}
      lastSeen={agent?.lastSeenAt?.toISOString() ?? null}
      autoApply={agent?.autoApply ?? false}
      studentNames={config.studentNames}
      links={config.extraIds.map((id) => `https://drive.google.com/file/d/${id}`)}
      subjects={[...new Set(Object.values(config.aliases))].sort()}
      sources={rows}
      changes={changes.map((c) => ({ id: c.id, runId: c.runId, action: c.action, path: c.path, fileId: c.fileId, undo: c.undo, at: c.createdAt.toISOString() }))}
    />
  );
}
