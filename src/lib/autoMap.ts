import "server-only";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { aiBudget } from "@/lib/access";
import { MAX_SOURCE_CHARS, breakDown, newConcepts } from "@/lib/internalizeAi";

// Below this much new text, a save doesn't touch the map (no AI call for
// fixing a typo).
const MIN_NEW_CHARS = 300;

// The concept map of one unit, kept in step with its notes: created the
// first time there's enough material, then extended with whatever new
// concepts later notes bring. One map per unit; pages without a unit share
// a general one. Only in notebooks with study tools. Runs after a save
// (in the background), so failures are silent and retried next save.
export async function refreshUnitMap(userId: string, pursuitId: string, unitId: string | null): Promise<void> {
  const pursuit = await prisma.pursuit.findFirst({
    where: { id: pursuitId, OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
    select: { id: true, section: { select: { study: true } }, owner: { select: { email: true } } },
  });
  if (!pursuit || pursuit.section?.study === false) return;

  // The unit's material: organized notes, plus pages not organized yet.
  const [notes, dumps, unit] = await Promise.all([
    prisma.note.findMany({ where: { pursuitId, sectionId: unitId }, orderBy: { createdAt: "asc" }, select: { content: true } }),
    prisma.brainDump.findMany({ where: { pursuitId, sectionId: unitId, notes: { none: {} } }, orderBy: { createdAt: "asc" }, select: { content: true } }),
    unitId ? prisma.pursuitContentSection.findFirst({ where: { id: unitId, pursuitId }, select: { name: true } }) : null,
  ]);
  const source = [...notes.map((n) => n.content), ...dumps.map((d) => d.content ?? "")]
    .filter((t) => t.trim())
    .join("\n\n---\n\n")
    .slice(0, MAX_SOURCE_CHARS);
  if (source.length < MIN_NEW_CHARS) return;

  const existing = await prisma.conceptMap.findFirst({
    where: { pursuitId, unitId, sourceKind: "auto" },
    select: { id: true, sourceText: true, language: true, concepts: { select: { id: true, title: true } } },
  });
  if (existing && source.length - existing.sourceText.length < MIN_NEW_CHARS) return;

  const budget = await aiBudget(userId, pursuit.owner.email);
  if (await budget.check()) return;

  if (!existing) {
    const breakdown = await breakDown(source, "Español", "The source is a student's own notes on one unit of a subject.");
    if (!breakdown) return;
    // Another save may have created it meanwhile.
    if (await prisma.conceptMap.findFirst({ where: { pursuitId, unitId, sourceKind: "auto" }, select: { id: true } })) return;
    await budget.charge();
    const map = await prisma.conceptMap.create({
      data: { pursuitId, unitId, title: unit?.name ?? "General", sourceKind: "auto", sourceRef: "Tus apuntes", sourceText: source, language: "Español" },
    });
    const ids = new Map<string, string>();
    for (const [order, c] of breakdown.concepts.entries()) {
      const row = await prisma.concept.create({
        data: { mapId: map.id, order, title: c.title, term: c.term, summary: c.summary, explanation: c.explanation, excerpt: c.excerpt, excerptFrom: c.excerptFrom },
      });
      ids.set(c.key, row.id);
    }
    if (breakdown.links.length) {
      await prisma.conceptLink.createMany({
        data: breakdown.links.map((l) => ({ fromId: ids.get(l.from)!, toId: ids.get(l.to)!, label: l.label })),
        skipDuplicates: true,
      });
    }
  } else {
    const added = await newConcepts(source, existing.concepts.map((c) => c.title), existing.language || "Español");
    if (!added) return;
    await budget.charge();
    const byTitle = new Map(existing.concepts.map((c) => [c.title, c.id]));
    const ids = new Map<string, string>();
    const start = existing.concepts.length;
    for (const [i, c] of added.concepts.entries()) {
      const row = await prisma.concept.create({
        data: { mapId: existing.id, order: start + i, title: c.title, term: c.term, summary: c.summary, explanation: c.explanation, excerpt: c.excerpt, excerptFrom: c.excerptFrom },
      });
      ids.set(c.key, row.id);
    }
    const links = added.links.filter((l) => ids.has(l.from) && byTitle.has(l.toTitle));
    if (links.length) {
      await prisma.conceptLink.createMany({
        data: links.map((l) => ({ fromId: byTitle.get(l.toTitle)!, toId: ids.get(l.from)!, label: l.label })),
        skipDuplicates: true,
      });
    }
    await prisma.conceptMap.update({ where: { id: existing.id }, data: { sourceText: source } });
  }
  revalidatePath(`/pursuits/${pursuitId}`);
}

// Notes written before maps made themselves: on opening a subject, its
// units that have notes but no map yet get one (a few per visit, in the
// background).
export async function backfillMaps(userId: string, pursuitId: string, perVisit = 3): Promise<void> {
  const [units, maps, loose] = await Promise.all([
    prisma.pursuitContentSection.findMany({
      where: { pursuitId, OR: [{ notes: { some: {} } }, { brainDumps: { some: {} } }] },
      orderBy: { order: "asc" },
      select: { id: true },
    }),
    prisma.conceptMap.findMany({ where: { pursuitId }, select: { unitId: true } }),
    prisma.brainDump.count({ where: { pursuitId, sectionId: null } }),
  ]);
  const mapped = new Set(maps.map((m) => m.unitId));
  const todo: (string | null)[] = units.map((u) => u.id).filter((id) => !mapped.has(id));
  if (loose > 0 && !mapped.has(null)) todo.push(null);
  for (const unitId of todo.slice(0, perVisit)) await refreshUnitMap(userId, pursuitId, unitId).catch(() => {});
}
