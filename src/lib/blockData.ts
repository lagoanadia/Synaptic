import "server-only";
import { prisma } from "@/lib/prisma";
import { folderColor, folderCover, sheetsFor, type FolderCover } from "@/lib/covers";
import { dotState, type MapCluster } from "@/lib/knowledgeMap";
import { autoTitle, shortMapTitle } from "@/lib/text";
import type { TermHint } from "@/lib/terms";

// Data behind the page blocks (home, notebooks, folders). Every query is
// scoped to the signed-in user's own notebook/pursuits by the caller.

export type FolderItem = { id: string; title: string; cover: FolderCover; sheets: number; href: string; group?: string | null };

// The subjects in a notebook as folders. "Sheets" = what's left: due
// flashcards + concepts still to learn (study notebooks), or open tasks.
export async function folderItems(userId: string, sectionId: string, study: boolean): Promise<FolderItem[]> {
  const now = new Date();
  const pursuits = await prisma.pursuit.findMany({
    where: { ownerId: userId, sectionId },
    orderBy: { lastTouchedAt: "desc" },
    select: {
      id: true,
      title: true,
      cover: true,
      _count: { select: { flashcards: { where: { dueDate: { lte: now } } } } },
      conceptMaps: { select: { concepts: { select: { status: true, statusAt: true } } } },
      projects: { select: { cards: { where: { status: { not: "DONE" } }, select: { id: true } } } },
    },
  });
  return pursuits.map((p) => {
    const conceptsLeft = p.conceptMaps.flatMap((m) => m.concepts).filter((c) => dotState(c) !== "known").length;
    const tasks = p.projects.reduce((n, pr) => n + pr.cards.length, 0);
    const pending = study ? p._count.flashcards + conceptsLeft : tasks;
    return { id: p.id, title: p.title, cover: folderCover(p.id, p.cover), sheets: sheetsFor(pending), href: `/pursuits/${p.id}` };
  });
}

const conceptSelect = { id: true, title: true, status: true, statusAt: true, depth: true, parentId: true } as const;

// One cluster per subject in a notebook.
export async function notebookMap(userId: string, sectionId: string): Promise<MapCluster[]> {
  const pursuits = await prisma.pursuit.findMany({
    where: { ownerId: userId, sectionId },
    orderBy: { lastTouchedAt: "desc" },
    select: { id: true, title: true, cover: true, conceptMaps: { orderBy: { createdAt: "asc" }, select: mapSelect } },
  });
  // One cluster per subject, with every map of it.
  return pursuits
    .map((p) => ({
      id: p.id,
      label: p.title,
      color: folderColor(p.id, p.cover),
      nodes: p.conceptMaps.flatMap((m) => m.concepts.map((c) => ({ ...c, href: `/pursuits/${p.id}/learn/${m.id}?c=${c.id}` }))),
    }))
    .filter((c) => c.nodes.length > 0);
}

// One cluster per unit (group) in a subject; maps without a unit form
// their own cluster.
export async function folderMap(pursuitId: string, color: string): Promise<MapCluster[]> {
  const maps = await prisma.conceptMap.findMany({ where: { pursuitId }, orderBy: { createdAt: "asc" }, select: mapSelect });
  return clustersOf(pursuitId, color, maps);
}

const mapSelect = { id: true, title: true, unit: { select: { id: true, name: true, order: true } }, concepts: { select: conceptSelect } } as const;
type MapRow = { id: string; title: string; unit: { id: string; name: string; order: number } | null; concepts: Omit<MapCluster["nodes"][number], "href">[] };

function clustersOf(pursuitId: string, color: string, maps: MapRow[]): MapCluster[] {
  const clusters = new Map<string, MapCluster & { order: number }>();
  for (const m of maps) {
    const key = m.unit?.id ?? `map-${m.id}`;
    const name = shortMapTitle(m.unit?.name ?? m.title, 28);
    const c = clusters.get(key) ?? { id: key, label: name, color, nodes: [], order: m.unit?.order ?? 999 };
    c.nodes.push(...m.concepts.map((n) => ({ ...n, href: `/pursuits/${pursuitId}/learn/${m.id}?c=${n.id}` })));
    clusters.set(key, c);
  }
  return [...clusters.values()].sort((a, b) => a.order - b.order).filter((c) => c.nodes.length > 0);
}

