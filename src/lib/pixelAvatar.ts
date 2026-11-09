import type { Avatar } from "@/lib/avatar";

// The avatar as pixel art: a 40×40 portrait built pixel by pixel from
// simple shapes, then shaded in bands and outlined in a darker tone of
// each colour (no pure black), like farm-RPG portraits.

export const N = 40;

type Px = string | null;

// "#rrggbb" towards white (t > 0) or black (t < 0).
export function shade(hex: string, t: number) {
  const n = parseInt(hex.slice(1), 16);
  const to = t > 0 ? 255 : 0;
  const k = Math.abs(t);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(v + (to - v) * k));
  return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

// Regions, back to front. Each pixel keeps the last region painted on it.
type Region = "bg" | "hairBack" | "shirt" | "collar" | "neck" | "ear" | "face" | "hair" | "detail";

const inEllipse = (x: number, y: number, cx: number, cy: number, rx: number, ry: number) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;

// Head geometry (pixel centres are x + .5).
const HX = 20,
  HY = 19.6,
  HRX = 8.7,
  HRY = 9.3;
const inHead = (x: number, y: number) => inEllipse(x, y, HX, HY, HRX, HRY);
// A bumpy blob, for curls.
const inCurls = (x: number, y: number, cx: number, cy: number, rx: number, ry: number, bumps: number, depth: number) => {
  const a = Math.atan2(y - cy, x - cx);
  const k = 1 + depth * Math.sin(a * bumps);
  return inEllipse(x, y, cx, cy, rx * k, ry * k);
};

// Where the hair covers the forehead, per style (y of the fringe edge at x).
function fringeEdge(style: Avatar["hair"], x: number): number {
  const d = (x - HX) / HRX; // -1..1 across the face
  switch (style) {
    case "afro":
      return 13.6 + d * d * 4.5;
    case "curlyBangs":
      return 15.2 + d * d * 3 + (Math.floor(x) % 3 === 0 ? 0.8 : 0);
    case "longBangs":
      return 15.5 + d * d * 2.5;
    case "sideSwept":
    case "sideLong":
      return 13 + (d + 1) * 2.6 - d * d * 1.5;
    case "bald":
      return 0;
    case "curlyTop":
    case "curlyShort":
      return 13.4 + d * d * 3;
    default:
      return 13.2 + d * d * 4.2 - (Math.abs(x - HX + 0.5) < 1 ? 0.8 : 0);
  }
}

// Hair outside the head silhouette (volume, length, buns…).
function inHairShape(style: Avatar["hair"], x: number, y: number): boolean {
  const top = inEllipse(x, y, HX, HY - 1, HRX + 1, HRY + 0.6) && y < HY - 1;
  switch (style) {
    case "afro":
      return inCurls(x, y, HX, 18.6, 12.6, 12.4, 8, 0.07) && y < 33;
    case "curlyBangs":
      return inCurls(x, y, HX, 19, 12, 12, 9, 0.07) && y < 33;
    case "long":
    case "longBangs":
      return top || (x >= HX - HRX - 1.6 && x <= HX + HRX + 0.6 && y >= HY - 1 && y < 33.5);
    case "longStraight":
      return top || (x >= HX - HRX - 1 && x <= HX + HRX && y >= HY - 1 && y < 30);
    case "sideLong":
      return top || (x >= HX - HRX - 1.6 && x <= HX + HRX + 0.6 && y >= HY - 1 && y < (x < HX ? 32 : 28));
    case "bun":
      return top || inEllipse(x, y, HX, 8.6, 3.6, 3.2);
    case "spiky":
      return top || (y < 13 && y > 6 && (Math.abs(x - 10.5) + (13 - y) * 0.5 < 3.2 || Math.abs(x - 29.5) + (13 - y) * 0.5 < 3.2));
    case "sideBuns":
      return top || inEllipse(x, y, 10.6, 24.5, 2.9, 2.9) || inEllipse(x, y, 29.4, 24.5, 2.9, 2.9);
    case "ponytail":
      return top || (x >= 27.5 && x <= 30.5 && y >= 13 && y < 32 - Math.max(0, x - 29.6) * 3);
    case "braids":
      return top || ((Math.abs(x - 10.8) < 1.6 || Math.abs(x - 29.2) < 1.6) && y >= 18 && y < 33);
    case "curlyTop":
      return inCurls(x, y, HX, 12.4, 9.6, 5.6, 9, 0.12) && y < 15;
    case "curlyShort":
      return inCurls(x, y, HX, 13.4, 9.4, 4.8, 9, 0.12) && y < 15;
    case "short":
    case "shortNeat":
    case "sideSwept":
      return inEllipse(x, y, HX, HY - 1.2, HRX + 0.6, HRY + 0.4) && y < HY - 2.6;
    default:
      return false;
  }
}

