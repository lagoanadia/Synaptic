"use client";

import { useId } from "react";
import type { Avatar as AvatarData } from "@/lib/avatar";

// The drawn avatar, in a 100×100 box: soft gradients, a thin dark
// outline, a big round head of hair. Measured off the profile design.

const INK = "#1b1a19";
const W = 1;
const s = { stroke: INK, strokeWidth: W, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };

// Mix a #rrggbb colour towards white (t > 0) or black (t < 0).
function shade(hex: string, t: number) {
  const n = parseInt(hex.slice(1), 16);
  const to = t > 0 ? 255 : 0;
  const k = Math.abs(t);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(v + (to - v) * k));
  return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

// Points on an ellipse, for curly outlines made of round bumps.
const ring = (cx: number, cy: number, rx: number, ry: number, n: number, r: number, from = 0, to = 360) =>
  Array.from({ length: n }, (_, i) => {
    const a = ((from + ((to - from) * i) / (to - from >= 360 ? n : n - 1)) * Math.PI) / 180;
    return [cx + rx * Math.cos(a), cy + ry * Math.sin(a), r] as const;
  });

// Bumps with one outline around the whole group: outlined circles, then
// the same circles (and a core) filled on top.
function Curls({ dots, core, fill }: { dots: (readonly [number, number, number])[]; core?: React.ReactNode; fill: string }) {
  return (
    <g>
      {dots.map(([x, y, r], i) => (
        <circle key={`o${i}`} cx={x} cy={y} r={r} fill={fill} stroke={INK} strokeWidth={W * 2} />
      ))}
      {dots.map(([x, y, r], i) => (
        <circle key={`f${i}`} cx={x} cy={y} r={r} fill={fill} />
      ))}
      {core}
    </g>
  );
}

const EARS = new Set(["spiky", "bun", "sideSwept", "short", "bald", "curlyTop", "curlyShort", "ponytail", "braids", "shortNeat"]);

function HairBack({ a, fill }: { a: AvatarData; fill: string }) {
  switch (a.hair) {
    case "afro":
      return <Curls fill={fill} dots={ring(49.8, 55, 21.5, 20, 11, 11.5)} core={<ellipse cx={49.8} cy={55} rx={25} ry={23} fill={fill} />} />;
    case "curlyBangs":
      return <Curls fill={fill} dots={ring(50, 52, 23, 19.5, 15, 9)} core={<ellipse cx={50} cy={52} rx={25} ry={21} fill={fill} />} />;
    case "long":
    case "longBangs":
      return <path d="M30 52 Q29 30.5 50 30 Q71 30.5 70 52 L71.5 80 Q60 83 50 82 Q40 83 28.5 80 Z" fill={fill} {...s} />;
    case "longStraight":
      return <path d="M31 52 Q30 31 50 30.5 Q70 31 69 52 L69.5 76 L30.5 76 Z" fill={fill} {...s} />;
    case "sideLong":
      return <path d="M30 52 Q29 30.5 50 30 Q71 30.5 70 52 L71 79 Q62 82 55 80 L30 76 Z" fill={fill} {...s} />;
    case "bun":
      return <circle cx={50} cy={29} r={6} fill={fill} {...s} />;
    case "sideBuns":
      return (
        <g>
          <circle cx={29.5} cy={61} r={5.2} fill={fill} {...s} />
          <circle cx={70} cy={61} r={5.2} fill={fill} {...s} />
        </g>
      );
    case "ponytail":
      return <path d="M64 40 Q75 42 74 58 Q73 72 70 82 Q66 70 67 56 Z" fill={fill} {...s} />;
    case "braids":
      return (
        <g>
          {[30.5, 68.8].map((x) =>
            Array.from({ length: 5 }, (_, i) => <ellipse key={`${x}${i}`} cx={x} cy={62 + i * 4.6} rx={2.9} ry={2.7} fill={fill} {...s} />),
          )}
        </g>
      );
    case "spiky":
      return (
        <g>
          {[
            [33, 37, -1],
            [66.5, 37, 1],
          ].map(([x, y, d]) => (
            <path
              key={x}
              d={`M${x} ${y} l${-4 * d} -4 l${4.5 * d} 0.6 l0 -5 l${3.2 * d} 4.2 l${3.4 * d} -3 l-0.6 ${4.6} Z`}
              fill={fill}
              {...s}
            />
          ))}
        </g>
      );
    default:
      return null;
  }
}

