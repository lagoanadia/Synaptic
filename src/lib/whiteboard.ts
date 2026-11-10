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
