// Whiteboard shapes (stored as JSON) and their SVG. Pure, so the editor,
// the API route (for print/PDF) and tests share it.

export const BOARD_W = 900;
export const BOARD_H = 400;
export const BOARD_COLORS = ["#37352f", "#e16259", "#2383e2", "#eda100"] as const;
export const BOARD_SRC = /^\/api\/boards\/([a-z0-9]{10,40})$/;

export type Shape =
  | { t: "pen"; c: number; p: [number, number][] }
  | { t: "line"; c: number; a: [number, number]; b: [number, number] }
  | { t: "rect"; c: number; a: [number, number]; b: [number, number] }
  | { t: "ellipse"; c: number; a: [number, number]; b: [number, number] }
  | { t: "text"; c: number; a: [number, number]; s: string };

const num = (v: unknown, max: number) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(max, Math.round(v))) : 0);
const pt = (v: unknown): [number, number] => (Array.isArray(v) ? [num(v[0], BOARD_W), num(v[1], BOARD_H)] : [0, 0]);
const color = (v: unknown) => (Number.isInteger(v) && (v as number) >= 0 && (v as number) < BOARD_COLORS.length ? (v as number) : 0);

// Whatever is stored or sent → valid shapes (at most 500, pens of 2000 points).
export function cleanShapes(raw: unknown): Shape[] {
  if (!Array.isArray(raw)) return [];
  const out: Shape[] = [];
  for (const r of raw.slice(0, 500)) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const c = color(o.c);
    if (o.t === "pen" && Array.isArray(o.p)) out.push({ t: "pen", c, p: o.p.slice(0, 2000).map(pt) });
    else if (o.t === "line" || o.t === "rect" || o.t === "ellipse") out.push({ t: o.t, c, a: pt(o.a), b: pt(o.b) });
    else if (o.t === "text" && typeof o.s === "string" && o.s.trim()) out.push({ t: "text", c, a: pt(o.a), s: o.s.slice(0, 120) });
  }
  return out;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// One shape as SVG markup.
export function shapeSvg(s: Shape): string {
  const stroke = `stroke="${BOARD_COLORS[s.c]}" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"`;
  switch (s.t) {
    case "pen":
      return s.p.length ? `<path d="M${s.p.map(([x, y]) => `${x},${y}`).join(" L")}" ${stroke}/>` : "";
    case "line":
      return `<path d="M${s.a[0]},${s.a[1]} L${s.b[0]},${s.b[1]}" ${stroke}/>`;
    case "rect":
      return `<rect x="${Math.min(s.a[0], s.b[0])}" y="${Math.min(s.a[1], s.b[1])}" width="${Math.abs(s.b[0] - s.a[0])}" height="${Math.abs(s.b[1] - s.a[1])}" rx="6" ${stroke}/>`;
    case "ellipse":
      return `<ellipse cx="${(s.a[0] + s.b[0]) / 2}" cy="${(s.a[1] + s.b[1]) / 2}" rx="${Math.abs(s.b[0] - s.a[0]) / 2}" ry="${Math.abs(s.b[1] - s.a[1]) / 2}" ${stroke}/>`;
    case "text":
      return `<text x="${s.a[0]}" y="${s.a[1]}" font-size="20" font-family="Inter, system-ui, sans-serif" fill="${BOARD_COLORS[s.c]}">${esc(s.s)}</text>`;
  }
}

export function boardSvg(shapes: Shape[]): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${BOARD_W} ${BOARD_H}" width="${BOARD_W}" height="${BOARD_H}"><rect width="${BOARD_W}" height="${BOARD_H}" fill="#fff"/>${shapes.map(shapeSvg).join("")}</svg>`;
}

// ── Editing placed shapes ──────────────────────────────────────────────
type Pt = [number, number];
export type Box = { x0: number; y0: number; x1: number; y1: number };
const clampPt = ([x, y]: Pt): Pt => [Math.max(0, Math.min(BOARD_W, Math.round(x))), Math.max(0, Math.min(BOARD_H, Math.round(y)))];

// The rectangle a shape covers (text: an estimate from its length).
export function shapeBox(s: Shape): Box {
  const pts: Pt[] = s.t === "pen" ? s.p : s.t === "text" ? [[s.a[0], s.a[1] - 20], [s.a[0] + s.s.length * 11, s.a[1] + 5]] : [s.a, s.b];
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

const segDist = ([px, py]: Pt, [ax, ay]: Pt, [bx, by]: Pt) => {
  const dx = bx - ax;
  const dy = by - ay;
  const k = dx || dy ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy))) : 0;
  return Math.hypot(px - (ax + k * dx), py - (ay + k * dy));
};

// The topmost shape under the point, or -1. Lines and pen strokes count
// near the stroke; boxes, circles and text anywhere inside.
export function hitShape(shapes: Shape[], p: Pt, tolerance = 8): number {
  for (let i = shapes.length - 1; i >= 0; i--) {
    const s = shapes[i];
    if (s.t === "line" && segDist(p, s.a, s.b) <= tolerance) return i;
    if (s.t === "pen" && s.p.some((q, j) => segDist(p, q, s.p[j + 1] ?? q) <= tolerance)) return i;
    if (s.t === "rect" || s.t === "ellipse" || s.t === "text") {
      const b = shapeBox(s);
      if (p[0] >= b.x0 - tolerance && p[0] <= b.x1 + tolerance && p[1] >= b.y0 - tolerance && p[1] <= b.y1 + tolerance) return i;
    }
  }
  return -1;
}

export function moveShape(s: Shape, dx: number, dy: number): Shape {
  const m = ([x, y]: Pt): Pt => clampPt([x + dx, y + dy]);
  if (s.t === "pen") return { ...s, p: s.p.map(m) };
  if (s.t === "text") return { ...s, a: m(s.a) };
  return { ...s, a: m(s.a), b: m(s.b) };
}

// Drag the bottom-right corner of its box to `to`: boxes and circles
// stretch, a line moves its far end, pen strokes and text scale/shift.
export function resizeShape(s: Shape, to: Pt): Shape {
  const b = shapeBox(s);
  const [tx, ty] = clampPt(to);
  if (s.t === "rect" || s.t === "ellipse") return { ...s, a: [b.x0, b.y0], b: [Math.max(b.x0 + 4, tx), Math.max(b.y0 + 4, ty)] };
  if (s.t === "line") return { ...s, b: [tx, ty] };
  if (s.t === "pen") {
    const kx = (Math.max(b.x0 + 4, tx) - b.x0) / Math.max(1, b.x1 - b.x0);
    const ky = (Math.max(b.y0 + 4, ty) - b.y0) / Math.max(1, b.y1 - b.y0);
    return { ...s, p: s.p.map(([x, y]) => clampPt([b.x0 + (x - b.x0) * kx, b.y0 + (y - b.y0) * ky])) };
  }
  return s;
}

// A click without a drag leaves a dot; those aren't kept.
export function tooSmall(s: Shape): boolean {
  if (s.t === "text") return false;
  const b = shapeBox(s);
  return b.x1 - b.x0 < 4 && b.y1 - b.y0 < 4;
}
