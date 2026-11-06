// Notebook and folder looks. Notebooks (Sections) get a procedural
// texture (SVG turbulence filters, see app/CoverDefs.tsx); folders
// (subjects) get a pattern plus a tab colour. Both are plain keys stored
// on the row, or picked from its id when unset, so every item keeps the
// same look without anyone choosing one.

export const NOTEBOOK_COVERS = ["zebra", "croc", "leopard", "green", "marble", "ocean"] as const;
export type NotebookCover = (typeof NOTEBOOK_COVERS)[number];

// Pattern id → the folder's tab/body colour (also its colour on maps and
// in the calendar).
export const FOLDER_COVERS = {
  ikat: "#a0523f",
  stripes: "#c0473d",
  gingham: "#6f9bd1",
  sage: "#6f8a5c",
  forest: "#3e5b3a",
  dots: "#b07d3a",
  plum: "#7d5a8c",
} as const;
export type FolderCover = keyof typeof FOLDER_COVERS;
const FOLDER_KEYS = Object.keys(FOLDER_COVERS) as FolderCover[];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function notebookCover(id: string, cover?: string | null): NotebookCover {
  return (NOTEBOOK_COVERS as readonly string[]).includes(cover ?? "")
    ? (cover as NotebookCover)
    : NOTEBOOK_COVERS[hash(id) % NOTEBOOK_COVERS.length];
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