// The hair over the head: fringe, cap or curls. Drawn after the face.
function HairFront({ a, fill, dark }: { a: AvatarData; fill: string; dark: string }) {
  const cap = (d: string) => <path d={d} fill={fill} {...s} />;
  switch (a.hair) {
    case "afro":
      // A darker band over the forehead, fading into the curls above.
      return (
        <g>
          <path d="M31.4 55 Q30.5 35 50 33.5 Q69.5 35 67.8 52.5 Q60 43.5 50 43 Q40 43.5 31.4 55 Z" fill={dark} />
          <path d="M31.4 55 Q40 43.5 50 43 Q60 43.5 67.8 52.5" fill="none" {...s} />
        </g>
      );
    case "curlyBangs":
      return (
        <g>
          <path d="M31.4 55 Q30.5 35 50 33.5 Q69.5 35 67.8 52.5 Q60 46 50 46 Q40 46 31.4 55 Z" fill={dark} />
          <Curls fill={dark} dots={[...ring(50, 47.5, 15, 4, 7, 3.4, 180, 360), [37, 48.5, 3.4], [63, 48.5, 3.4]]} />
        </g>
      );
    case "long":
    case "longStraight":
      return (
        <g>
          {cap("M31.6 57 Q30.8 34.5 50 33.5 Q69.2 34.5 67.8 57 Q66 45 50 41.5 Q34 45 31.6 57 Z")}
          <path d="M50 34.5 L50 41.3" {...s} strokeWidth={0.8} />
        </g>
      );
    case "longBangs":
      return cap("M31.6 56 Q30.8 34 50 33.5 Q69.2 34 67.8 56 L67.6 48.5 Q50 46.5 31.8 48.5 Z");
    case "sideLong":
      return cap("M31.6 58 Q30.8 34 50 33.5 Q69.2 34 67.8 54 Q62 42 50 41.5 Q40 44 35 52 Q33 55 31.6 58 Z");
    case "sideSwept":
      return cap("M32.2 53 Q31.5 34.5 50 34 Q68.5 34.5 67.4 52 Q64 42.5 52 41 Q42 42 36 48.5 Q33.5 50.5 32.2 53 Z");
    case "short":
      return cap("M32.3 51 Q31.5 34.8 50 34.2 Q68.5 34.8 67.3 51 Q66 43.5 58 42.3 Q50 43.6 42 42.3 Q34 43.5 32.3 51 Z");
    case "shortNeat":
      return (
        <g>
          {cap("M32.3 51 Q31.5 34.5 50 34 Q68.5 34.5 67.3 51 Q65 43 56 41.5 L43 42 Q35 43.5 32.3 51 Z")}
          <path d="M43 36 L43.5 42" {...s} strokeWidth={0.8} />
        </g>
      );
    case "bun":
    case "spiky":
    case "sideBuns":
    case "ponytail":
    case "braids":
      return (
        <g>
          {cap("M32 54 Q31 34.5 50 34 Q69 34.5 67.6 54 Q66 44 50 41.8 Q34 44 32 54 Z")}
          <path d="M50 34.6 L50 41.6" {...s} strokeWidth={0.8} />
        </g>
      );
    case "curlyTop":
      return <Curls fill={fill} dots={ring(50, 41, 17, 7, 9, 5.2, 180, 360)} core={<ellipse cx={50} cy={41} rx={17} ry={6} fill={fill} />} />;
    case "curlyShort":
      return <Curls fill={fill} dots={[...ring(50, 42.5, 16.5, 5.5, 9, 4.3, 170, 370)]} core={<ellipse cx={50} cy={40} rx={16} ry={5.5} fill={fill} />} />;
    default:
      return null;
  }
}

