import "server-only";
import { prisma } from "@/lib/prisma";
import { folderColor, folderCover, sheetsFor, type FolderCover } from "@/lib/covers";
import { dotState, type MapCluster } from "@/lib/knowledgeMap";
import { autoTitle } from "@/lib/text";

// Data behind the page blocks (home, notebooks, folders). Every query is
// scoped to the signed-in user's own notebook/pursuits by the caller.

export type FolderItem = { id: string; title: string; cover: FolderCover; sheets: number; href: string };

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
  // One cluster per map (per unit), labelled with its subject: "DI · UD1".
  return pursuits.flatMap((p) => clustersOf(p.id, folderColor(p.id, p.cover), p.conceptMaps, p.title));
}

// One cluster per unit (group) in a subject; maps without a unit form
// their own cluster.
export async function folderMap(pursuitId: string, color: string): Promise<MapCluster[]> {
  const maps = await prisma.conceptMap.findMany({ where: { pursuitId }, orderBy: { createdAt: "asc" }, select: mapSelect });
  return clustersOf(pursuitId, color, maps);
}

const mapSelect = { id: true, title: true, unit: { select: { id: true, name: true, order: true } }, concepts: { select: conceptSelect } } as const;
type MapRow = { id: string; title: string; unit: { id: string; name: string; order: number } | null; concepts: Omit<MapCluster["nodes"][number], "href">[] };

function clustersOf(pursuitId: string, color: string, maps: MapRow[], subject?: string): MapCluster[] {
  const clusters = new Map<string, MapCluster & { order: number }>();
  for (const m of maps) {
    const key = m.unit?.id ?? `map-${m.id}`;
    const name = m.unit?.name ?? m.title;
    const c = clusters.get(key) ?? { id: key, label: subject ? `${subject} · ${name}` : name, color, nodes: [], order: m.unit?.order ?? 999 };
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
