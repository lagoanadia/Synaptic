import type { Mark } from "@/lib/calmMap";

// Shared drawing for the Repasar map: a unit is a circle of dots (blue =
// known, half = seen, red = to review, hollow = new) inside its progress
// ring. Plain SVG, no state: renders on the server.

const BLUE = "#2383e2";
const RED = "#e16259";

// Evenly spread points in a disc (a sunflower), stable for the same count.
export function sunflower(n: number, radius: number): [number, number][] {
  const c = radius / Math.sqrt(Math.max(n, 1));
  return Array.from({ length: n }, (_, i) => [c * Math.sqrt(i + 0.5) * Math.cos(i * 2.39996), c * Math.sqrt(i + 0.5) * Math.sin(i * 2.39996)]);
}

export function Dot({ mark, x, y, r, current = false }: { mark: Mark; x: number; y: number; r: number; current?: boolean }) {
  if (mark === "k")
    return (
      <g>
        {current && <circle cx={x} cy={y} r={r + 6} fill="none" stroke={BLUE} strokeWidth={2} opacity={0.35} />}
        <circle cx={x} cy={y} r={r} fill={BLUE} />
        {r >= 7 && <path d={`M${x - r * 0.38},${y} l${r * 0.28},${r * 0.3} l${r * 0.5},${-r * 0.56}`} fill="none" stroke="#fff" strokeWidth={r > 9 ? 2 : 1.6} strokeLinecap="round" strokeLinejoin="round" />}
      </g>
    );
  if (mark === "p")
    return (
      <g>
        <circle cx={x} cy={y} r={r} fill="var(--background)" stroke={BLUE} strokeWidth={1.6} />
        <path d={`M${x},${y - r} A${r},${r} 0 0 0 ${x},${y + r}Z`} fill={BLUE} />
      </g>
    );
  if (mark === "r") return <circle cx={x} cy={y} r={r} fill={RED} />;
  return <circle cx={x} cy={y} r={r} fill="var(--background)" stroke="#cfcdc7" strokeWidth={1.5} />;
}

export function Ring({ cx, cy, r, pct, width = 5 }: { cx: number; cy: number; r: number; pct: number; width?: number }) {
  const c = 2 * Math.PI * r;
  return (
    <>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--color-chip)" strokeWidth={width} />
      {pct > 0 && <circle cx={cx} cy={cy} r={r} fill="none" stroke={BLUE} strokeWidth={width} strokeLinecap="round" strokeDasharray={`${Math.max(c * pct, 3)} ${c}`} transform={`rotate(-90 ${cx} ${cy})`} style={{ transition: "stroke-dasharray .9s cubic-bezier(.22,.9,.24,1)" }} />}
    </>
  );
}

// A small unit for the overview: its ring and its dots.
export function UnitBall({ marks, pct, size = 96 }: { marks: Mark[]; pct: number; size?: number }) {
  const R = size / 2 - 3;
  const pts = sunflower(marks.length, R - 10);
  const dr = marks.length > 40 ? 2.4 : 3.2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={R} fill="var(--background)" />
      <Ring cx={size / 2} cy={size / 2} r={R} pct={pct} width={4} />
      {pts.map(([x, y], i) => (
        <Dot key={i} mark={marks[i]} x={size / 2 + x} y={size / 2 + y} r={dr} />
      ))}
    </svg>
  );
}

// Red first, then half, known, new: what needs you sits in the middle.
export const ORDER: Mark[] = ["r", "p", "k", "n"];
export const known = (marks: Mark[]) => (marks.length ? marks.filter((m) => m === "k").length / marks.length : 0);