function Eyes({ a }: { a: AvatarData }) {
  const y = 57.6;
  const xs = [41.6, 57.6];
  const dot = (x: number) => <circle key={x} cx={x} cy={y} r={2.5} fill={INK} />;
  const up = (x: number) => <path key={x} d={`M${x - 2.7} ${y + 0.8} Q${x} ${y - 2.6} ${x + 2.7} ${y + 0.8}`} fill="none" {...s} strokeWidth={1.1} />;
  const down = (x: number) => <path key={x} d={`M${x - 2.7} ${y - 0.6} Q${x} ${y + 2.2} ${x + 2.7} ${y - 0.6}`} fill="none" {...s} strokeWidth={1.1} />;
  switch (a.eyes) {
    case "happy":
      return <g>{xs.map(up)}</g>;
    case "wink":
      return <g>{dot(xs[0])}{up(xs[1])}</g>;
    case "closed":
      return <g>{xs.map(down)}</g>;
    case "big":
      return (
        <g>
          {xs.map((x) => (
            <g key={x}>
              <circle cx={x} cy={y} r={3.5} fill="#fff" {...s} />
              <circle cx={x} cy={y} r={1.8} fill={INK} />
            </g>
          ))}
        </g>
      );
    case "stars":
      return (
        <g>
          {xs.map((x) => (
            <path
              key={x}
              d={`M${x} ${y - 3.2} L${x + 0.95} ${y - 1} L${x + 3.2} ${y - 0.8} L${x + 1.5} ${y + 0.8} L${x + 2} ${y + 3.1} L${x} ${y + 1.9} L${x - 2} ${y + 3.1} L${x - 1.5} ${y + 0.8} L${x - 3.2} ${y - 0.8} L${x - 0.95} ${y - 1} Z`}
              fill="#f2c94c"
              stroke={INK}
              strokeWidth={0.7}
              strokeLinejoin="round"
            />
          ))}
        </g>
      );
    case "x":
      return (
        <g>
          {xs.map((x) => (
            <path key={x} d={`M${x - 2} ${y - 2} L${x + 2} ${y + 2} M${x + 2} ${y - 2} L${x - 2} ${y + 2}`} {...s} strokeWidth={1.1} />
          ))}
        </g>
      );
    default:
      return <g>{xs.map(dot)}</g>;
  }
}

function Brows({ a }: { a: AvatarData }) {
  const pair = (l: string, r: string, w = 0.95) => (
    <g fill="none" {...s} strokeWidth={w}>
      <path d={l} />
      <path d={r} />
    </g>
  );
  switch (a.brows) {
    case "flat":
      return pair("M38.6 52.3 L44.4 52", "M54.8 52 L60.6 52.3", 1.5);
    case "raised":
      return pair("M38.6 51.6 Q41.5 48.6 44.4 50.6", "M54.8 50.6 Q57.7 48.6 60.6 51.6");
    case "worried":
      return pair("M38.8 52.6 Q41.8 51.6 44.4 50.6", "M54.8 50.6 Q57.4 51.6 60.4 52.6");
    case "angry":
      return pair("M38.8 50.6 Q41.8 51.4 44.6 53", "M54.6 53 Q57.4 51.4 60.4 50.6", 1.3);
    default:
      return pair("M38.4 52.6 Q41.4 50.2 44.4 51.6", "M54.8 51.6 Q57.8 50.2 60.8 52.6");
  }
}

function Mouth({ a }: { a: AvatarData }) {
  switch (a.mouth) {
    case "lips":
      return (
        <g>
          <path d="M46.2 65.6 Q48 64.3 49.7 65.1 Q51.4 64.3 53.2 65.6 Q51.6 68.6 49.7 68.6 Q47.8 68.6 46.2 65.6 Z" fill="#6b2a24" {...s} strokeWidth={0.8} />
          <path d="M46.6 65.8 Q49.7 66.6 52.8 65.8" fill="none" stroke="#3a1512" strokeWidth={0.6} />
        </g>
      );
    case "grin":
      return (
        <g>
          <path d="M45.4 64.8 L54 64.8 Q53.6 69.8 49.7 69.8 Q45.8 69.8 45.4 64.8 Z" fill="#fff" {...s} />
          <path d="M49.7 64.8 L49.7 67" {...s} strokeWidth={0.6} />
        </g>
      );
    case "laugh":
      return (
        <g>
          <path d="M45.4 64.6 L54 64.6 Q53.6 70 49.7 70 Q45.8 70 45.4 64.6 Z" fill="#2a1311" {...s} />
          <path d="M46.6 64.9 L52.8 64.9 L52.6 66 L46.8 66 Z" fill="#fff" />
        </g>
      );
    case "tongue":
      return (
        <g>
          <path d="M47.9 66.6 L51.5 66.6 L51.5 68.6 Q49.7 70.6 47.9 68.6 Z" fill="#ec6f7c" {...s} strokeWidth={0.8} />
          <path d="M44.9 65.2 Q49.7 68.6 54.5 65.2" fill="none" {...s} />
        </g>
      );
    case "flat":
      return <path d="M46.4 66.6 L53 66.6" {...s} />;
    case "o":
      return <ellipse cx={49.7} cy={66.8} rx={1.9} ry={2.4} fill="#2a1311" {...s} strokeWidth={0.8} />;
    case "sad":
      return <path d="M45.6 68 Q49.7 64.4 53.8 68" fill="none" {...s} />;
    default:
      return <path d="M44.7 65.2 Q49.7 69.6 54.7 65.2" fill="none" {...s} />;
  }
}

