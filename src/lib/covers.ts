// Notebook and folder looks. Notebooks (Sections) get a procedural
// texture (SVG turbulence filters, see app/CoverDefs.tsx); folders
// (subjects) get a pattern plus a tab colour. Both are plain keys stored
// on the row, or picked from its id when unset, so every item keeps the
// same look without anyone choosing one.

// The first six are the originals: an unset notebook is picked from those,
// so adding looks never changes one you already have.
const ORIGINAL_NOTEBOOKS = ["zebra", "croc", "leopard", "green", "marble", "ocean"] as const;
export const NOTEBOOK_COVERS = [
  ...ORIGINAL_NOTEBOOKS,
  "fawn",
  "ruby",
  "ebony",
  "smoke",
  "moss",
  "ember",
  "tartan",
  "mosaic",
  "velvet",
  "bordeaux",
  "cream",
  "blossom",
] as const;
export type NotebookCover = (typeof NOTEBOOK_COVERS)[number];
// Drawn with a repeating pattern (fill) rather than a noise filter.
export const PATTERN_NOTEBOOKS: readonly NotebookCover[] = ["tartan", "mosaic", "velvet", "bordeaux", "cream", "blossom"];

// Pattern id → the folder's tab/body colour (also its colour on maps and
// in the calendar).
const BASE_FOLDERS = {
  ikat: "#a0523f",
  stripes: "#c0473d",
  gingham: "#6f9bd1",
  sage: "#6f8a5c",
  forest: "#3e5b3a",
  dots: "#b07d3a",
  plum: "#7d5a8c",
  azulejo: "#7d8a52",
  rainbow: "#d6457f",
  madras: "#d98a94",
  oxblood: "#5e1a1a",
  orchid: "#5a2242",
  regency: "#4a1f3a",
  olive: "#76762f",
  olivecroc: "#5f6324",
  damask: "#6e2438",
} as const;

// Collections: two colours, six patterns each, drawn like the "Burdeos y
// oliva" set — flowers on lace, regency stripes, a flower on the light
// colour, dark croc, light croc and damask (see CollectionPatterns).
export const COLLECTIONS = [
  { id: "navy", name: "Marino y mostaza", dark: "#1f2d4d", light: "#b48a2c", accent: "#e3c46a", mid: "#2c4470" },
  { id: "rose", name: "Rojo y rosa", dark: "#7a1c28", light: "#d98a95", accent: "#f4d6d9", mid: "#a8323f" },
  { id: "pine", name: "Bosque y crema", dark: "#24402c", light: "#cbbd97", accent: "#f1e8d2", mid: "#355a3e" },
  { id: "clay", name: "Terracota y arena", dark: "#7c3420", light: "#d2ad7c", accent: "#f0dcc0", mid: "#a14a2b" },
] as const;
export const COLLECTION_KINDS = ["Flower", "Stripe", "Bloom", "Croc", "LightCroc", "Damask"] as const;
export type Collection = (typeof COLLECTIONS)[number];
type CollectionCover = `${Collection["id"]}${(typeof COLLECTION_KINDS)[number]}`;
export type FolderCover = keyof typeof BASE_FOLDERS | CollectionCover;

const tabOf = (c: Collection, kind: (typeof COLLECTION_KINDS)[number]) =>
  kind === "Bloom" || kind === "LightCroc" ? c.light : kind === "Damask" ? c.mid : c.dark;
export const FOLDER_COVERS = {
  ...BASE_FOLDERS,
  ...Object.fromEntries(COLLECTIONS.flatMap((c) => COLLECTION_KINDS.map((k) => [`${c.id}${k}`, tabOf(c, k)]))),
} as Record<FolderCover, string>;

// How the cover picker lists them, one collection per row. The older
// single covers still draw for folders that chose one, but aren't offered.
export const FOLDER_GROUPS: { name: string; covers: FolderCover[] }[] = [
  { name: "Burdeos y oliva", covers: ["orchid", "regency", "olive", "oxblood", "olivecroc", "damask"] },
  ...COLLECTIONS.map((c) => ({ name: c.name, covers: COLLECTION_KINDS.map((k) => `${c.id}${k}` as FolderCover) })),
];

// Mixes a colour toward another (0 = a, 1 = b).
export function mix(a: string, b: string, t: number): string {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return `#${x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, "0")).join("")}`;
}

// Unset folders get one of the collections' covers, picked from their id.
const FOLDER_KEYS: FolderCover[] = FOLDER_GROUPS.flatMap((g) => g.covers);
// Drawn with a noise filter rather than a repeating pattern.
export const FILTER_FOLDERS: readonly FolderCover[] = ["oxblood", "olivecroc", ...COLLECTIONS.flatMap((c) => [`${c.id}Croc`, `${c.id}LightCroc`] as FolderCover[])];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function notebookCover(id: string, cover?: string | null): NotebookCover {
  return (NOTEBOOK_COVERS as readonly string[]).includes(cover ?? "")
    ? (cover as NotebookCover)
    : ORIGINAL_NOTEBOOKS[hash(id) % ORIGINAL_NOTEBOOKS.length];
}

export function folderCover(id: string, cover?: string | null): FolderCover {
  return cover && cover in FOLDER_COVERS ? (cover as FolderCover) : FOLDER_KEYS[hash(id) % FOLDER_KEYS.length];
}

export const folderColor = (id: string, cover?: string | null) => FOLDER_COVERS[folderCover(id, cover)];

// How much is left in a subject, as 0–3 sheets peeking out of its folder:
// due flashcards and concepts still to learn, softly scaled so a big
// backlog never looks worse than "three sheets".
export function sheetsFor(pending: number): number {
  if (pending <= 0) return 0;
  if (pending <= 3) return 1;
  if (pending <= 10) return 2;
  return 3;
}
