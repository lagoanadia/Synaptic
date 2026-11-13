// Whiteboard shapes (stored as JSON) and their SVG. Pure, so the editor,
// the API route (for print/PDF) and tests share it.

export const BOARD_W = 900;
export const BOARD_H = 400;
// The visible frame is BOARD_W × BOARD_H at 100%; you can move and zoom
// around a board three times as wide and tall.
export const WORLD_W = BOARD_W * 3;
export const WORLD_H = BOARD_H * 3;
export const BOARD_COLORS = ["#37352f", "#e16259", "#2383e2", "#eda100"] as const;
export const BOARD_SRC = /^\/api\/boards\/([a-z0-9]{10,40})$/;

type Pt = [number, number];
// A colour: one of BOARD_COLORS (by index) or any "#rrggbb" picked freely.
export type Color = number | string;
export const colorOf = (c: Color): string => (typeof c === "string" ? c : (BOARD_COLORS[c] ?? BOARD_COLORS[0]));
export type Arrow = "end" | "both";
// Lines can curve (`bend`: how far the middle is pulled sideways), carry
// arrowheads, and stick to a shape at either end (`fa`/`fb` = that shape's
// id): then that end sits on the shape's edge and follows it around.
export type LineShape = { t: "line"; c: Color; a: Pt; b: Pt; bend?: number; arrow?: Arrow; fa?: string; fb?: string };
export type Shape =
  | { t: "pen"; c: Color; p: Pt[] }
  | LineShape
  | { t: "rect"; c: Color; a: Pt; b: Pt; id?: string }
  | { t: "ellipse"; c: Color; a: Pt; b: Pt; id?: string }
  // fs: font size (default 20); mid: `a` is the text's centre, not its start.
  | { t: "text"; c: Color; a: Pt; s: string; id?: string; fs?: number; mid?: boolean };

const num = (v: unknown, max: number) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(max, Math.round(v))) : 0);
const pt = (v: unknown): Pt => (Array.isArray(v) ? [num(v[0], WORLD_W), num(v[1], WORLD_H)] : [0, 0]);
const color = (v: unknown): Color =>
  typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : Number.isInteger(v) && (v as number) >= 0 && (v as number) < BOARD_COLORS.length ? (v as number) : 0;
const ID = /^[a-z0-9]{4,16}$/;
const idOf = (v: unknown) => (typeof v === "string" && ID.test(v) ? v : undefined);
export const newShapeId = () => Math.random().toString(36).slice(2, 10);

// Whatever is stored or sent → valid shapes (at most 500, pens of 2000 points).
export function cleanShapes(raw: unknown): Shape[] {
  if (!Array.isArray(raw)) return [];
  const out: Shape[] = [];
  for (const r of raw.slice(0, 500)) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const c = color(o.c);
    const id = idOf(o.id);
    if (o.t === "pen" && Array.isArray(o.p)) out.push({ t: "pen", c, p: o.p.slice(0, 2000).map(pt) });
    else if (o.t === "line") {
      const l: LineShape = { t: "line", c, a: pt(o.a), b: pt(o.b) };
      if (typeof o.bend === "number" && Number.isFinite(o.bend) && Math.round(o.bend) !== 0) l.bend = Math.max(-600, Math.min(600, Math.round(o.bend)));
      if (o.arrow === "end" || o.arrow === "both") l.arrow = o.arrow;
      if (idOf(o.fa)) l.fa = idOf(o.fa);
      if (idOf(o.fb)) l.fb = idOf(o.fb);
      out.push(l);
    } else if (o.t === "rect" || o.t === "ellipse") out.push({ t: o.t, c, a: pt(o.a), b: pt(o.b), ...(id ? { id } : {}) });
    else if (o.t === "text" && typeof o.s === "string" && o.s.trim())
      out.push({
        t: "text",
        c,
        a: pt(o.a),
        s: o.s.slice(0, 120),
        ...(id ? { id } : {}),
        ...(typeof o.fs === "number" && o.fs >= 10 && o.fs <= 40 && Math.round(o.fs) !== 20 ? { fs: Math.round(o.fs) } : {}),
        ...(o.mid === true ? { mid: true } : {}),
      });
  }
  return out;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export type Box = { x0: number; y0: number; x1: number; y1: number };
const clampPt = ([x, y]: Pt): Pt => [Math.max(0, Math.min(WORLD_W, Math.round(x))), Math.max(0, Math.min(WORLD_H, Math.round(y)))];

