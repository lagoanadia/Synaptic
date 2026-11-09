// A drawn avatar, stored on the user as a small object of choices.
// Avatar.tsx draws it; the profile page edits it.

export const SKINS = ["#f6d7b8", "#e8b48a", "#c98a62", "#9a5d36", "#6a3c22"] as const;
export const HAIR_COLORS = ["#1c1c1c", "#3d2314", "#7a4a26", "#d6a648", "#b04a28", "#cfc8bf", "#ee9cbf", "#7d95e8"] as const;
export const TOP_COLORS = ["#ffffff", "#2b2b2b", "#2f7fdc", "#1fae7c", "#f2c94c", "#e5605a", "#f6c3cf", "#8b7bf5"] as const;
export const BG_COLORS = ["#2f7fdc", "#1fae7c", "#f2c94c", "#e5605a", "#f6c3cf", "#ee6a35", "#8b7bf5", "#d8f5a2"] as const;

export const EYES = ["dots", "happy", "wink", "closed", "big", "stars", "x"] as const;
export const BROWS = ["arched", "flat", "raised", "worried", "angry"] as const;
export const MOUTHS = ["lips", "smile", "grin", "laugh", "tongue", "flat", "o", "sad"] as const;
export const HAIRS = [
  "afro",
  "curlyBangs",
  "long",
  "longBangs",
  "spiky",
  "bun",
  "sideBuns",
  "sideSwept",
  "short",
  "bald",
  "curlyTop",
  "curlyShort",
  "longStraight",
  "ponytail",
  "braids",
  "shortNeat",
  "sideLong",
] as const;
export const TOPS = ["tee", "collar", "sweater", "stripes", "overalls", "tie", "suit"] as const;
export const GLASSES = ["none", "square", "round", "cat", "sun"] as const;
export const EXTRAS = ["earrings", "freckles", "headphones", "crown"] as const;
export const SHAPES = ["circle", "square"] as const;

export type Avatar = {
  skin: string;
  eyes: (typeof EYES)[number];
  brows: (typeof BROWS)[number];
  mouth: (typeof MOUTHS)[number];
  hair: (typeof HAIRS)[number];
  hairColor: string;
  top: (typeof TOPS)[number];
  topColor: string;
  glasses: (typeof GLASSES)[number];
  extra: (typeof EXTRAS)[number];
  bg: string;
  shape: (typeof SHAPES)[number];
};

export const DEFAULT_AVATAR: Avatar = {
  skin: SKINS[2],
  eyes: "dots",
  brows: "arched",
  mouth: "smile",
  hair: "afro",
  hairColor: HAIR_COLORS[1],
  top: "tee",
  topColor: TOP_COLORS[2],
  glasses: "none",
  extra: "earrings",
  bg: BG_COLORS[1],
  shape: "circle",
};

const pickFrom = <T,>(xs: readonly T[], v: unknown, fallback: T): T => (xs.includes(v as T) ? (v as T) : fallback);

// Whatever is stored (or nothing) → a valid avatar.
export function parseAvatar(raw: unknown): Avatar {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const d = DEFAULT_AVATAR;
  return {
    skin: pickFrom(SKINS, o.skin, d.skin),
    eyes: pickFrom(EYES, o.eyes, d.eyes),
    brows: pickFrom(BROWS, o.brows, d.brows),
    mouth: pickFrom(MOUTHS, o.mouth, d.mouth),
    hair: pickFrom(HAIRS, o.hair, d.hair),
    hairColor: pickFrom(HAIR_COLORS, o.hairColor, d.hairColor),
    top: pickFrom(TOPS, o.top, d.top),
    topColor: pickFrom(TOP_COLORS, o.topColor, d.topColor),
    glasses: pickFrom(GLASSES, o.glasses, d.glasses),
    extra: pickFrom(EXTRAS, o.extra, d.extra),
    bg: pickFrom(BG_COLORS, o.bg, d.bg),
    shape: pickFrom(SHAPES, o.shape, d.shape),
  };
}

// The dice: a random avatar (glasses and extras only sometimes).
export function randomAvatar(rand: () => number = Math.random): Avatar {
  const any = <T,>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)];
  return {
    skin: any(SKINS),
    eyes: rand() < 0.6 ? "dots" : any(EYES),
    brows: any(BROWS),
    mouth: rand() < 0.5 ? "smile" : any(MOUTHS),
    hair: any(HAIRS),
    hairColor: any(HAIR_COLORS.slice(0, 6)),
    top: any(TOPS),
    topColor: any(TOP_COLORS),
    glasses: rand() < 0.65 ? "none" : any(GLASSES),
    extra: any(EXTRAS),
    bg: any(BG_COLORS),
    shape: "circle",
  };
}

// "Nadia Lagoa" → "nadia"; letters, digits, dot and underscore, 3-20.
export function handleFrom(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/\s+/)[0]
    .replace(/[^a-z0-9._]/g, "");
  return (base.length >= 3 ? base : `${base}user`).slice(0, 20);
}

export const HANDLE = /^[a-z0-9._]{3,20}$/;
