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

export type FolderBlockType = "project" | "pages" | "map" | "review" | "ask" | "challenges" | "deadlines" | "tasks" | "options" | "budget" | "expenses" | "dates" | "savings";
// title/icon: what an "options" block is about (Alojamiento, bed…);
// people: how many a "budget" block splits between (null = the members).
export type FolderBlock = { id: string; type: FolderBlockType; view?: "list" | "board"; title?: string; icon?: BlockIcon; people?: number | null; exclude?: string[]; columns?: OptionColumn[]; goal?: number | null };
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
  { type: "ask", label: "Preguntar", hint: "Pregunta a tus apuntes" },
  { type: "challenges", label: "Retos", hint: "Ejercicios de código · programación", study: true },
  { type: "deadlines", label: "Entregas", hint: "Lo que viene de Classroom" },
  { type: "tasks", label: "Tableros por entrega", hint: "Un tablero por cada entrega" },
  { type: "options", label: "Opciones", hint: "Enlaces con precio y votos: alojamiento, vuelos, planes…" },
  { type: "budget", label: "Presupuesto", hint: "Suma lo elegido y lo reparte por persona" },
  { type: "expenses", label: "Gastos", hint: "Quién pagó qué y quién debe a quién" },
  { type: "dates", label: "Fechas", hint: "Propón días y cada uno marca cuáles puede" },
  { type: "savings", label: "Meta de ahorro", hint: "Un objetivo y lo que lleváis ahorrado" },
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
  // goal in cents (null = not set yet)
  if (b.type === "savings") out.goal = typeof b.goal === "number" && b.goal > 0 && b.goal < 1e11 ? Math.round(b.goal) : null;
  if (b.type === "budget") {
    out.people = typeof b.people === "number" && b.people >= 1 && b.people <= 99 ? Math.round(b.people) : null;
    // Options blocks left out of the shared total (e.g. flights each person books).
    if (Array.isArray(b.exclude)) out.exclude = b.exclude.filter((x): x is string => typeof x === "string").slice(0, 50);
  }
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

