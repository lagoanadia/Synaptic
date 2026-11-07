"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Notebook } from "../Covers";
import type { NotebookCover } from "@/lib/covers";
import { createSection, reorderSections } from "./actions";
import { EditMenu, menuAt, type EditTarget } from "./EditMenu";

export type ShelfItem = { id: string; name: string; cover: NotebookCover; href: string; movable: boolean };

// Your notebooks as composition notebooks. Drag one onto another to
// reorder, right-click to rename or change its cover; "+" makes a new one.
export function NotebookShelf({ items: initial, width = 92 }: { items: ShelfItem[]; width?: number }) {
  const [items, setItems] = useState(initial);
  const [dragging, setDragging] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditTarget | null>(null);
  const [, start] = useTransition();
  // New names/covers from the server after an edit.
  const [seen, setSeen] = useState(initial);
  if (seen !== initial) {
    setSeen(initial);
    setItems(initial);
  }

  function drop(targetId: string) {
    const from = items.findIndex((t) => t.id === dragging);
    const to = items.findIndex((t) => t.id === targetId);
    setDragging(null);
    if (from < 0 || to < 0 || from === to || !items[to].movable) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setItems(next);
    start(() => reorderSections(next.filter((t) => t.movable).map((t) => t.id)));
  }

  return (
    <div className="-mx-6 flex items-start gap-6 overflow-x-auto px-6 pb-2 sm:mx-0 sm:flex-wrap sm:gap-x-8 sm:gap-y-6 sm:overflow-visible sm:px-0">
      {items.map((n) => (
        <Link
          key={n.id}
          href={n.href}
          draggable={n.movable}
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = "move";
            setDragging(n.id);
          }}
          onDragEnd={() => setDragging(null)}
          onContextMenu={(e) => {
            if (!n.movable) return;
            e.preventDefault();
            setEditing({ kind: "notebook", id: n.id, name: n.name, cover: n.cover, ...menuAt(e) });
          }}
          onDragOver={(e) => dragging && n.movable && e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            drop(n.id);
          }}
          className={`group flex flex-col items-center gap-2.5 ${dragging === n.id ? "opacity-40" : ""}`}
        >
          <Notebook cover={n.cover} name={n.name} width={width} className="transition-transform group-hover:-translate-y-1 group-hover:rotate-[-1deg]" />
          <span className="max-w-28 truncate text-sm font-semibold underline decoration-[1.5px] underline-offset-4">{n.name}</span>
        </Link>
      ))}
      <NewNotebookTile width={width} />
      {editing && <EditMenu target={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function NewNotebookTile({ width }: { width: number }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <div className="flex flex-col items-center gap-2.5">
      {open ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const n = name.trim();
            if (!n) return setOpen(false);
            start(async () => {
              const r = await createSection(n);
              if (r.id) router.push(`/pursuits/s/${r.id}`);
            });
          }}
          className="grid place-items-center rounded-md border-[1.5px] border-dashed border-[#d3d1cb] p-2"
          style={{ width, height: Math.round(width * 1.3) }}
        >
          <input
            autoFocus
            value={name}
            disabled={pending}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => !name.trim() && setOpen(false)}
            onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
            placeholder="Nombre"
            aria-label="Nombre de la libreta"
            className="w-full rounded border border-border-subtle bg-white px-1.5 py-1 text-xs"
          />
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          title="Nueva libreta"
          aria-label="Nueva libreta"
          className="grid place-items-center rounded-md border-[1.5px] border-dashed border-[#d3d1cb] text-2xl text-ink-faint transition-colors hover:border-ink-faint hover:text-ink"
          style={{ width, height: Math.round(width * 1.3) }}
        >
          +
        </button>
      )}
      <span className="h-5" />
    </div>
  );
}
