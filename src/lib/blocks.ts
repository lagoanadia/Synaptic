// Pages built from blocks, like Notion: the home page and every folder.
// Stored as JSON on the row; anything unreadable falls back to defaults.

export type HomeBlockType = "week" | "folders" | "map" | "recent";
export type HomeBlock = { id: string; type: HomeBlockType; sectionId: string | null };

export const HOME_BLOCK_TYPES: { type: HomeBlockType; label: string }[] = [
  { type: "week", label: "Esta semana" },
  { type: "folders", label: "Carpetas" },
  { type: "map", label: "Mapa" },
  { type: "recent", label: "Recientes" },
];

export type FolderBlockType = "pages" | "map" | "review" | "ask" | "challenges" | "deadlines" | "tasks";
export type FolderBlock = { id: string; type: FolderBlockType; view?: "list" | "board" };

export const FOLDER_BLOCK_TYPES: { type: FolderBlockType; label: string; hint: string; study?: boolean }[] = [
  { type: "pages", label: "Páginas", hint: "Lista o tablero" },
  { type: "map", label: "Mapa", hint: "Tus conceptos; desde aquí entras a Aprender", study: true },
  { type: "review", label: "Repaso", hint: "Las tarjetas de hoy", study: true },
  { type: "ask", label: "Preguntar", hint: "Pregunta a tus apuntes" },
  { type: "challenges", label: "Retos", hint: "Ejercicios de código · programación", study: true },
  { type: "deadlines", label: "Entregas", hint: "Lo que viene de Classroom" },
  { type: "tasks", label: "Tareas", hint: "Tablero: por hacer, en curso, hecho" },
];

const newId = () => Math.random().toString(36).slice(2, 10);

function readList<T extends { id: string; type: string }>(raw: unknown, valid: readonly string[]): T[] | null {
  if (!Array.isArray(raw)) return null;
  const out = raw
    .filter((b): b is T => !!b && typeof b === "object" && valid.includes((b as T).type))
    .map((b) => ({ ...b, id: typeof b.id === "string" && b.id ? b.id : newId() }))
    .slice(0, 20);
  return out;
}

// Home: what you saved, or this week, then the folders and map of your first notebook
// with study tools (else your first notebook), plus recent pages.
export function homeBlocks(raw: unknown, sections: { id: string; study: boolean }[]): HomeBlock[] {
  const saved = readList<HomeBlock>(raw, HOME_BLOCK_TYPES.map((t) => t.type));
  if (saved) {
    const ids = new Set(sections.map((s) => s.id));
    return saved.map((b) => ({ ...b, sectionId: b.sectionId && ids.has(b.sectionId) ? b.sectionId : (sections[0]?.id ?? null) }));
  }
  const main = sections.find((s) => s.study) ?? sections[0];
  if (!main) return [{ id: "week", type: "week", sectionId: null }];
  return [
    { id: "week", type: "week", sectionId: null },
    { id: "folders", type: "folders", sectionId: main.id },
    ...(main.study ? [{ id: "map", type: "map" as const, sectionId: main.id }] : [{ id: "recent", type: "recent" as const, sectionId: main.id }]),
  ];
}

// What the browser sent to save → blocks we can store: known types only
// (from HOME_BLOCK_TYPES, so a new block type can't be forgotten here),
// notebooks you own, at most 20.
export function cleanHomeBlocks(blocks: unknown, mine: Set<string>): HomeBlock[] {
  const types = HOME_BLOCK_TYPES.map((t) => t.type as string);
  return (Array.isArray(blocks) ? blocks : [])
    .filter((b): b is HomeBlock => !!b && typeof b === "object" && types.includes((b as HomeBlock).type))
    .slice(0, 20)
    .map((b) => ({ id: String(b.id).slice(0, 20), type: b.type, sectionId: b.type !== "week" && b.sectionId && mine.has(b.sectionId) ? b.sectionId : null }));
}

// A folder: what you saved, or Páginas (+ Mapa and Repaso in a notebook
// with study tools; + Tareas if it has a board, + Preguntar otherwise).
// Study blocks are dropped from folders in notebooks without study tools.
export function folderBlocks(raw: unknown, study: boolean, hasTasks = false): FolderBlock[] {
  const saved = readList<FolderBlock>(raw, FOLDER_BLOCK_TYPES.map((t) => t.type));
  const studyTypes = new Set(FOLDER_BLOCK_TYPES.filter((t) => t.study).map((t) => t.type));
  const b = (type: FolderBlockType): FolderBlock => ({ id: type, type });
  const list = saved ?? (study ? [b("pages"), b("map"), b("review")] : hasTasks ? [b("tasks"), b("pages"), b("ask")] : [b("pages"), b("ask")]);
  return study ? list : list.filter((b) => !studyTypes.has(b.type));
}

export function newBlock<T extends string>(type: T) {
  return { id: newId(), type };
}
