import "server-only";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { aiBudget } from "@/lib/access";
import { MAX_SOURCE_CHARS, breakDown, explainTerm, newConcepts } from "@/lib/internalizeAi";

// Below this much new text, a save doesn't touch the map (no AI call for
// fixing a typo).
const MIN_NEW_CHARS = 300;

// The unit's material: organized notes, plus pages not organized yet.
async function unitSource(pursuitId: string, unitId: string | null): Promise<string> {
  const [notes, dumps] = await Promise.all([
    prisma.note.findMany({ where: { pursuitId, sectionId: unitId }, orderBy: { createdAt: "asc" }, select: { content: true } }),
    prisma.brainDump.findMany({ where: { pursuitId, sectionId: unitId, notes: { none: {} } }, orderBy: { createdAt: "asc" }, select: { content: true } }),
  ]);
  return [...notes.map((n) => n.content), ...dumps.map((d) => d.content ?? "")]
    .filter((t) => t.trim())
    .join("\n\n---\n\n")
    .slice(0, MAX_SOURCE_CHARS);
}

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

  const [source, unit] = await Promise.all([
    unitSource(pursuitId, unitId),
    unitId ? prisma.pursuitContentSection.findFirst({ where: { id: unitId, pursuitId }, select: { name: true } }) : null,
  ]);
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

// "Añadir al mapa" (from a selection in a note, or the map's +): a concept
// the student names, explained from the unit's notes. Goes into the given
// map, or the unit's own (made empty if there's none yet). An existing
// concept with that name is returned instead of a copy.
export async function addNamedConcept(
  userId: string,
  pursuitId: string,
  where: { mapId: string } | { unitId: string | null },
  text: string,
): Promise<{ error: string } | { error: null; mapId: string; conceptId: string }> {
  const name = text.replace(/\s+/g, " ").trim().slice(0, 80);
  if (name.length < 2) return { error: "Selecciona una palabra o frase" };
  const pursuit = await prisma.pursuit.findFirst({
    where: { id: pursuitId, OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
    select: { owner: { select: { email: true } } },
  });
  if (!pursuit) return { error: "No encontrado" };

  let map =
    "mapId" in where
      ? await prisma.conceptMap.findFirst({ where: { id: where.mapId, pursuitId }, select: { id: true, unitId: true, language: true } })
      : await prisma.conceptMap.findFirst({ where: { pursuitId, unitId: where.unitId, sourceKind: "auto" }, select: { id: true, unitId: true, language: true } });
  if (!map && "unitId" in where) {
    const unit = where.unitId ? await prisma.pursuitContentSection.findFirst({ where: { id: where.unitId, pursuitId }, select: { name: true } }) : null;
    map = await prisma.conceptMap.create({
      data: { pursuitId, unitId: where.unitId, title: unit?.name ?? "General", sourceKind: "auto", sourceRef: "Tus apuntes", sourceText: "", language: "Español" },
      select: { id: true, unitId: true, language: true },
    });
  }
  if (!map) return { error: "Mapa no encontrado" };

  const same = await prisma.concept.findFirst({
    where: { mapId: map.id, OR: [{ title: { equals: name, mode: "insensitive" } }, { term: { equals: name, mode: "insensitive" } }] },
    select: { id: true },
  });
  if (same) return { error: null, mapId: map.id, conceptId: same.id };

  const budget = await aiBudget(userId, pursuit.owner.email);
  const limited = await budget.check();
  if (limited) return { error: limited };
  const c = await explainTerm(name, await unitSource(pursuitId, map.unitId), map.language || "Español");
  if (!c) return { error: "No se ha podido explicar. Prueba otra vez." };
  await budget.charge();
  const order = await prisma.concept.count({ where: { mapId: map.id, parentId: null } });
  const row = await prisma.concept.create({
    data: { mapId: map.id, order, title: c.title, term: c.term, summary: c.summary, explanation: c.explanation, excerpt: c.excerpt, excerptFrom: c.excerptFrom },
  });
  revalidatePath(`/pursuits/${pursuitId}`);
  return { error: null, mapId: map.id, conceptId: row.id };
}