// Home: what you saved, or just this week (the notebooks sit above it).
export function homeBlocks(raw: unknown, sections: { id: string; study: boolean }[]): HomeBlock[] {
  const saved = readList<HomeBlock>(raw, HOME_BLOCK_TYPES.map((t) => t.type));
  if (saved) {
    const ids = new Set(sections.map((s) => s.id));
    return saved.map((b) => ({ ...b, sectionId: b.sectionId && ids.has(b.sectionId) ? b.sectionId : (sections[0]?.id ?? null) }));
  }
  return [{ id: "week", type: "week", sectionId: null }];
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

// A folder: what you saved, or Páginas + Mapa in a notebook with
// study tools; a project (Tareas, then Páginas) otherwise.
// Study blocks are dropped from folders in notebooks without study tools;
// the old "Repaso" block is gone (the ▶ Repasar button and Mis tests do it).
export function folderBlocks(raw: unknown, study: boolean, hasTasks = false): FolderBlock[] {
  const saved = readList<FolderBlock>(raw, FOLDER_BLOCK_TYPES.map((t) => t.type));
  const studyTypes = new Set(FOLDER_BLOCK_TYPES.filter((t) => t.study).map((t) => t.type));
  const b = (type: FolderBlockType): FolderBlock => ({ id: type, type });
  const list = (saved ?? (study ? [b("pages"), b("map")] : hasTasks ? [b("project"), b("tasks"), b("pages")] : [b("project"), b("pages")])).filter((b) => b.type !== "review");
  return study ? list : list.filter((b) => !studyTypes.has(b.type));
}

export function newBlock<T extends string>(type: T) {
  return { id: newId(), type };
}

// A notebook page's own blocks, under its folders: a to-do list, a note,
// links, this week, recent pages. Stored on the Section.
// The notebook's own sections are blocks too ("built in"): its folders,
// the study map, the projects' tasks and calendar, the per-delivery boards.
// In edit mode they move and go like the rest, and come back from the menu.
export const BUILTIN_BLOCKS = ["folders", "map", "tasks", "timeline", "boards"] as const;
export type BuiltinBlockType = (typeof BUILTIN_BLOCKS)[number];
export const BUILTIN_LABEL: Record<BuiltinBlockType, { label: string; hint: string }> = {
  folders: { label: "Carpetas", hint: "Las asignaturas, proyectos o carpetas de la libreta" },
  map: { label: "Mapa", hint: "El mapa de unidades y las entregas" },
  tasks: { label: "Tareas", hint: "El tablero de tareas de tus proyectos" },
  timeline: { label: "Calendario", hint: "Tus proyectos en el tiempo" },
  boards: { label: "Tableros por entrega", hint: "Las tarjetas pendientes de cada entrega" },
};
export type NotebookBlockType = "todo" | "note" | "links" | "pages" | "week" | "recent" | BuiltinBlockType;
// depth: 0 a task, 1 its subtask, 2 a subtask of that.
// doing: started (the home page's "En curso"); the notebook shows it as open.
export type TodoItem = { id: string; text: string; done: boolean; depth?: number; doing?: boolean };
export type LinkItem = { id: string; label: string; url: string };
// join: in the same row as the block before it (side by side, up to 3).
export type NotebookBlock = { id: string; type: NotebookBlockType; title?: string; items?: TodoItem[]; text?: string; links?: LinkItem[]; join?: boolean };
export const NOTEBOOK_BLOCK_TYPES: { type: NotebookBlockType; label: string; hint: string }[] = [
  { type: "todo", label: "Lista de tareas", hint: "Cosas por hacer, para tacharlas" },
  { type: "note", label: "Nota", hint: "Un texto libre siempre a la vista" },
  { type: "links", label: "Enlaces", hint: "Webs que usas a menudo: Classroom, Moodle…" },
  { type: "pages", label: "Páginas", hint: "Páginas sueltas de la libreta, sin carpeta" },
  { type: "week", label: "Esta semana", hint: "Tus clases, entregas y repasos de los próximos 7 días" },
  { type: "recent", label: "Recientes", hint: "Las últimas páginas de esta libreta" },
];

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
const safeUrl = (v: unknown) => {
  const s = str(v, 500).trim();
  if (!s) return "";
  const u = /^[a-z][a-z0-9+.-]*:/i.test(s) ? s : `https://${s}`;
  return /^https?:\/\//i.test(u) ? u : "";
};

// What the browser sent → blocks we can store: known types, short ids,
// only each type's fields, sane sizes.
export function cleanNotebookBlocks(raw: unknown): NotebookBlock[] {
  if (!Array.isArray(raw)) return [];
  const types = [...NOTEBOOK_BLOCK_TYPES.map((t) => t.type as string), ...BUILTIN_BLOCKS];
  const once = new Set<string>();
  return raw
    .filter((b): b is NotebookBlock => !!b && typeof b === "object" && types.includes((b as NotebookBlock).type))
    // Built-in sections and the loose pages: one of each.
    .filter((b) => !((BUILTIN_BLOCKS as readonly string[]).includes(b.type) || b.type === "pages") || (!once.has(b.type) && !!once.add(b.type)))
    .slice(0, 30)
    .map((b) => {
      const join = b.join === true ? { join: true } : {};
      if ((BUILTIN_BLOCKS as readonly string[]).includes(b.type)) return { id: b.type, type: b.type, ...join };
      const out: NotebookBlock = { id: str(b.id, 20) || newId(), type: b.type, ...join };
      if (b.title !== undefined && ["todo", "note", "links"].includes(b.type)) out.title = str(b.title, 60);
      if (b.type === "todo")
        out.items = (Array.isArray(b.items) ? b.items : []).slice(0, 200).map((i) => {
          const depth = Math.max(0, Math.min(2, Math.round(Number(i?.depth) || 0)));
          return { id: str(i?.id, 20) || newId(), text: str(i?.text, 300), done: !!i?.done, ...(depth ? { depth } : {}), ...(i?.doing === true && !i?.done ? { doing: true } : {}) };
        });
      if (b.type === "note") out.text = str(b.text, 5000);
      if (b.type === "links")
        out.links = (Array.isArray(b.links) ? b.links : [])
          .slice(0, 50)
          .map((l) => ({ id: str(l?.id, 20) || newId(), label: str(l?.label, 80), url: safeUrl(l?.url) }))
          .filter((l) => l.url);
      return out;
    });
}
