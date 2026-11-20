"use client";

import { useT } from "@/app/LangProvider";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { XIcon } from "@/app/icons";
import { Popover } from "@/app/ui/Popover";
import { BUILTIN_BLOCKS, NOTEBOOK_BLOCK_TYPES, newBlock, type LinkItem, type NotebookBlock, type NotebookBlockType, type TodoItem } from "@/lib/blocks";
import { saveNotebookBlocks } from "../../actions";
import { useNotebookEditing } from "./editMode";

const newId = () => Math.random().toString(36).slice(2, 10);
const DEFAULT_TITLE: Record<NotebookBlockType, string> = {
  todo: "Por hacer",
  note: "Nota",
  links: "Enlaces",
  pages: "Páginas",
  week: "Esta semana",
  recent: "Recientes",
  map: "Mapa",
  folders: "Carpetas",
  tasks: "Tareas",
  timeline: "Calendario",
  boards: "Tableros por entrega",
};
// Sections that draw their own heading: no second one on top.
const OWN_HEADING = new Set<NotebookBlockType>(BUILTIN_BLOCKS);
const MAX_PER_ROW = 3;

// Rows of the page: a block starts a row unless it's joined to the one before.
function rowsOf(blocks: NotebookBlock[]) {
  const rows: NotebookBlock[][] = [];
  blocks.forEach((b, i) => (b.join && i > 0 && rows.length && rows[rows.length - 1].length < MAX_PER_ROW ? rows[rows.length - 1].push(b) : rows.push([b])));
  return rows;
}

type Spot = { id: string; side: "left" | "right" | "above" | "below" };

// Where the dragged block lands: beside the target (joins its row) or
// above/below the target's row (a row of its own).
function place(blocks: NotebookBlock[], dragId: string, spot: Spot): NotebookBlock[] {
  if (dragId === spot.id) return blocks;
  const rows = rowsOf(blocks).map((r) => r.filter((b) => b.id !== dragId)).filter((r) => r.length);
  const dragged = blocks.find((b) => b.id === dragId);
  if (!dragged) return blocks;
  const ri = rows.findIndex((r) => r.some((b) => b.id === spot.id));
  if (ri < 0) return blocks;
  const row = rows[ri];
  const side = (spot.side === "left" || spot.side === "right") && row.length >= MAX_PER_ROW ? "below" : spot.side;
  if (side === "above") rows.splice(ri, 0, [dragged]);
  else if (side === "below") rows.splice(ri + 1, 0, [dragged]);
  else {
    const at = row.findIndex((b) => b.id === spot.id) + (side === "right" ? 1 : 0);
    row.splice(at, 0, dragged);
  }
  return rows.flatMap((r) => r.map((b, i) => ({ ...b, join: i > 0 ? true : undefined })));
}