// The pixel grid: a colour (or null for outside the circle) per pixel.
export function pixelAvatar(a: Avatar): Px[][] {
  const region: Region[][] = [];
  const color: string[][] = [];
  const skin = a.skin;
  const hair = a.hairColor;
  const top = a.top === "suit" ? (a.topColor === "#ffffff" ? "#2b2b2b" : shade(a.topColor, -0.5)) : a.topColor;
  const longStyles = new Set(["afro", "curlyBangs", "long", "longBangs", "longStraight", "sideLong"]);
  const showEars = !longStyles.has(a.hair);

  for (let y = 0; y < N; y++) {
    region.push([]);
    color.push([]);
    for (let x = 0; x < N; x++) {
      const px = x + 0.5,
        py = y + 0.5;
      let r: Region = "bg";
      // Background: two tones, lighter at the top.
      let c = py < 14 ? shade(a.bg, 0.12) : py < 26 ? shade(a.bg, 0.05) : a.bg;
      const hairShape = inHairShape(a.hair, px, py);
      // Long hair and volume sit behind everything.
      if (hairShape && (longStyles.has(a.hair) || ["sideBuns", "braids", "ponytail", "bun"].includes(a.hair)) && py > 9) {
        r = "hairBack";
        c = hair;
      }
      // Shoulders.
      const half = 7.4 + (py - 31) * 2.6;
      if (py >= 31 && Math.abs(px - HX) <= half) {
        r = "shirt";
        c = top;
      }
      // Ears.
      if (showEars && (inEllipse(px, py, HX - HRX, 21.5, 1.6, 2.2) || inEllipse(px, py, HX + HRX, 21.5, 1.6, 2.2))) {
        r = "ear";
        c = skin;
      }
      // Neck.
      if (px >= HX - 3 && px <= HX + 3 && py >= 26 && py < 32) {
        r = "neck";
        c = shade(skin, -0.12);
      }
      // Crew neck.
      if (["tee", "stripes", "overalls"].includes(a.top) && py >= 31 && py < 33 && Math.abs(px - HX) <= 3.6 - (py - 31) * 1.2) {
        r = "collar";
        c = a.top === "tee" ? shade(top, 0.3) : "#ffffff";
      }
      // Head.
      if (inHead(px, py)) {
        r = "face";
        c = skin;
        if (py < fringeEdge(a.hair, px)) {
          r = "hair";
          c = hair;
        }
      }
      // Hair over the top of the head (caps, curls, spikes, buns).
      if (hairShape && r !== "face" && r !== "hair" && (py < HY - 1 || !longStyles.has(a.hair)) && r !== "shirt" && r !== "neck") {
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

  // Shading in bands: light from the top left.
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const r = region[y][x];
      const px = x + 0.5,
        py = y + 0.5;
      if (r === "face") {
        const k = (px - HX) / HRX + (py - HY) / HRY;
        if (k > 0.95) color[y][x] = shade(skin, -0.16);
        else if (k < -0.9) color[y][x] = shade(skin, 0.12);
      }
      if (r === "hair" || r === "hairBack") {
        // Curls get a dithered texture; straight hair gets strands.
        const curly = ["afro", "curlyBangs", "curlyTop", "curlyShort"].includes(a.hair);
        const k = (py - 10) / 22 + (px - HX) / 30;
        let c = k < 0.12 ? shade(hair, 0.22) : k < 0.55 ? hair : shade(hair, -0.22);
        if (curly && (x * 5 + y * 3) % 7 === 0) c = shade(c, -0.25);
        if (curly && (x * 3 + y * 7) % 11 === 0) c = shade(c, 0.22);
        if (!curly && x % 4 === 1 && r === "hairBack") c = shade(c, -0.15);
        if (r === "hairBack") c = shade(c, -0.08);
        color[y][x] = c;
      }
      if (r === "shirt") {
        const k = (px - HX) / 20;
        color[y][x] = k > 0.35 ? shade(top, -0.16) : k < -0.45 ? shade(top, 0.1) : top;
        if (a.top === "stripes") color[y][x] = (y - 33) % 3 === 0 ? (a.topColor === "#ffffff" ? "#2f7fdc" : a.topColor) : "#ffffff";
      }
    }

  // Clothes details.
  const ink = (c: string) => shade(c, -0.55);
  if (a.top === "collar") {
    for (let i = 0; i < 3; i++) {
      put(HX - 3 + i, 31 + i, ink(top));
      put(HX + 2 - i, 31 + i, ink(top));
    }
    for (let y = 34; y < N; y++) put(HX, y, ink(top));
  }
  if (a.top === "sweater") for (let x = HX - 4; x < HX + 4; x++) put(x, 31, shade(top, 0.3));
  if (a.top === "overalls") {
    for (let y = 35; y < N; y++) for (let x = HX - 6; x < HX + 6; x++) put(x, y, a.topColor === "#ffffff" ? "#2f7fdc" : a.topColor);
    for (let y = 32; y < 35; y++) {
      put(HX - 6, y, ink("#2f7fdc"));
      put(HX + 5, y, ink("#2f7fdc"));
    }
  }
  if (a.top === "tie" || a.top === "suit") {
    for (let y = 31; y < 37; y++) for (let x = HX - (37 - y) * 0.5; x < HX + (37 - y) * 0.5; x++) put(Math.floor(x), y, "#ffffff");
    if (a.top === "tie") for (let y = 32; y < 39; y++) put(HX - 1, y, "#d94a43"), put(HX, y, y > 33 ? "#b8362f" : "#d94a43");
    else put(HX - 2, 32, "#1d1d1d"), put(HX - 1, 33, "#1d1d1d"), put(HX, 33, "#1d1d1d"), put(HX + 1, 32, "#1d1d1d");
  }

  // Face. Eyes 2×3 with a light pixel; brows; nose; mouth; blush.
  const ex = [15, 24],
    ey = 20;
  const dark = "#2a1b17";
  for (const x of ex) {
    switch (a.eyes) {
      case "happy":
        put(x - 1, ey + 1, dark), put(x, ey, dark), put(x + 1, ey + 1, dark);
        break;
      case "closed":
        put(x - 1, ey, dark), put(x, ey + 1, dark), put(x + 1, ey, dark);
        break;
      case "wink":
        if (x === ex[1]) {
          put(x - 1, ey + 1, dark), put(x, ey, dark), put(x + 1, ey + 1, dark);
          break;
        }
        put(x, ey, dark), put(x, ey + 1, dark), put(x - 1, ey, dark), put(x - 1, ey + 1, dark), put(x - 1, ey, "#ffffff");
        break;
      case "big":
        for (let dy = -1; dy <= 2; dy++) for (let dx = -2; dx <= 1; dx++) put(x + dx, ey + dy, "#ffffff");
        put(x - 1, ey, dark), put(x, ey, dark), put(x - 1, ey + 1, dark), put(x, ey + 1, dark);
        break;
      case "stars":
        put(x - 1, ey, "#f2c94c"), put(x, ey, "#f2c94c"), put(x - 1, ey + 1, "#f2c94c"), put(x, ey + 1, "#f2c94c");
        put(x - 1, ey - 1, "#f2c94c"), put(x, ey + 2, "#f2c94c"), put(x - 2, ey + 1, "#f2c94c"), put(x + 1, ey, "#f2c94c");
        break;
      case "x":
        put(x - 2, ey - 1, dark), put(x - 1, ey, dark), put(x, ey + 1, dark), put(x + 1, ey + 2, dark);
        put(x + 1, ey - 1, dark), put(x, ey, dark), put(x - 1, ey + 1, dark), put(x - 2, ey + 2, dark);
        break;
      default:
        put(x - 1, ey, dark), put(x, ey, dark), put(x - 1, ey + 1, dark), put(x, ey + 1, dark), put(x - 1, ey + 2, dark), put(x, ey + 2, dark);
        put(x - 1, ey, "#ffffff");
    }
  }
  const brow = shade(hair, -0.4);
  for (const x of ex) {
    const left = x === ex[0];
    switch (a.brows) {
      case "flat":
        for (let i = -2; i <= 1; i++) put(x + i, ey - 3, brow);
        break;
      case "raised":
        put(x - 2, ey - 3, brow), put(x - 1, ey - 4, brow), put(x, ey - 4, brow), put(x + 1, ey - 3, brow);
        break;
      case "worried":
        put(x - 2, ey - (left ? 2 : 4), brow), put(x - 1, ey - 3, brow), put(x, ey - 3, brow), put(x + 1, ey - (left ? 4 : 2), brow);
        break;
      case "angry":
        put(x - 2, ey - (left ? 4 : 2), brow), put(x - 1, ey - 3, brow), put(x, ey - 3, brow), put(x + 1, ey - (left ? 2 : 4), brow);
        break;
      default:
        put(x - 2, ey - 2, brow), put(x - 1, ey - 3, brow), put(x, ey - 3, brow), put(x + 1, ey - 2, brow);
    }
  }
  put(HX - 1, 23, shade(skin, -0.25));
  const blush = "#e98a7f";
  put(12, 24, blush), put(13, 24, blush), put(26, 24, blush), put(27, 24, blush);
  const lip = "#7a3028";
  const my = 25;
  switch (a.mouth) {
    case "lips":
      for (let x = HX - 2; x <= HX + 1; x++) put(x, my, "#a8453a"), put(x, my + 1, lip);
      break;
    case "grin":
      for (let x = HX - 3; x <= HX + 2; x++) put(x, my, "#ffffff"), put(x, my - 1, lip);
      for (let x = HX - 2; x <= HX + 1; x++) put(x, my + 1, lip);
      break;
    case "laugh":
      for (let x = HX - 3; x <= HX + 2; x++) put(x, my - 1, lip), put(x, my, "#3a1512");
      for (let x = HX - 2; x <= HX + 1; x++) put(x, my + 1, "#e86a7a");
      break;
    case "tongue":
      for (let x = HX - 3; x <= HX + 2; x++) put(x, my, lip);
      put(HX - 1, my + 1, "#e86a7a"), put(HX, my + 1, "#e86a7a");
      break;
    case "flat":
      for (let x = HX - 2; x <= HX + 1; x++) put(x, my, lip);
      break;
    case "o":
      put(HX - 1, my, "#3a1512"), put(HX, my, "#3a1512"), put(HX - 1, my + 1, "#3a1512"), put(HX, my + 1, "#3a1512");
      break;
    case "sad":
      put(HX - 3, my + 1, lip), put(HX - 2, my, lip), put(HX - 1, my, lip), put(HX, my, lip), put(HX + 1, my, lip), put(HX + 2, my + 1, lip);
      break;
    default:
      put(HX - 3, my - 1, lip), put(HX - 2, my, lip), put(HX - 1, my, lip), put(HX, my, lip), put(HX + 1, my, lip), put(HX + 2, my - 1, lip);
  }

  // Glasses.
  const frame = "#2a2422";
  if (a.glasses !== "none") {
    for (const x of ex) {
      const sun = a.glasses === "sun";
      for (let dx = -3; dx <= 2; dx++)
        for (let dy = -1; dy <= 3; dy++) {
          const edge = dx === -3 || dx === 2 || dy === -1 || dy === 3;
          const round = a.glasses === "round" && (dx === -3 || dx === 2) && (dy === -1 || dy === 3);
          if (round) continue;
          if (edge) put(x + dx, ey + dy, frame);
          else if (sun) put(x + dx, ey + dy, dy === 0 && dx === -2 ? "#5a5a5a" : "#151515");
        }
      if (a.glasses === "cat") put(x + (x === ex[0] ? -4 : 3), ey - 2, frame);
    }
    put(HX - 1, ey, frame), put(HX, ey, frame);
  }

  // Extras.
  const gold = "#e2b13c";
  if (a.extra === "earrings") {
    for (const cx of [HX - HRX - 0.5, HX + HRX - 0.5]) {
      const x = Math.round(cx);
      for (const [dx, dy] of [
        [0, 0],
        [-1, 1],
        [1, 1],
        [0, 2],
      ])
        put(x + dx, 24 + dy, gold);
    }
  }
  if (a.extra === "freckles") for (const [x, y] of [[13, 22], [15, 23], [14, 24], [25, 22], [27, 23], [26, 24]]) put(x, y, shade(skin, -0.35));
  if (a.extra === "headphones") {
    for (let x = 11; x <= 28; x++) {
      const y = Math.round(9 + ((x - 19.5) / 9) ** 2 * 7);
      put(x, y, "#c9c9d1"), put(x, y - 1, "#9898a3");
    }
    for (const x of [9, 29]) for (let y = 18; y < 25; y++) for (let dx = 0; dx < 3; dx++) put(x + dx, y, dx === 1 ? "#d9d9e0" : "#9898a3");
  }
  if (a.extra === "crown") {
    for (let x = 15; x <= 24; x++) for (let y = 7; y <= 9; y++) put(x, y, gold);
    for (const x of [15, 19, 20, 24]) put(x, 6, gold), put(x, 5, x === 19 || x === 20 ? gold : "#00000000");
    put(19, 8, "#e5605a"), put(20, 8, "#e5605a");
  }

  // Outline: every figure pixel touching the background (or the circle's
  // edge) takes a dark tone of its own colour. Hair over the face gets
  // a line where it meets the skin.
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

  // Round frame.
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const inside = a.shape === "square" ? !(Math.min(x, N - 1 - x) + Math.min(y, N - 1 - y) < 4 && ((x < 4 || x > N - 5) && (y < 4 || y > N - 5)) && (Math.min(x, N - 1 - x) - 3.5) ** 2 + (Math.min(y, N - 1 - y) - 3.5) ** 2 > 12.25) : inEllipse(x + 0.5, y + 0.5, N / 2, N / 2, N / 2, N / 2);
      if (!inside) out[y][x] = null;
    }
  return out;
}