// The crew neck's lighter U, drawn over the bottom of the neck.
function Collar({ a }: { a: AvatarData }) {
  if (a.top !== "tee" && a.top !== "stripes" && a.top !== "overalls") return null;
  const fill = a.top === "tee" ? shade(a.topColor, 0.3) : "#fff";
  return <path d="M43.6 81.9 Q49.7 88 55.8 81.9 Z" fill={fill} {...s} />;
}

// Shoulders and clothes; the neckline sits at y≈82.
function Top({ a, fill }: { a: AvatarData; fill: string }) {
  const c = a.topColor;
  const white = c === "#ffffff";
  const body = "M8 104 Q11 88 30 84.2 Q40 81.8 49.7 81.8 Q59.4 81.8 69.4 84.2 Q88.4 88 91.4 104 Z";
  switch (a.top) {
    case "collar":
      return (
        <g>
          <path d={body} fill={fill} {...s} />
          <path d="M44.6 82 L49.7 87.6 L54.8 82" fill={shade(c, 0.25)} {...s} />
          <path d="M49.7 87.6 L49.7 104" {...s} strokeWidth={0.8} />
        </g>
      );
    case "sweater":
      return (
        <g>
          <path d={body} fill={fill} {...s} />
          <path d="M41 82.4 Q49.7 90 58.4 82.4" fill={shade(c, 0.3)} {...s} />
        </g>
      );
    case "stripes":
      return (
        <g>
          <clipPath id="av-body">
            <path d={body} />
          </clipPath>
          <path d={body} fill="#fff" />
          <g clipPath="url(#av-body)">
            {[88.5, 93, 97.5].map((y) => (
              <rect key={y} x={0} y={y} width={100} height={2.3} fill={white ? "#2f7fdc" : c} />
            ))}
          </g>
          <path d={body} fill="none" {...s} />
        </g>
      );
    case "overalls":
      return (
        <g>
          <path d={body} fill="#fff" {...s} />
          <path d="M37 104 L37.6 90.5 L61.8 90.5 L62.4 104 Z" fill={white ? "#2f7fdc" : c} {...s} />
          <path d="M37.6 90.5 L35.6 84.2 M61.8 90.5 L63.8 84.2" {...s} strokeWidth={1.4} />
        </g>
      );
    case "tie":
      return (
        <g>
          <path d={body} fill={fill} {...s} />
          <path d="M44.2 82 L49.7 92 L55.2 82 Z" fill="#fff" {...s} />
          <path d="M48.6 84.6 L50.8 84.6 L51.8 94 L49.7 96.4 L47.6 94 Z" fill="#d94a43" {...s} strokeWidth={0.8} />
          <path d="M44.2 82 L47.4 88.6 L45.6 90 M55.2 82 L52 88.6 L53.8 90" fill="none" {...s} strokeWidth={0.8} />
        </g>
      );
    case "suit":
      return (
        <g>
          <path d={body} fill={white ? "#262626" : shade(c, -0.55)} {...s} />
          <path d="M44.4 82 L49.7 93 L55 82 Z" fill="#fff" {...s} />
          <path d="M47.4 85.2 L49.7 86.4 L52 85.2 L52 87.8 L49.7 86.6 L47.4 87.8 Z" fill={INK} />
        </g>
      );
    default:
      return (
        <g>
          <path d={body} fill={fill} {...s} />
        </g>
      );
  }
}