// Every section of a notebook page as a block: its folders, map, tasks,
// calendar… and your own to-do lists, notes, links, week and recent pages.
// In edit mode (✎) you drag one by its ⋮⋮ handle: beside another (a
// vertical line) puts them in the same row; above or below (a horizontal
// line) gives it a row of its own. × removes it; "+ Añadir bloque" brings
// any back. Every change saves at once. `content` holds the server-drawn
// ones by id; `addable` the built-in sections this notebook can have.
export function NotebookBlocks({
  sectionId,
  blocks: initial,
  content,
  addable = [],
}: {
  sectionId: string;
  blocks: NotebookBlock[];
  content: Record<string, React.ReactNode>;
  addable?: { type: NotebookBlockType; label: string; hint: string }[];
}) {
  const t = useT();
  const router = useRouter();
  const [blocks, setBlocks] = useState(initial);
  const [, start] = useTransition();
  const [adding, setAdding] = useState(false);
  const addBtn = useRef<HTMLButtonElement>(null);
  const editing = useNotebookEditing();
  // Dragging: which block (armed by its handle) and where it would land.
  const [armed, setArmed] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [spot, setSpot] = useState<Spot | null>(null);

  function save(next: NotebookBlock[], refresh = false) {
    setBlocks(next);
    start(async () => {
      await saveNotebookBlocks(sectionId, next);
      if (refresh) router.refresh();
    });
  }
  const update = (id: string, patch: Partial<NotebookBlock>) => save(blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  const remove = (id: string) => {
    const i = blocks.findIndex((b) => b.id === id);
    // The one after it starts the row if this one did.
    const next = blocks.map((b, j) => (j === i + 1 && !blocks[i].join ? { ...b, join: undefined } : b)).filter((b) => b.id !== id);
    save(next);
  };
  const menu = [
    ...addable.filter((a) => !blocks.some((b) => b.type === a.type)),
    ...NOTEBOOK_BLOCK_TYPES.filter((item) => !(item.type === "pages" && blocks.some((b) => b.type === "pages"))),
  ];

  function onOver(e: React.DragEvent, b: NotebookBlock, rowFull: boolean) {
    if (!dragging || dragging === b.id) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    const side: Spot["side"] = !rowFull && x < 0.22 ? "left" : !rowFull && x > 0.78 ? "right" : y < 0.5 ? "above" : "below";
    if (spot?.id !== b.id || spot.side !== side) setSpot({ id: b.id, side });
  }
  function endDrag() {
    setDragging(null);
    setArmed(null);
    setSpot(null);
  }

  const block = (b: NotebookBlock, rowFull: boolean) => {
    const own = OWN_HEADING.has(b.type);
    const here = spot?.id === b.id ? spot.side : null;
    return (
      <section
        key={b.id}
        draggable={editing && armed === b.id}
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", b.id);
          setDragging(b.id);
        }}
        onDragEnd={endDrag}
        onDragOver={(e) => onOver(e, b, rowFull)}
        onDrop={(e) => {
          e.preventDefault();
          if (dragging && spot) save(place(blocks, dragging, spot), true);
          endDrag();
        }}
        className={`group/blk relative flex min-w-0 flex-col gap-3 ${editing ? "rounded-lg p-3 outline-[1.5px] outline-offset-0 outline-[#d3d1cb] outline-dashed" : ""} ${dragging === b.id ? "opacity-35" : ""}`}
      >
        {/* Where it would land */}
        {here === "left" && <span className="pointer-events-none absolute inset-y-0 -left-[22px] w-1 rounded-full bg-accent shadow-[0_0_12px_var(--color-accent)]" />}
        {here === "right" && <span className="pointer-events-none absolute inset-y-0 -right-[22px] w-1 rounded-full bg-accent shadow-[0_0_12px_var(--color-accent)]" />}
        {here === "above" && <span className="pointer-events-none absolute inset-x-0 -top-[22px] h-1 rounded-full bg-accent shadow-[0_0_12px_var(--color-accent)]" />}
        {here === "below" && <span className="pointer-events-none absolute inset-x-0 -bottom-[22px] h-1 rounded-full bg-accent shadow-[0_0_12px_var(--color-accent)]" />}
        {editing && (
          <>
            <span
              onPointerDown={() => setArmed(b.id)}
              onPointerUp={() => !dragging && setArmed(null)}
              title={t("Arrastra para mover")}
              aria-label={t("Arrastra para mover")}
              className="absolute top-3 -left-3.5 z-10 grid h-7 w-5 cursor-grab place-items-center rounded-md bg-chip text-ink-faint opacity-0 shadow-[0_0_0_1px_var(--color-border-subtle)] transition-opacity group-hover/blk:opacity-100 hover:text-ink active:cursor-grabbing max-md:opacity-100"
            >
              <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor" aria-hidden>
                <circle cx="3" cy="3" r="1.3" />
                <circle cx="7" cy="3" r="1.3" />
                <circle cx="3" cy="7" r="1.3" />
                <circle cx="7" cy="7" r="1.3" />
                <circle cx="3" cy="11" r="1.3" />
                <circle cx="7" cy="11" r="1.3" />
              </svg>
            </span>
            <button type="button" onClick={() => remove(b.id)} title={t("Quitar bloque")} aria-label={t("Quitar bloque")} className="absolute top-2.5 right-2.5 z-10 rounded p-1 text-ink-faint hover:bg-chip hover:text-red-600">
              <XIcon size={13} className="block" />
            </button>
          </>
        )}
        {!own && (
          <header className={`flex items-center gap-2 border-b border-border-subtle pb-2 ${editing ? "pr-7" : ""}`}>
            {["todo", "note", "links"].includes(b.type) ? (
              <input
                defaultValue={b.title ?? t(DEFAULT_TITLE[b.type])}
                onBlur={(e) => e.target.value.trim() !== (b.title ?? t(DEFAULT_TITLE[b.type])) && update(b.id, { title: e.target.value.trim() })}
                onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                aria-label={t("Título del bloque")}
                className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none"
              />
            ) : (
              <h2 className="min-w-0 flex-1 text-sm font-semibold">{t(DEFAULT_TITLE[b.type])}</h2>
            )}
            {b.type === "todo" && (b.items?.length ?? 0) > 0 && (
              <span className="text-xs text-ink-faint">
                {b.items!.filter((x) => x.done).length}/{b.items!.length}
              </span>
            )}
          </header>
        )}
        {b.type === "todo" && <Todo items={b.items ?? []} onChange={(items) => update(b.id, { items })} />}
        {b.type === "note" && <Note text={b.text ?? ""} onChange={(text) => update(b.id, { text })} />}
        {b.type === "links" && <Links links={b.links ?? []} onChange={(links) => update(b.id, { links })} />}
        {!["todo", "note", "links"].includes(b.type) && (content[b.id] ?? <div className="h-20 animate-pulse rounded-lg bg-chip" />)}
      </section>
    );
  };

  return (
    <div className={`flex flex-col gap-11 ${blocks.length === 0 && !editing ? "hidden" : ""} ${editing ? "pl-4" : ""}`}>
      {rowsOf(blocks).map((row) => (
        <div
          key={row[0].id}
          className="grid items-start gap-11 md:[grid-template-columns:var(--cols)]"
          style={{ "--cols": `repeat(${row.length}, minmax(0, 1fr))` } as React.CSSProperties}
        >
          {row.map((b) => block(b, row.length >= MAX_PER_ROW))}
        </div>
      ))}

      {editing && (
        <button
          ref={addBtn}
          type="button"
          onClick={() => setAdding((a) => !a)}
          className="self-start rounded-md border border-dashed border-[#d3d1cb] px-3 py-1.5 text-sm text-ink-muted hover:bg-chip"
        >
          {t("+ Añadir bloque")}
        </button>
      )}
      <Popover anchor={addBtn} open={editing && adding} onClose={() => setAdding(false)} label={t("Añadir bloque")}>
        <div className="flex max-h-96 w-72 flex-col overflow-y-auto p-1">
          {menu.map((item) => (
            <button
              key={item.type}
              type="button"
              onClick={() => {
                setAdding(false);
                const builtin = (BUILTIN_BLOCKS as readonly string[]).includes(item.type);
                const b: NotebookBlock = builtin
                  ? { id: item.type, type: item.type }
                  : { ...newBlock(item.type), ...(item.type === "todo" ? { items: [] } : item.type === "note" ? { text: "" } : item.type === "links" ? { links: [] } : {}) };
                save([...blocks, b], builtin || item.type === "week" || item.type === "recent" || item.type === "pages");
              }}
              className="flex flex-col rounded-md px-2.5 py-1.5 text-left hover:bg-hover"
            >
              <span className="text-sm font-medium">{t(item.label)}</span>
              <span className="text-xs text-ink-faint">{t(item.hint)}</span>
            </button>
          ))}
        </div>
      </Popover>
    </div>
  );
}

