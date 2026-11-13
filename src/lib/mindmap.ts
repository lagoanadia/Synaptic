import { BOARD_H, BOARD_W, newShapeId, type Shape } from "@/lib/whiteboard";

// A mind map (topic → ideas → details) laid out as whiteboard shapes: the
// topic in the middle, ideas left and right, details on the outside, all
// joined by connectors stuck to the boxes, so it stays editable.
export type MindMap = { center: string; branches: { label: string; children: string[] }[] };

const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

export function cleanMindMap(raw: unknown): MindMap | null {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const center = typeof o.center === "string" ? o.center.trim() : "";
  const branches = (Array.isArray(o.branches) ? o.branches : [])
    .map((b) => {
      const r = (b && typeof b === "object" ? b : {}) as Record<string, unknown>;
      const label = typeof r.label === "string" ? r.label.trim() : "";
      const children = (Array.isArray(r.children) ? r.children : []).filter((c): c is string => typeof c === "string" && !!c.trim()).map((c) => c.trim()).slice(0, 4);
      return { label, children };
    })
    .filter((b) => b.label)
    .slice(0, 6);
  return center && branches.length ? { center, branches } : null;
}

export function layoutMindMap(m: MindMap): Shape[] {
  const lines: Shape[] = [];
  const boxes: Shape[] = [];
  const texts: Shape[] = [];
  const box = (t: "rect" | "ellipse", cx: number, cy: number, label: string, fs: number, c: number, padX: number, h: number) => {
    const w = Math.min(t === "ellipse" ? 330 : 170, label.length * fs * 0.55 + padX * 2);
    const id = newShapeId();
    const x0 = Math.max(4, Math.min(BOARD_W - 4 - w, cx - w / 2));
    // 50 at the top: the drawing toolbar sits there.
    const y0 = Math.max(50, Math.min(BOARD_H - 4 - h, cy - h / 2));
    boxes.push({ t, c, a: [Math.round(x0), Math.round(y0)], b: [Math.round(x0 + w), Math.round(y0 + h)], id });
    texts.push({ t: "text", c, a: [Math.round(x0 + w / 2), Math.round(y0 + h / 2)], s: label, fs, mid: true });
    return id;
  };
  const centerId = box("ellipse", BOARD_W / 2, BOARD_H / 2, cut(m.center, 34), 16, 0, 26, 64);
  const sides: [number, MindMap["branches"]][] = [
    [1, m.branches.filter((_, i) => i % 2 === 0)],
    [-1, m.branches.filter((_, i) => i % 2 === 1)],
  ];
  for (const [dir, list] of sides) {
    const rows = list.reduce((n, b) => n + Math.max(1, b.children.length), 0);
    const rowH = Math.min(46, (BOARD_H - 66) / Math.max(rows, 1));
    let y = 54 + (BOARD_H - 58 - rows * rowH) / 2;
    list.forEach((b) => {
      const c = (m.branches.indexOf(b) % 3) + 1;
      const span = Math.max(1, b.children.length) * rowH;
      const by = y + span / 2;
      const branchId = box("rect", BOARD_W / 2 + dir * 215, by, cut(b.label, 20), 14, c, 12, 32);
      lines.push({ t: "line", c, a: [0, 0], b: [0, 0], fa: centerId, fb: branchId, bend: Math.round(dir * (by - BOARD_H / 2) * 0.25) });
      b.children.forEach((ch, k) => {
        const cy = y + rowH * (k + 0.5);
        const childId = box("rect", BOARD_W / 2 + dir * 365, cy, cut(ch, 22), 12, c, 9, Math.min(28, rowH - 6));
        lines.push({ t: "line", c, a: [0, 0], b: [0, 0], fa: branchId, fb: childId });
      });
      y += span;
    });
  }
  return [...lines, ...boxes, ...texts];
}