function Glasses({ a }: { a: AvatarData }) {
  const y = 57.6;
  const f = { fill: "none", ...s, strokeWidth: 1 };
  switch (a.glasses) {
    case "square":
      return (
        <g>
          <rect x={37.3} y={y - 3.4} width={8.6} height={6.6} rx={1.4} {...f} />
          <rect x={53.3} y={y - 3.4} width={8.6} height={6.6} rx={1.4} {...f} />
          <path d={`M45.9 ${y - 1} L53.3 ${y - 1}`} {...f} />
        </g>
      );
    case "round":
      return (
        <g>
          <circle cx={41.6} cy={y} r={3.9} {...f} />
          <circle cx={57.6} cy={y} r={3.9} {...f} />
          <path d={`M45.5 ${y - 0.8} Q49.6 ${y - 2.2} 53.7 ${y - 0.8}`} {...f} />
        </g>
      );
    case "cat":
      return (
        <g>
          <path d={`M37 ${y - 3.2} L46 ${y - 3.2} L45.6 ${y + 1} Q41.6 ${y + 3.6} 37.6 ${y + 1} Z`} {...f} />
          <path d={`M53.2 ${y - 3.2} L62.2 ${y - 3.2} L61.6 ${y + 1} Q57.6 ${y + 3.6} 53.6 ${y + 1} Z`} {...f} />
          <path d={`M37 ${y - 3.2} L46 ${y - 3.2} M53.2 ${y - 3.2} L62.2 ${y - 3.2}`} {...s} strokeWidth={1.8} />
          <path d={`M46 ${y - 1.6} L53.2 ${y - 1.6}`} {...f} />
        </g>
      );
    case "sun":
      return (
        <g>
          <path d={`M36.8 ${y - 3} L46.2 ${y - 3} L45.8 ${y + 0.6} Q41.6 ${y + 4} 37.4 ${y + 0.6} Z`} fill="#141414" {...s} />
          <path d={`M53 ${y - 3} L62.4 ${y - 3} L61.8 ${y + 0.6} Q57.6 ${y + 4} 53.4 ${y + 0.6} Z`} fill="#141414" {...s} />
          <path d={`M46.2 ${y - 2} L53 ${y - 2}`} {...s} />
          <path d={`M39 ${y - 1.6} L41.6 ${y - 1.6} M55.2 ${y - 1.6} L57.8 ${y - 1.6}`} stroke="#fff" strokeWidth={0.7} strokeLinecap="round" opacity={0.75} />
        </g>
      );
    default:
      return null;
  }
}

function Extra({ a }: { a: AvatarData }) {
  switch (a.extra) {
    case "earrings":
      return (
        <g fill="none">
          {[30.4, 68.8].map((x) => (
            <g key={x}>
              <circle cx={x} cy={63.6} r={2.4} stroke={INK} strokeWidth={1.8} />
              <circle cx={x} cy={63.6} r={2.4} stroke="#dba83b" strokeWidth={1.05} />
            </g>
          ))}
        </g>
      );
    case "freckles":
      return (
        <g fill="#8a4b2f" opacity={0.75}>
          {[
            [38.6, 61.6],
            [40.4, 62.6],
            [42.2, 61.4],
            [56.8, 61.4],
            [58.6, 62.6],
            [60.4, 61.6],
          ].map(([x, y]) => (
            <circle key={`${x}${y}`} cx={x} cy={y} r={0.45} />
          ))}
        </g>
      );
    case "headphones":
      return (
        <g>
          <path d="M28.6 58 Q28 29.5 49.7 29 Q71.4 29.5 70.8 58" fill="none" stroke={INK} strokeWidth={4.2} strokeLinecap="round" />
          <path d="M28.6 58 Q28 29.5 49.7 29 Q71.4 29.5 70.8 58" fill="none" stroke="#d6d6db" strokeWidth={2.4} strokeLinecap="round" />
          <rect x={25} y={53.5} width={7.4} height={12} rx={3.4} fill="#d6d6db" {...s} />
          <rect x={67} y={53.5} width={7.4} height={12} rx={3.4} fill="#d6d6db" {...s} />
        </g>
      );
    case "crown":
      return (
        <g>
          <path d="M41 35.5 L40 26.5 L45.2 30.4 L49.7 24 L54.2 30.4 L59.4 26.5 L58.4 35.5 Z" fill="#f2c94c" {...s} />
          <circle cx={49.7} cy={31.6} r={1.1} fill="#e5605a" />
        </g>
      );
  }
}