// The rectangle a (non-line) shape covers (text: an estimate from its length).
function ownBox(s: Exclude<Shape, LineShape>): Box {
  if (s.t === "text") {
    const fs = s.fs ?? 20;
    const w = s.s.length * fs * 0.55;
    const x0 = s.mid ? s.a[0] - w / 2 : s.a[0];
    const y0 = s.mid ? s.a[1] - fs * 0.6 : s.a[1] - fs;
    return { x0, y0, x1: x0 + w, y1: y0 + fs * 1.25 };
  }
  const pts: Pt[] = s.t === "pen" ? s.p : [s.a, s.b];
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

// Where a line from the shape's centre toward `toward` leaves the shape.
function edgePoint(s: Exclude<Shape, LineShape>, toward: Pt): Pt {
  const b = ownBox(s);
  const cx = (b.x0 + b.x1) / 2;
  const cy = (b.y0 + b.y1) / 2;
  const dx = toward[0] - cx;
  const dy = toward[1] - cy;
  if (!dx && !dy) return [cx, cy];
  const hw = (b.x1 - b.x0) / 2;
  const hh = (b.y1 - b.y0) / 2;
  const k = s.t === "ellipse" ? 1 / Math.sqrt((dx * dx) / (hw * hw) + (dy * dy) / (hh * hh)) : Math.min(dx ? hw / Math.abs(dx) : Infinity, dy ? hh / Math.abs(dy) : Infinity);
  return [cx + dx * Math.min(1, k), cy + dy * Math.min(1, k)];
}

const byId = (all: Shape[], id?: string) => (id ? (all.find((s) => s.t !== "line" && "id" in s && s.id === id) as Exclude<Shape, LineShape> | undefined) : undefined);
const centre = (s: Exclude<Shape, LineShape>): Pt => {
  const b = ownBox(s);
  return [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2];
};

// A line's real ends (attached ends sit on their shape) and curve control point.
export function lineGeometry(l: LineShape, all: Shape[]): { A: Pt; B: Pt; C: Pt; mid: Pt; normal: Pt } {
  const sa = byId(all, l.fa);
  const sb = byId(all, l.fb);
  const refA = sa ? centre(sa) : l.a;
  const refB = sb ? centre(sb) : l.b;
  const bend = l.bend ?? 0;
  const mid0: Pt = [(refA[0] + refB[0]) / 2, (refA[1] + refB[1]) / 2];
  const len = Math.hypot(refB[0] - refA[0], refB[1] - refA[1]) || 1;
  const normal: Pt = [-(refB[1] - refA[1]) / len, (refB[0] - refA[0]) / len];
  const C0: Pt = [mid0[0] + normal[0] * bend, mid0[1] + normal[1] * bend];
  const A = sa ? edgePoint(sa, bend ? C0 : refB) : l.a;
  const B = sb ? edgePoint(sb, bend ? C0 : refA) : l.b;
  const mid: Pt = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2];
  return { A, B, C: [mid[0] + normal[0] * bend, mid[1] + normal[1] * bend], mid, normal };
}

// The middle of the (curved) line: where its bend handle sits.
export function lineMiddle(l: LineShape, all: Shape[]): Pt {
  const { A, B, C } = lineGeometry(l, all);
  return [(A[0] + 2 * C[0] + B[0]) / 4, (A[1] + 2 * C[1] + B[1]) / 4];
}

// Dragging the middle handle to `p` → the bend that puts the curve there.
export function bendFor(l: LineShape, all: Shape[], p: Pt): number {
  const { mid, normal } = lineGeometry({ ...l, bend: 0 }, all);
  return Math.round(2 * ((p[0] - mid[0]) * normal[0] + (p[1] - mid[1]) * normal[1]));
}

const curvePoints = (l: LineShape, all: Shape[], n = 24): Pt[] => {
  const { A, B, C } = lineGeometry(l, all);
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    const u = 1 - t;
    return [u * u * A[0] + 2 * u * t * C[0] + t * t * B[0], u * u * A[1] + 2 * u * t * C[1] + t * t * B[1]] as Pt;
  });
};

