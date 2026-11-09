import type { Avatar } from "@/lib/avatar";

// The avatar as pixel art: a 32×32 portrait with a big head, built pixel
// by pixel from simple shapes, shaded in bands and outlined in a darker
// tone of each colour (no pure black), like farm-RPG portraits.

export const N = 32;

type Px = string | null;

// "#rrggbb" towards white (t > 0) or black (t < 0).
export function shade(hex: string, t: number) {
  const n = parseInt(hex.slice(1), 16);
  const to = t > 0 ? 255 : 0;
  const k = Math.abs(t);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(v + (to - v) * k));
  return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

type Region = "bg" | "hairBack" | "shirt" | "collar" | "neck" | "ear" | "face" | "hair" | "detail";

const inEllipse = (x: number, y: number, cx: number, cy: number, rx: number, ry: number) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;

// The head: big, most of the portrait.
const HX = 16,
  HY = 14.6,
  HRX = 9,
  HRY = 9.2;
const L = HX - HRX,
  R = HX + HRX;
const inHead = (x: number, y: number) => inEllipse(x, y, HX, HY, HRX, HRY);
const inCurls = (x: number, y: number, cx: number, cy: number, rx: number, ry: number, bumps: number, depth: number) => {
  const k = 1 + depth * Math.sin(Math.atan2(y - cy, x - cx) * bumps);
  return inEllipse(x, y, cx, cy, rx * k, ry * k);
};

const LONG = new Set(["afro", "curlyBangs", "long", "longBangs", "longStraight", "sideLong"]);
const BEHIND = new Set([...LONG, "sideBuns", "braids", "ponytail", "bun"]);
const CURLY = new Set(["afro", "curlyBangs", "curlyTop", "curlyShort"]);

// Where the hair covers the forehead (y of its lower edge at x).
function fringeEdge(style: Avatar["hair"], x: number): number {
  const d = (x - HX) / HRX;
  switch (style) {
    case "afro":
      return 9.4 + d * d * 4.8;
    case "curlyBangs":
      return 10.8 + d * d * 3.2 + (Math.floor(x) % 3 === 0 ? 0.9 : 0);
    case "longBangs":
      return 11.2 + d * d * 2.4;
    case "sideSwept":
    case "sideLong":
      return 9 + (d + 1) * 2.6 - d * d * 1.6;
    case "bald":
      return 0;
    case "curlyTop":
    case "curlyShort":
      return 9.2 + d * d * 3.2;
    default:
      return 9 + d * d * 4.5 - (Math.abs(x - HX) < 0.6 ? 0.9 : 0);
  }
}

// Hair outside the head (volume, length, buns…).
function inHairShape(style: Avatar["hair"], x: number, y: number): boolean {
  const top = inEllipse(x, y, HX, HY - 0.8, HRX + 0.9, HRY + 0.5) && y < HY - 0.8;
  switch (style) {
    case "afro":
      return inCurls(x, y, HX, 14.6, 12.8, 11.8, 8, 0.06) && y < 27;
    case "curlyBangs":
      return inCurls(x, y, HX, 14.8, 12.4, 11.6, 9, 0.06) && y < 27;
    case "long":
    case "longBangs":
      return top || (x >= L - 1.6 && x <= R + 0.8 && y >= HY - 1 && y < 27.5);
    case "longStraight":
      return top || (x >= L - 1.1 && x <= R + 0.3 && y >= HY - 1 && y < 25);
    case "sideLong":
      return top || (x >= L - 1.6 && x <= R + 0.8 && y >= HY - 1 && y < (x < HX ? 27 : 23));
    case "bun":
      return top || inEllipse(x, y, HX, 3.8, 3.4, 2.9);
    case "spiky":
      return top || (y < 9 && y > 2 && (Math.abs(x - (L + 1.1)) + (9 - y) * 0.5 < 2.9 || Math.abs(x - (R - 1.1)) + (9 - y) * 0.5 < 2.9));
    case "sideBuns":
      return top || inEllipse(x, y, L - 0.3, 18.8, 2.7, 2.7) || inEllipse(x, y, R + 0.3, 18.8, 2.7, 2.7);
    case "ponytail":
      return top || (x >= R - 1.1 && x <= R + 1.8 && y >= 9 && y < 26.5 - Math.max(0, x - R - 1) * 3);
    case "braids":
      return top || ((Math.abs(x - (L - 0.3)) < 1.5 || Math.abs(x - (R + 0.3)) < 1.5) && y >= 14 && y < 27);
    case "curlyTop":
      return inCurls(x, y, HX, 7.7, 10, 5.1, 9, 0.12) && y < 10.5;
    case "curlyShort":
      return inCurls(x, y, HX, 8.6, 9.6, 4.3, 9, 0.12) && y < 10.5;
    case "short":
    case "shortNeat":
    case "sideSwept":
      return inEllipse(x, y, HX, HY - 1, HRX + 0.5, HRY + 0.3) && y < HY - 2;
    default:
      return false;
  }
}