export type RecentPage = { id: string; title: string; href: string; where: string; at: Date };

// Latest pages across a notebook.
export async function recentPages(userId: string, sectionId: string, take = 6): Promise<RecentPage[]> {
  const dumps = await prisma.brainDump.findMany({
    where: { pursuit: { ownerId: userId, sectionId } },
    orderBy: { updatedAt: "desc" },
    take,
    select: { id: true, content: true, updatedAt: true, pursuit: { select: { id: true, title: true } }, notes: { select: { content: true }, take: 1 } },
  });
  return dumps.map((d) => ({
    id: d.id,
    title: autoTitle(d.notes[0]?.content ?? d.content, 8) || "Sin título",
    href: `/pursuits/${d.pursuit.id}/dump/${d.id}`,
    where: d.pursuit.title,
    at: d.updatedAt,
  }));
}

// Terms a page can mark: concepts on this subject's maps that have one,
// the page's own unit first.
export async function pageTerms(pursuitId: string, unitId: string | null): Promise<TermHint[]> {
  const rows = await prisma.concept.findMany({
    where: { term: { not: null }, map: { pursuitId } },
    orderBy: { order: "asc" },
    take: 120,
    select: { id: true, term: true, title: true, summary: true, mapId: true, map: { select: { unitId: true, title: true, unit: { select: { name: true } } } } },
  });
  const seen = new Set<string>();
  return rows
    .sort((a, b) => Number(b.map.unitId === unitId) - Number(a.map.unitId === unitId))
    .filter((r) => {
      const k = r.term!.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .map((r) => ({
      term: r.term!,
      title: r.title,
      summary: r.summary,
      href: `/pursuits/${pursuitId}/learn/${r.mapId}?c=${r.id}`,
      where: shortMapTitle(r.map.unit?.name ?? r.map.title, 28),
    }));
}

// A subject's units as a path (UD1 → UD2 → …): how much of each is learned
// (known = 1, fading = ½) and where to learn it. Units in their order;
// maps without a unit go last.
export type PathUnit = { id: string; label: string; name: string; pct: number; href: string };
export type SubjectPath = { id: string; title: string; color: string; units: PathUnit[] };

const unitLabel = (name: string) => {
  const m = /^(?:ud|unidad|tema|t|u)\s*\.?\s*(\d+)/i.exec(name.trim());
  if (m) return `UD${m[1]}`;
  return name.trim().length <= 5 ? name.trim() : name.trim().slice(0, 4) + "…";
};

export async function notebookPaths(userId: string, sectionId: string): Promise<SubjectPath[]> {
  const pursuits = await prisma.pursuit.findMany({
    where: { ownerId: userId, sectionId },
    orderBy: { lastTouchedAt: "desc" },
    select: { id: true, title: true, cover: true, conceptMaps: { orderBy: { createdAt: "asc" }, select: mapSelect } },
  });
  const now = Date.now();
  return pursuits
    .map((p) => {
      const units = new Map<string, PathUnit & { order: number; known: number; total: number }>();
      for (const m of p.conceptMaps) {
        const key = m.unit?.id ?? `map-${m.id}`;
        const name = m.unit?.name ?? m.title;
        const u = units.get(key) ?? { id: key, label: unitLabel(name), name, pct: 0, href: `/pursuits/${p.id}/learn/${m.id}`, order: m.unit?.order ?? 999, known: 0, total: 0 };
        for (const c of m.concepts) {
          const s = dotState(c, now);
          u.known += s === "known" ? 1 : s === "fading" ? 0.5 : 0;
          u.total += 1;
        }
        units.set(key, u);
      }
      const list = [...units.values()]
        .filter((u) => u.total > 0)
        .sort((a, b) => a.order - b.order)
        .map(({ id, label, name, href, known, total }) => ({ id, label, name, href, pct: Math.round((known / total) * 100) / 100 }));
      return { id: p.id, title: p.title, color: folderColor(p.id, p.cover), units: list };
    })
    .filter((s) => s.units.length > 0);
}
