// Pages built from blocks, like Notion: the home page and every folder.
// Stored as JSON on the row; anything unreadable falls back to defaults.

export type HomeBlockType = "week" | "today" | "project" | "folders" | "map" | "recent";
// sectionId: the notebook a block shows; pursuitId: the project of a "project" block.
export type HomeBlock = { id: string; type: HomeBlockType; sectionId: string | null; pursuitId?: string | null };

export const HOME_BLOCK_TYPES: { type: HomeBlockType; label: string }[] = [
  { type: "week", label: "Esta semana" },
  { type: "today", label: "Para hoy" },
  { type: "project", label: "Un proyecto" },
  { type: "folders", label: "Carpetas" },
  { type: "map", label: "Mapa" },
  { type: "recent", label: "Recientes" },
];

export type FolderBlockType = "project" | "pages" | "map" | "review" | "ask" | "challenges" | "deadlines" | "tasks" | "options" | "budget";
// title/icon: what an "options" block is about (Alojamiento, bed…);
// people: how many a "budget" block splits between (null = the members).
export type FolderBlock = { id: string; type: FolderBlockType; view?: "list" | "board"; title?: string; icon?: BlockIcon; people?: number | null; columns?: OptionColumn[] };
// The columns an "options" block can show, in this order.
export const OPTION_COLUMNS = [
  { id: "status", label: "Estado" },
  { id: "price", label: "Precio" },
  { id: "votes", label: "Votos" },
  { id: "rating", label: "Valoración" },
  { id: "date", label: "Fecha" },
  { id: "note", label: "Nota" },
] as const;
export type OptionColumn = (typeof OPTION_COLUMNS)[number]["id"];
export const DEFAULT_OPTION_COLUMNS: OptionColumn[] = ["status", "price", "votes"];
// Stored columns (or none) → the ones to show, in the standard order.
export const optionColumns = (cols: unknown): OptionColumn[] =>
  Array.isArray(cols) ? OPTION_COLUMNS.map((c) => c.id).filter((id) => cols.includes(id)) : DEFAULT_OPTION_COLUMNS;
export const BLOCK_ICONS = ["bed", "plane", "food", "pin", "ticket", "car", "star", "list"] as const;
export type BlockIcon = (typeof BLOCK_ICONS)[number];

export const FOLDER_BLOCK_TYPES: { type: FolderBlockType; label: string; hint: string; study?: boolean }[] = [
  { type: "project", label: "Tareas", hint: "Fechas, progreso y tablero de tareas" },
  { type: "pages", label: "Páginas", hint: "Lista o tablero" },
  { type: "map", label: "Mapa", hint: "Tus conceptos; desde aquí entras a Aprender", study: true },
  { type: "review", label: "Repaso", hint: "Las tarjetas de hoy", study: true },
  { type: "ask", label: "Preguntar", hint: "Pregunta a tus apuntes" },
  { type: "challenges", label: "Retos", hint: "Ejercicios de código · programación", study: true },
  { type: "deadlines", label: "Entregas", hint: "Lo que viene de Classroom" },
  { type: "tasks", label: "Tableros por entrega", hint: "Un tablero por cada entrega" },
  { type: "options", label: "Opciones", hint: "Enlaces con precio y votos: alojamiento, vuelos, planes…" },
  { type: "budget", label: "Presupuesto", hint: "Suma lo elegido y lo reparte por persona" },
];

// Folder templates, picked when you make a folder.
export type FolderTemplate = "blank" | "project" | "plan";
export const FOLDER_TEMPLATES: { id: FolderTemplate; label: string }[] = [
  { id: "blank", label: "En blanco" },
  { id: "project", label: "Proyecto" },
  { id: "plan", label: "Planificador" },
];
// A saved template's blocks → fresh blocks for a new folder (new ids, so
// no two folders share block ids).
export function blocksFromTemplate(raw: unknown): FolderBlock[] {
  if (!Array.isArray(raw)) return templateBlocks("blank");
  const out = raw.map((b) => cleanFolderBlock({ ...(b as Partial<FolderBlock>), id: newId() })).filter((b): b is FolderBlock => b !== null).slice(0, 20);
  return out.length ? out : templateBlocks("blank");
}

export function templateBlocks(t: FolderTemplate): FolderBlock[] {
  // "Plan": decide between options together and split the cost — a trip,
  // a move, a group present, an event, a big purchase, a weekend…
  if (t === "plan")
    return [
      { id: newId(), type: "options", title: "Opciones", icon: "list" },
      { id: newId(), type: "budget", people: null },
    ];
  if (t === "project") return [{ id: "project", type: "project" }, { id: "pages", type: "pages" }];
  return [{ id: "pages", type: "pages" }];
}

// What the browser sent → a block we can store (known type, short id,
// only the fields that type uses).
export function cleanFolderBlock(b: Partial<FolderBlock>): FolderBlock | null {
  if (!b || !FOLDER_BLOCK_TYPES.some((t) => t.type === b.type)) return null;
  const out: FolderBlock = { id: String(b.id ?? newId()).slice(0, 20), type: b.type as FolderBlockType };
  if (b.view === "list" || b.view === "board") out.view = b.view;
  if (b.type === "options") {
    out.title = typeof b.title === "string" && b.title.trim() ? b.title.trim().slice(0, 40) : "Opciones";
    out.icon = BLOCK_ICONS.includes(b.icon as BlockIcon) ? b.icon : "list";
    out.columns = optionColumns(b.columns);
  }
  if (b.type === "budget") out.people = typeof b.people === "number" && b.people >= 1 && b.people <= 99 ? Math.round(b.people) : null;
  return out;
}

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
export function cleanHomeBlocks(blocks: unknown, mine: Set<string>, projects: Set<string> = new Set()): HomeBlock[] {
  const types = HOME_BLOCK_TYPES.map((t) => t.type as string);
  return (Array.isArray(blocks) ? blocks : [])
    .filter((b): b is HomeBlock => !!b && typeof b === "object" && types.includes((b as HomeBlock).type))
    .slice(0, 20)
    .map((b) => ({
      id: String(b.id).slice(0, 20),
      type: b.type,
      sectionId: b.type !== "week" && b.type !== "today" && b.sectionId && mine.has(b.sectionId) ? b.sectionId : null,
      ...(b.type === "project" ? { pursuitId: b.pursuitId && projects.has(b.pursuitId) ? b.pursuitId : null } : {}),
    }));
}

// A folder: what you saved, or Páginas + Mapa + Repaso in a notebook with
// study tools; a project (Tareas, then Páginas) otherwise.
// Study blocks are dropped from folders in notebooks without study tools.
export function folderBlocks(raw: unknown, study: boolean, hasTasks = false): FolderBlock[] {
  const saved = readList<FolderBlock>(raw, FOLDER_BLOCK_TYPES.map((t) => t.type));
  const studyTypes = new Set(FOLDER_BLOCK_TYPES.filter((t) => t.study).map((t) => t.type));
  const b = (type: FolderBlockType): FolderBlock => ({ id: type, type });
  const list = saved ?? (study ? [b("pages"), b("map"), b("review")] : hasTasks ? [b("project"), b("tasks"), b("pages")] : [b("project"), b("pages")]);
  return study ? list : list.filter((b) => !studyTypes.has(b.type));
}

export function newBlock<T extends string>(type: T) {
  return { id: newId(), type };
}
