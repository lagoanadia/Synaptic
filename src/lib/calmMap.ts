// The concept map, calm version: concepts grouped (a concept with the ones
// under it is a group named after it; loose concepts share one group),
// each group drawn as a little constellation — the main concept in the
// middle, the ones under it in rings around. Groups are packed in rows.
// Pure, so the picture is stable between renders and testable.
import { dotState, type MapNode } from "@/lib/knowledgeMap";

// k = you know it, p = half (seen, not checked yet), r = to review, n = new.
export type Mark = "k" | "p" | "r" | "n";
export type CalmDot = { id: string; title: string; href: string; x: number; y: number; mark: Mark; main: boolean };
// r: half its width; ry: half its height (the same for a round group).
export type CalmGroup = { id: string; title: string; loose: boolean; x: number; y: number; r: number; ry: number; dots: CalmDot[]; lines: [string, string][] };

export const CALM_W = 600;
const RING = 66; // distance between rings
const LOOSE_GAP = 50; // between loose dots

export function markOf(n: Pick<MapNode, "status" | "statusAt">, now = Date.now()): Mark {
  const s = dotState(n, now);
  if (s === "known") return "k";
  if (s === "fading") return "r";
  return n.status === "SEEN" ? "p" : "n";
}

const r1 = (v: number) => Math.round(v * 10) / 10;

export function calmLayout(nodes: MapNode[], opts: { now?: number; looseTitle?: string } = {}): { groups: CalmGroup[]; width: number; height: number } {
  const now = opts.now ?? Date.now();
  const ids = new Set(nodes.map((n) => n.id));
  const kids = new Map<string, MapNode[]>();
  for (const n of nodes) if (n.parentId && ids.has(n.parentId)) kids.set(n.parentId, [...(kids.get(n.parentId) ?? []), n]);
  const roots = nodes.filter((n) => !n.parentId || !ids.has(n.parentId));
  const dot = (n: MapNode, x: number, y: number, main: boolean): CalmDot => ({ id: n.id, title: n.title, href: n.href, x: r1(x), y: r1(y), mark: markOf(n, now), main });

  // Trees → groups, biggest first; loose roots → one group.
  const groups: Omit<CalmGroup, "x" | "y">[] = [];
  const loose: MapNode[] = [];
  const trees = roots.map((root) => {
    const levels: MapNode[][] = [[root]];
    while (true) {
      const next = levels[levels.length - 1].flatMap((n) => kids.get(n.id) ?? []);
      if (!next.length) break;
      levels.push(next);
    }
    return { root, levels };
  });
  for (const { root, levels } of trees.sort((a, b) => b.levels.flat().length - a.levels.flat().length)) {
    if (levels.length === 1) {
      loose.push(root);
      continue;
    }
    const dots: CalmDot[] = [dot(root, 0, 0, true)];
    const angle = new Map<string, number>([[root.id, -Math.PI / 2]]);
    levels.slice(1).forEach((level, li) => {
      // Each ring keeps children near their parent's direction, spread evenly.
      const sorted = [...level].sort((a, b) => (angle.get(a.parentId!) ?? 0) - (angle.get(b.parentId!) ?? 0));
      const radius = RING * (li + 1) * (li === 0 && sorted.length > 6 ? 1.15 : 1);
      sorted.forEach((n, k) => {
        const a = -Math.PI / 2 + (k * 2 * Math.PI) / sorted.length + li * 0.35;
        angle.set(n.id, a);
        dots.push(dot(n, Math.cos(a) * radius, Math.sin(a) * radius, false));
      });
    });
    const lines = levels.slice(1).flat().map((n) => [n.parentId!, n.id] as [string, string]);
    const r = RING * (levels.length - 1) + 34;
    groups.push({ id: root.id, title: root.title, loose: false, r, ry: r, dots, lines });
  }
  if (loose.length) {
    // Tidy rows across the whole width, every other row nudged half a step.
    const cols = Math.max(1, Math.floor((CALM_W - 40) / (LOOSE_GAP * 1.6)));
    const rows = Math.ceil(loose.length / cols);
    const stepX = LOOSE_GAP * 1.6;
    const stepY = LOOSE_GAP * 1.15;
    const dots = loose.map((n, k) => {
      const row = Math.floor(k / cols);
      const col = k % cols;
      const inRow = Math.min(cols, loose.length - row * cols);
      return dot(n, (col - (inRow - 1) / 2) * stepX + (row % 2 ? stepX / 4 : -stepX / 4), (row - (rows - 1) / 2) * stepY, false);
    });
    const r = Math.max(...dots.map((d) => Math.abs(d.x))) + 40;
    const ry = Math.max(...dots.map((d) => Math.abs(d.y))) + 30;
    groups.push({ id: "loose", title: opts.looseTitle ?? "Otros conceptos", loose: true, r, ry, dots, lines: [] });
  }

  // Rows across the width; each group sits under its title.
  const placed: CalmGroup[] = [];
  let x = 0;
  let y = 0;
  let rowH = 0;
  const TITLE = 30;
  for (const g of groups) {
    // Never narrower than its title (about 7px a letter at 12.5px).
    const d = Math.max(g.r * 2, Math.min(CALM_W, g.title.length * 7.4 + 56));
    if (x > 0 && x + d > CALM_W) {
      x = 0;
      y += rowH;
      rowH = 0;
    }
    placed.push({ ...g, x: r1(x + d / 2), y: r1(y + TITLE + g.ry), dots: g.dots.map((p) => ({ ...p, x: r1(p.x + x + d / 2), y: r1(p.y + y + TITLE + g.ry) })) });
    x += d + 24;
    rowH = Math.max(rowH, g.ry * 2 + TITLE + 14);
  }
  // Centre each row's groups horizontally.
  const rows = new Map<number, CalmGroup[]>();
  for (const g of placed) {
    const key = Math.round(g.y - g.ry);
    rows.set(key, [...(rows.get(key) ?? []), g]);
  }
  for (const row of rows.values()) {
    const right = Math.max(...row.map((g) => g.x + g.r));
    const shift = r1((CALM_W - right) / 2);
    for (const g of row) {
      g.x = r1(g.x + shift);
      g.dots = g.dots.map((p) => ({ ...p, x: r1(p.x + shift) }));
    }
  }
  // A group wider than the map makes the whole picture wider (it scales down).
  const width = Math.max(CALM_W, ...placed.map((g) => g.x + g.r));
  return { groups: placed, width: r1(width), height: Math.max(CALM_W * 0.6, r1(y + rowH)) };
}
