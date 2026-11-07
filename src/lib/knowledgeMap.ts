// "Tu mapa": every concept as a dot, one cluster per subject (or unit).
// Hollow = still to learn, filled = you know it, faded = slipping (you
// flagged it to reread, or haven't checked it in a while). Pure layout so
// the picture is stable between renders and testable.

export type MapStatus = "NEW" | "SEEN" | "REREAD" | "UNDERSTOOD" | "MASTERED";
export type MapNode = { id: string; title: string; status: MapStatus; statusAt: Date | string | null; depth: number; parentId: string | null; href: string };
export type MapCluster = { id: string; label: string; color: string; nodes: MapNode[] };

export type DotState = "todo" | "known" | "fading";
const STALE_DAYS = 14;

export function dotState(n: Pick<MapNode, "status" | "statusAt">, now = Date.now()): DotState {
  if (n.status === "REREAD") return "fading";
  if (n.status === "UNDERSTOOD" || n.status === "MASTERED") {
    const at = n.statusAt ? new Date(n.statusAt).getTime() : now;
    return now - at > STALE_DAYS * 86400000 && n.status === "UNDERSTOOD" ? "fading" : "known";
  }
  return "todo";
}

// Rounded so the server and the browser draw identical numbers.
const r1 = (n: number) => Math.round(n * 10) / 10;

export type PlacedNode = MapNode & { x: number; y: number; r: number; state: DotState };
export type PlacedCluster = { id: string; label: string; color: string; x: number; y: number; nodes: PlacedNode[]; links: [PlacedNode, PlacedNode][] };

// Clusters on a grid (up to `perRow` across); inside a cluster every
// concept is spread evenly, roots nearer the middle. `fill` (one unit on
// its own) uses the whole cell.
export function layoutMap(clusters: MapCluster[], width: number, opts: { perRow?: number; rowHeight?: number; now?: number; fill?: boolean } = {}) {
  const perRow = Math.max(1, Math.min(opts.perRow ?? 4, clusters.length || 1));
  const rowH = opts.rowHeight ?? 210;
  const cellW = width / perRow;
  const placed: PlacedCluster[] = clusters.map((c, i) => {
    const col = i % perRow;
    const row = Math.floor(i / perRow);
    const cx = cellW * col + cellW / 2;
    const cy = rowH * row + rowH / 2 - 10;
    const spread = Math.min(cellW, rowH) / 2 - 26;
    const roots = c.nodes.filter((n) => !n.parentId || !c.nodes.some((m) => m.id === n.parentId));
    const rest = c.nodes.filter((n) => !roots.includes(n));
    // Every concept gets an even share of the space (sunflower spiral),
    // however many sit at the same level. A single unit (fill) uses the
    // whole box; small clusters grow with their size, up to their cell.
    const n = c.nodes.length;
    const reach = Math.min(spread, 14 + 11 * Math.sqrt(n));
    const nodes: PlacedNode[] = opts.fill
      ? sunflower([...roots, ...rest], cx, cy, cellW / 2 - 70, rowH / 2 - 34, roots.length === 1, opts.now)
      : sunflower([...roots, ...rest], cx, cy, reach * 1.25, reach, roots.length === 1, opts.now, n > 12 ? 0.6 : 0.8);
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const links = nodes.filter((n) => n.parentId && byId.has(n.parentId)).map((n) => [byId.get(n.parentId!)!, n] as [PlacedNode, PlacedNode]);
    return { id: c.id, label: c.label, color: c.color, x: cx, y: cy, nodes, links };
  });
  const rows = Math.ceil(clusters.length / perRow) || 1;
  return { clusters: placed, height: rows * rowH };
}

// One unit at real size: every concept spread evenly over an ellipse (a
// sunflower spiral), roots first so they sit nearer the middle, a lone root
// right in the centre. Even area per dot, so nothing piles up however flat
// or deep the map is.
function sunflower(list: MapNode[], cx: number, cy: number, rx: number, ry: number, centreFirst: boolean, now?: number, scale = 1): PlacedNode[] {
  const n = list.length;
  return list.map((node, k) => {
    const place = centreFirst && k === 0 ? null : centreFirst ? k : k + 0.5;
    const f = place === null ? 0 : Math.sqrt(place / (centreFirst ? n - 0.5 : n));
    const a = (place ?? 0) * 2.39996;
    const r = (node.parentId ? (node.depth > 1 ? 6 : 8) : 10) * scale;
    return { ...node, x: r1(cx + Math.cos(a) * rx * f), y: r1(cy + Math.sin(a) * ry * f), r, state: dotState(node, now) };
  });
}

// How tall a single unit's map should be so its concepts have room.
export const focusHeight = (count: number) => Math.max(460, Math.round(150 * Math.sqrt(count)));