function Todo({ items, onChange }: { items: TodoItem[]; onChange: (items: TodoItem[]) => void }) {
  const t = useT();
  const [draft, setDraft] = useState("");
  // Done ones sink to the bottom.
  const sorted = [...items.filter((i) => !i.done), ...items.filter((i) => i.done)];
  const add = () => {
    const text = draft.trim();
    if (!text) return;
    onChange([...items, { id: newId(), text, done: false }]);
    setDraft("");
  };
  return (
    <ul className="flex flex-col">
      {sorted.map((it) => (
        <li key={it.id} className="group/item flex items-center gap-2.5 rounded-md px-1 py-1 hover:bg-hover">
          <button
            type="button"
            role="checkbox"
            aria-checked={it.done}
            aria-label={it.text}
            onClick={() => onChange(items.map((x) => (x.id === it.id ? { ...x, done: !x.done } : x)))}
            className={`grid size-4 shrink-0 place-items-center rounded-[4px] border-[1.5px] text-[10px] text-white ${it.done ? "border-accent bg-accent" : "border-[#c7c6c2] hover:border-accent"}`}
          >
            {it.done && "✓"}
          </button>
          <input
            defaultValue={it.text}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (!v) onChange(items.filter((x) => x.id !== it.id));
              else if (v !== it.text) onChange(items.map((x) => (x.id === it.id ? { ...x, text: v } : x)));
            }}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            aria-label={t("Tarea")}
            className={`min-w-0 flex-1 bg-transparent text-sm outline-none ${it.done ? "text-ink-faint line-through" : ""}`}
          />
          <button type="button" onClick={() => onChange(items.filter((x) => x.id !== it.id))} aria-label={t("Eliminar")} className="rounded p-0.5 text-ink-faint opacity-0 group-hover/item:opacity-100 hover:text-red-600 max-md:opacity-60">
            <XIcon size={12} className="block" />
          </button>
        </li>
      ))}
      <li className="flex items-center gap-2.5 px-1 py-1">
        <span className="grid size-4 shrink-0 place-items-center text-ink-faint">+</span>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          onBlur={add}
          placeholder={t("Añadir tarea")}
          aria-label={t("Añadir tarea")}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-ink-faint"
        />
      </li>
    </ul>
  );
}