export function shapeBox(s: Shape, all: Shape[] = []): Box {
  if (s.t !== "line") return ownBox(s);
  const pts = curvePoints(s, all, 12);
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

function arrowHead(tip: Pt, from: Pt, fill: string): string {
  const len = Math.hypot(tip[0] - from[0], tip[1] - from[1]) || 1;
  const ux = (tip[0] - from[0]) / len;
  const uy = (tip[1] - from[1]) / len;
  const s = 13;
  const w = 6.5;
  const p1 = [tip[0] - ux * s - uy * w, tip[1] - uy * s + ux * w];
  const p2 = [tip[0] - ux * s + uy * w, tip[1] - uy * s - ux * w];
  return `<path d="M${tip[0]},${tip[1]} L${p1[0]},${p1[1]} L${p2[0]},${p2[1]} Z" fill="${fill}" stroke="${fill}" stroke-width="1.5" stroke-linejoin="round"/>`;
}

// One shape as SVG markup (`all`: the board, for attached line ends).
export function shapeSvg(s: Shape, all: Shape[] = []): string {
  const col = colorOf(s.c);
  const stroke = `stroke="${col}" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"`;
  switch (s.t) {
    case "pen":
      return s.p.length ? `<path d="M${s.p.map(([x, y]) => `${x},${y}`).join(" L")}" ${stroke}/>` : "";
    case "line": {
      const { A, B, C } = lineGeometry(s, all);
      const r = (n: number) => Math.round(n * 10) / 10;
      const d = s.bend ? `M${r(A[0])},${r(A[1])} Q${r(C[0])},${r(C[1])} ${r(B[0])},${r(B[1])}` : `M${r(A[0])},${r(A[1])} L${r(B[0])},${r(B[1])}`;
      const heads = (s.arrow ? arrowHead(B, s.bend ? C : A, col) : "") + (s.arrow === "both" ? arrowHead(A, s.bend ? C : B, col) : "");
      return `<path d="${d}" ${stroke}/>${heads}`;
    }
    case "rect":
      return `<rect x="${Math.min(s.a[0], s.b[0])}" y="${Math.min(s.a[1], s.b[1])}" width="${Math.abs(s.b[0] - s.a[0])}" height="${Math.abs(s.b[1] - s.a[1])}" rx="6" ${stroke}/>`;
    case "ellipse":
      return `<ellipse cx="${(s.a[0] + s.b[0]) / 2}" cy="${(s.a[1] + s.b[1]) / 2}" rx="${Math.abs(s.b[0] - s.a[0]) / 2}" ry="${Math.abs(s.b[1] - s.a[1]) / 2}" ${stroke}/>`;
    case "text":
      return `<text x="${s.a[0]}" y="${s.a[1]}" font-size="${s.fs ?? 20}" font-family="Inter, system-ui, sans-serif" fill="${col}"${s.mid ? ' text-anchor="middle" dominant-baseline="central"' : ""}>${esc(s.s)}</text>`;
  }
}

// The picture of a board (print, PDF, page image): everything drawn, at
// least the 900×400 frame, with a little margin.
export function boardSvg(shapes: Shape[]): string {
  let x0 = 0, y0 = 0, x1 = BOARD_W, y1 = BOARD_H;
  for (const s of shapes) {
    const b = shapeBox(s, shapes);
    x0 = Math.min(x0, b.x0 - 20);
    y0 = Math.min(y0, b.y0 - 20);
    x1 = Math.max(x1, b.x1 + 20);
    y1 = Math.max(y1, b.y1 + 20);
  }
  const w = Math.round(x1 - x0);
  const h = Math.round(y1 - y0);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${Math.round(x0)} ${Math.round(y0)} ${w} ${h}" width="${w}" height="${h}"><rect x="${Math.round(x0)}" y="${Math.round(y0)}" width="${w}" height="${h}" fill="#fff"/>${shapes.map((s) => shapeSvg(s, shapes)).join("")}</svg>`;
}

// ── Editing placed shapes ──────────────────────────────────────────────

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
    if (s.t === "line") {
      const pts = curvePoints(s, shapes);
      if (pts.some((q, j) => segDist(p, q, pts[j + 1] ?? q) <= tolerance)) return i;
    } else if (s.t === "pen") {
      if (s.p.some((q, j) => segDist(p, q, s.p[j + 1] ?? q) <= tolerance)) return i;
    } else {
      const b = ownBox(s);
      if (p[0] >= b.x0 - tolerance && p[0] <= b.x1 + tolerance && p[1] >= b.y0 - tolerance && p[1] <= b.y1 + tolerance) return i;
    }
  }
  return -1;
}

// The box/circle/text under the point a line end could stick to, or -1.
export function attachTarget(shapes: Shape[], p: Pt): number {
  for (let i = shapes.length - 1; i >= 0; i--) {
    const s = shapes[i];
    if (s.t === "rect" || s.t === "ellipse" || s.t === "text") {
      const b = ownBox(s);
      if (p[0] >= b.x0 - 6 && p[0] <= b.x1 + 6 && p[1] >= b.y0 - 6 && p[1] <= b.y1 + 6) return i;
    }
  }
  return -1;
}

export function moveShape(s: Shape, dx: number, dy: number): Shape {
  const m = ([x, y]: Pt): Pt => clampPt([x + dx, y + dy]);
  if (s.t === "pen") return { ...s, p: s.p.map(m) };
  if (s.t === "text") return { ...s, a: m(s.a) };
  if (s.t === "line") {
    // Moving a line by hand frees it from what it was stuck to.
    const { fa: _fa, fb: _fb, ...free } = s;
    void _fa;
    void _fb;
    return { ...free, a: m(s.a), b: m(s.b) };
  }
  return { ...s, a: m(s.a), b: m(s.b) };
}

// Drag the bottom-right corner of its box to `to`: boxes and circles
// stretch, a line moves its far end, pen strokes scale.
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
  if (s.t === "line") return !s.fa && !s.fb && Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]) < 5;
  const b = ownBox(s);
  return b.x1 - b.x0 < 4 && b.y1 - b.y0 < 4;
}
