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

// Clusters on a grid (up to `perRow` across); inside a cluster the roots
// sit in the middle and the rest spiral out on the golden angle.
export function layoutMap(clusters: MapCluster[], width: number, opts: { perRow?: number; rowHeight?: number; now?: number } = {}) {
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
    const nodes: PlacedNode[] = [];
    roots.forEach((n, k) => {
      const a = (k / Math.max(1, roots.length)) * Math.PI * 2;
      const rr = roots.length > 1 ? 14 : 0;
      nodes.push({ ...n, x: r1(cx + Math.cos(a) * rr), y: r1(cy + Math.sin(a) * rr), r: 8, state: dotState(n, opts.now) });
    });
    rest.forEach((n, k) => {
      const a = k * 2.39996;
      const rr = Math.min(spread, 22 + 13 * Math.sqrt(k + 1));
      nodes.push({ ...n, x: r1(cx + Math.cos(a) * rr * 1.25), y: r1(cy + Math.sin(a) * rr), r: n.depth > 1 ? 3.5 : 5, state: dotState(n, opts.now) });
    });
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const links = nodes.filter((n) => n.parentId && byId.has(n.parentId)).map((n) => [byId.get(n.parentId!)!, n] as [PlacedNode, PlacedNode]);
    return { id: c.id, label: c.label, color: c.color, x: cx, y: cy, nodes, links };
  });
  const rows = Math.ceil(clusters.length / perRow) || 1;
  return { clusters: placed, height: rows * rowH };
}