export function pixelAvatar(a: Avatar): Px[][] {
  const region: Region[][] = [];
  const color: string[][] = [];
  const skin = a.skin;
  const hair = a.hairColor;
  const top = a.top === "suit" ? (a.topColor === "#ffffff" ? "#2b2b2b" : shade(a.topColor, -0.5)) : a.topColor;
  const showEars = !LONG.has(a.hair);

  for (let y = 0; y < N; y++) {
    region.push([]);
    color.push([]);
    for (let x = 0; x < N; x++) {
      const px = x + 0.5,
        py = y + 0.5;
      let r: Region = "bg";
      let c = py < 11 ? shade(a.bg, 0.12) : py < 21 ? shade(a.bg, 0.05) : a.bg;
      const hairShape = inHairShape(a.hair, px, py);
      if (hairShape && BEHIND.has(a.hair) && py > 7) {
        r = "hairBack";
        c = hair;
      }
      if (py >= 26 && Math.abs(px - HX) <= 5.2 + (py - 26) * 2) {
        r = "shirt";
        c = top;
      }
      if (showEars && (inEllipse(px, py, L, 16.4, 1.4, 1.9) || inEllipse(px, py, R, 16.4, 1.4, 1.9))) {
        r = "ear";
        c = skin;
      }
      if (px >= HX - 2.1 && px <= HX + 2.1 && py >= 21.5 && py < 26.5) {
        r = "neck";
        c = shade(skin, -0.12);
      }
      if (["tee", "stripes", "overalls"].includes(a.top) && py >= 26 && py < 28 && Math.abs(px - HX) <= 2.8 - (py - 26) * 1.1) {
        r = "collar";
        c = a.top === "tee" ? shade(top, 0.3) : "#ffffff";
      }
      if (inHead(px, py)) {
        r = "face";
        c = skin;
        if (py < fringeEdge(a.hair, px)) {
          r = "hair";
          c = hair;
        }
      }
      if (hairShape && r !== "face" && r !== "hair" && r !== "shirt" && r !== "neck" && (py < HY - 1 || !LONG.has(a.hair))) {
        r = "hair";
        c = hair;
      }
      region[y].push(r);
      color[y].push(c);
    }
  }

  const put = (x: number, y: number, c: string) => {
    if (x >= 0 && x < N && y >= 0 && y < N) {
      color[y][x] = c;
      region[y][x] = "detail";
    }
  };

  // Banded shading, light from the top left.
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const r = region[y][x];
      const px = x + 0.5,
        py = y + 0.5;
      if (r === "face") {
        const k = ((px - HX) / HRX) * 0.8 + (py - HY) / HRY;
        if (k > 0.98) color[y][x] = shade(skin, -0.16);
        else if (k < -1) color[y][x] = shade(skin, 0.12);
      }
      if (r === "hair" || r === "hairBack") {
        const k = Math.hypot((px - (HX - 2.4)) / 12, (py - 3) / 16);
        let c = k < 0.3 ? shade(hair, 0.18) : k < 0.92 ? hair : shade(hair, -0.22);
        if (CURLY.has(a.hair) && (x * 5 + y * 3) % 7 === 0) c = shade(c, -0.25);
        if (CURLY.has(a.hair) && (x * 3 + y * 7) % 11 === 0) c = shade(c, 0.22);
        if (!CURLY.has(a.hair) && x % 3 === 1 && r === "hairBack") c = shade(c, -0.15);
        if (r === "hairBack") c = shade(c, -0.08);
        color[y][x] = c;
      }
      if (r === "shirt") {
        const k = (px - HX) / 16;
        color[y][x] = k > 0.35 ? shade(top, -0.16) : k < -0.45 ? shade(top, 0.1) : top;
        if (a.top === "stripes") color[y][x] = (y - 28) % 2 === 0 ? (a.topColor === "#ffffff" ? "#2f7fdc" : a.topColor) : "#ffffff";
      }
    }

  // Clothes details.
  const ink = (c: string) => shade(c, -0.55);
  if (a.top === "collar") {
    for (let i = 0; i < 2; i++) put(HX - 2 + i, 26 + i, ink(top)), put(HX + 1 - i, 26 + i, ink(top));
    for (let y = 28; y < N; y++) put(HX, y, ink(top));
  }
  if (a.top === "sweater") for (let x = HX - 3; x < HX + 3; x++) put(x, 26, shade(top, 0.3));
  if (a.top === "overalls") {
    const blue = a.topColor === "#ffffff" ? "#2f7fdc" : a.topColor;
    for (let y = 29; y < N; y++) for (let x = HX - 4; x < HX + 4; x++) put(x, y, blue);
    for (let y = 27; y < 29; y++) put(HX - 4, y, ink(blue)), put(HX + 3, y, ink(blue));
  }
  if (a.top === "tie" || a.top === "suit") {
    for (let y = 26; y < 31; y++) for (let x = HX - (31 - y) * 0.5; x < HX + (31 - y) * 0.5; x++) put(Math.floor(x), y, "#ffffff");
    if (a.top === "tie") for (let y = 27; y < N; y++) put(HX - 1, y, "#d94a43"), put(HX, y, y > 28 ? "#b8362f" : "#d94a43");
    else put(HX - 2, 27, "#1d1d1d"), put(HX - 1, 27, "#1d1d1d"), put(HX, 27, "#1d1d1d"), put(HX + 1, 27, "#1d1d1d");
  }

  // Face: eyes 2×3 with a light pixel, brows, nose, mouth, blush.
  const ex = [12, 21],
    ey = 14;
  const dark = "#2a1b17";
  for (const x of ex) {
    const right = x === ex[1];
    switch (a.eyes) {
      case "happy":
        put(x - 1, ey + 1, dark), put(x, ey, dark), put(x + 1, ey + 1, dark);
        break;
      case "closed":
        put(x - 1, ey + 1, dark), put(x, ey + 2, dark), put(x + 1, ey + 1, dark);
        break;
      case "wink":
        if (right) {
          put(x - 1, ey + 1, dark), put(x, ey, dark), put(x + 1, ey + 1, dark);
          break;
        }
        for (let dy = 0; dy < 3; dy++) put(x, ey + dy, dark), put(x + 1, ey + dy, dark);
        put(x, ey, "#ffffff");
        break;
      case "big":
        for (let dy = -1; dy <= 2; dy++) for (let dx = -1; dx <= 2; dx++) put(x + dx, ey + dy, "#ffffff");
        put(x, ey, dark), put(x + 1, ey, dark), put(x, ey + 1, dark), put(x + 1, ey + 1, dark);
        break;
      case "stars":
        put(x, ey, "#f2c94c"), put(x + 1, ey, "#f2c94c"), put(x, ey + 1, "#f2c94c"), put(x + 1, ey + 1, "#f2c94c");
        put(x, ey - 1, "#f2c94c"), put(x + 1, ey + 2, "#f2c94c"), put(x - 1, ey + 1, "#f2c94c"), put(x + 2, ey, "#f2c94c");
        break;
      case "x":
        put(x - 1, ey, dark), put(x, ey + 1, dark), put(x + 1, ey + 2, dark), put(x + 1, ey, dark), put(x - 1, ey + 2, dark);
        break;
      default:
        for (let dy = 0; dy < 3; dy++) put(x, ey + dy, dark), put(x + 1, ey + dy, dark);
        put(x, ey, "#ffffff");
    }
  }
  const brow = shade(hair, -0.4);
  for (const x of ex) {
    const left = x === ex[0];
    switch (a.brows) {
      case "flat":
        for (let i = -1; i <= 2; i++) put(x + i, ey - 2, brow);
        break;
      case "raised":
        put(x - 1, ey - 2, brow), put(x, ey - 3, brow), put(x + 1, ey - 3, brow), put(x + 2, ey - 2, brow);
        break;
      case "worried":
        put(x - 1, ey - (left ? 2 : 3), brow), put(x, ey - (left ? 2 : 3), brow), put(x + 1, ey - (left ? 3 : 2), brow), put(x + 2, ey - (left ? 3 : 2), brow);
        break;
      case "angry":
        put(x - 1, ey - (left ? 3 : 2), brow), put(x, ey - (left ? 3 : 2), brow), put(x + 1, ey - (left ? 2 : 3), brow), put(x + 2, ey - (left ? 2 : 3), brow);
        break;
      default:
        put(x - 1, ey - 1, brow), put(x, ey - 2, brow), put(x + 1, ey - 2, brow), put(x + 2, ey - 1, brow);
    }
  }
  put(HX - 1, 17, shade(skin, -0.25));
  const blush = "#e98a7f";
  for (const x of [8, 9, 22, 23]) put(x, 18, blush);
  const lip = "#7a3028";
  const my = 19;
  switch (a.mouth) {
    case "lips":
      for (let x = HX - 2; x <= HX; x++) put(x, my, "#a8453a"), put(x, my + 1, lip);
      break;
    case "grin":
      for (let x = HX - 3; x <= HX + 1; x++) put(x, my, "#ffffff");
      for (let x = HX - 2; x <= HX; x++) put(x, my + 1, lip);
      put(HX - 4, my - 1, lip), put(HX + 2, my - 1, lip);
      break;
    case "laugh":
      for (let x = HX - 3; x <= HX + 1; x++) put(x, my, "#3a1512");
      for (let x = HX - 2; x <= HX; x++) put(x, my + 1, "#e86a7a");
      break;
    case "tongue":
      for (let x = HX - 3; x <= HX + 1; x++) put(x, my, lip);
      put(HX - 1, my + 1, "#e86a7a");
      break;
    case "flat":
      for (let x = HX - 2; x <= HX; x++) put(x, my, lip);
      break;
    case "o":
      put(HX - 1, my, "#3a1512"), put(HX - 1, my + 1, "#3a1512");
      break;
    case "sad":
      put(HX - 3, my + 1, lip), put(HX - 2, my, lip), put(HX - 1, my, lip), put(HX, my, lip), put(HX + 1, my + 1, lip);
      break;
    default:
      put(HX - 3, my - 1, lip), put(HX - 2, my, lip), put(HX - 1, my, lip), put(HX, my, lip), put(HX + 1, my - 1, lip);
  }

  // Glasses.
  const frame = "#2a2422";
  if (a.glasses !== "none") {
    for (const x of ex) {
      for (let dx = -2; dx <= 3; dx++)
        for (let dy = -1; dy <= 3; dy++) {
          const edge = dx === -2 || dx === 3 || dy === -1 || dy === 3;
          if (a.glasses === "round" && (dx === -2 || dx === 3) && (dy === -1 || dy === 3)) continue;
          if (edge) put(x + dx, ey + dy, frame);
          else if (a.glasses === "sun") put(x + dx, ey + dy, dy === 0 && dx === -1 ? "#5a5a5a" : "#151515");
        }
      if (a.glasses === "cat") put(x + (x === ex[0] ? -3 : 4), ey - 2, frame);
    }
    put(HX - 1, ey, frame), put(HX, ey, frame);
  }

  // Extras.
  const gold = "#e2b13c";
  if (a.extra === "earrings")
    for (const x of [Math.round(L - 0.5), Math.round(R - 0.5)])
      for (const [dx, dy] of [
        [0, 0],
        [-1, 1],
        [1, 1],
        [0, 2],
      ])
        put(x + dx, 18 + dy, gold);
  if (a.extra === "freckles")
    for (const [x, y] of [
      [9, 17],
      [11, 18],
      [10, 19],
      [22, 17],
      [24, 18],
      [23, 19],
    ])
      put(x, y, shade(skin, -0.35));
  if (a.extra === "headphones") {
    for (let x = 7; x <= 24; x++) {
      const y = Math.round(3.5 + ((x - 15.5) / 9) ** 2 * 8);
      put(x, y, "#c9c9d1"), put(x, y - 1, "#9898a3");
    }
    for (const x of [5, 25]) for (let y = 13; y < 20; y++) for (let dx = 0; dx < 2; dx++) put(x + dx, y, dx === 0 ? "#9898a3" : "#d9d9e0");
  }
  if (a.extra === "crown") {
    for (let x = 11; x <= 20; x++) for (let y = 3; y <= 4; y++) put(x, y, gold);
    for (const x of [11, 15, 16, 20]) put(x, 2, gold);
    put(15, 1, gold), put(16, 1, gold);
    put(15, 3, "#e5605a"), put(16, 3, "#e5605a");
  }

  // Outline: figure pixels touching the background take a dark tone of
  // their own colour; hair gets a line where it meets the skin.
  const out: Px[][] = color.map((row) => [...row]);
  const isBg = (x: number, y: number) => x < 0 || y < 0 || x >= N || y >= N || region[y][x] === "bg";
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const r = region[y][x];
      if (r === "bg" || r === "detail") continue;
      const touchesBg = isBg(x - 1, y) || isBg(x + 1, y) || isBg(x, y - 1) || isBg(x, y + 1);
      const hairOnFace = r === "hair" && y + 1 < N && region[y + 1][x] === "face";
      if (touchesBg || hairOnFace) out[y][x] = shade(color[y][x], -0.55);
    }

  // Circle (or rounded square) frame.
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const cx = Math.min(x, N - 1 - x),
        cy = Math.min(y, N - 1 - y);
      const inside = a.shape === "square" ? !(cx < 3 && cy < 3 && (cx - 3) ** 2 + (cy - 3) ** 2 > 9) : inEllipse(x + 0.5, y + 0.5, N / 2, N / 2, N / 2, N / 2);
      if (!inside) out[y][x] = null;
    }
  return out;
}