// `view` crops it (the editor zooms options in on the face or the clothes);
// `plain` swaps the background for the options' cream.
export function Avatar({
  avatar: a,
  size = 40,
  className = "",
  title,
  view = "0 0 100 100",
  plain = false,
}: {
  avatar: AvatarData;
  size?: number;
  className?: string;
  title?: string;
  view?: string;
  plain?: boolean;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const id = (k: string) => `${k}${uid}`;
  const hair = a.hairColor;
  const hairFill = `url(#${id("hair")})`;
  const [vx, vy, vw, vh] = view.split(" ").map(Number);
  return (
    <svg viewBox={view} width={size} height={size} className={className} role="img" aria-label={title ?? "Avatar"}>
      <defs>
        <linearGradient id={id("bg")} gradientUnits="userSpaceOnUse" x1="0" y1={vy} x2="0" y2={vy + vh}>
          <stop offset="0" stopColor={plain ? "#f4f1ec" : shade(a.bg, 0.1)} />
          <stop offset="1" stopColor={plain ? "#dcd7ce" : shade(a.bg, -0.06)} />
        </linearGradient>
        <linearGradient id={id("hair")} gradientUnits="userSpaceOnUse" x1="0" y1="22" x2="0" y2="84">
          <stop offset="0" stopColor={shade(hair, 0.24)} />
          <stop offset="1" stopColor={shade(hair, -0.2)} />
        </linearGradient>
        <linearGradient id={id("dark")} gradientUnits="userSpaceOnUse" x1="0" y1="33" x2="0" y2="46">
          <stop offset="0" stopColor={shade(hair, 0.08)} stopOpacity={0} />
          <stop offset="0.75" stopColor={shade(hair, -0.05)} />
        </linearGradient>
        <linearGradient id={id("top")} gradientUnits="userSpaceOnUse" x1="0" y1="82" x2="0" y2="100">
          <stop offset="0" stopColor={shade(a.topColor, 0.1)} />
          <stop offset="1" stopColor={shade(a.topColor, -0.08)} />
        </linearGradient>
        <clipPath id={id("clip")}>
          {a.shape === "square" ? <rect x={vx} y={vy} width={vw} height={vh} rx={vw * 0.24} /> : <circle cx={vx + vw / 2} cy={vy + vh / 2} r={vw / 2} />}
        </clipPath>
      </defs>
      <g clipPath={`url(#${id("clip")})`}>
        <rect x={vx} y={vy} width={vw} height={vh} fill={`url(#${id("bg")})`} />
        <HairBack a={a} fill={hairFill} />
        {EARS.has(a.hair) && (
          <g>
            <ellipse cx={32.4} cy={58.6} rx={2.6} ry={3.4} fill={a.skin} {...s} />
            <ellipse cx={66.9} cy={58.6} rx={2.6} ry={3.4} fill={a.skin} {...s} />
          </g>
        )}
        <Top a={a} fill={`url(#${id("top")})`} />
        <path d="M45.2 70 L45.2 82.4 L54.2 82.4 L54.2 70 Z" fill={a.skin} {...s} />
        <Collar a={a} />
        <ellipse cx={49.6} cy={57.4} rx={18.2} ry={16} fill={a.skin} {...s} />
        <HairFront a={a} fill={hairFill} dark={`url(#${id("dark")})`} />
        <ellipse cx={40.6} cy={62.6} rx={2.7} ry={1.7} fill="#ef8a80" opacity={0.6} />
        <ellipse cx={58.7} cy={62.6} rx={2.7} ry={1.7} fill="#ef8a80" opacity={0.6} />
        <Brows a={a} />
        <Eyes a={a} />
        <path d="M48.9 60.7 Q49.6 61.6 50.3 60.7" fill="none" {...s} strokeWidth={0.8} />
        <Mouth a={a} />
        <Glasses a={a} />
        <Extra a={a} />
      </g>
    </svg>
  );
}