function Note({ text, onChange }: { text: string; onChange: (text: string) => void }) {
  const t = useT();
  return (
    <textarea
      defaultValue={text}
      onBlur={(e) => e.target.value !== text && onChange(e.target.value)}
      placeholder={t("Escribe lo que quieras tener a mano…")}
      rows={Math.max(3, text.split("\n").length + 1)}
      className="field-sizing-content min-h-20 w-full resize-none rounded-lg bg-callout px-3 py-2.5 text-sm leading-relaxed outline-none placeholder:text-ink-faint"
    />
  );
}

function Links({ links, onChange }: { links: LinkItem[]; onChange: (links: LinkItem[]) => void }) {
  const t = useT();
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const add = () => {
    const u = url.trim();
    if (!u) return;
    const href = /^https?:\/\//i.test(u) ? u : `https://${u}`;
    let name = label.trim();
    if (!name) {
      try {
        name = new URL(href).hostname.replace(/^www\./, "");
      } catch {
        name = u;
      }
    }
    onChange([...links, { id: newId(), label: name, url: href }]);
    setUrl("");
    setLabel("");
  };
  const host = (u: string) => {
    try {
      return new URL(u).hostname;
    } catch {
      return "";
    }
  };
  return (
    <div className="flex flex-col gap-1">
      {links.map((l) => (
        <div key={l.id} className="group/item flex items-center gap-2.5 rounded-md px-1 py-1.5 hover:bg-hover">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`https://www.google.com/s2/favicons?domain=${host(l.url)}&sz=32`} alt="" width={16} height={16} className="size-4 shrink-0 rounded-sm" />
          <a href={l.url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate text-sm hover:underline">
            {l.label}
          </a>
          <span className="hidden truncate text-xs text-ink-faint sm:block sm:max-w-40">{host(l.url)}</span>
          <button type="button" onClick={() => onChange(links.filter((x) => x.id !== l.id))} aria-label={t("Quitar")} className="rounded p-0.5 text-ink-faint opacity-0 group-hover/item:opacity-100 hover:text-red-600 max-md:opacity-60">
            <XIcon size={12} className="block" />
          </button>
        </div>
      ))}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
        className="flex flex-wrap items-center gap-2 px-1 pt-1"
      >
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder={t("Pega un enlace")} aria-label={t("Enlace")} inputMode="url" className="min-w-0 flex-[2] basis-40 rounded-md border border-border-subtle bg-transparent px-2 py-1 text-sm outline-none focus:border-accent" />
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={t("Nombre (opcional)")} aria-label={t("Nombre")} className="min-w-0 flex-1 basis-28 rounded-md border border-border-subtle bg-transparent px-2 py-1 text-sm outline-none focus:border-accent" />
        {url.trim() && (
          <button type="submit" className="rounded-md bg-ink px-2.5 py-1 text-xs font-medium text-white">
            {t("Añadir")}
          </button>
        )}
      </form>
    </div>
  );
}
