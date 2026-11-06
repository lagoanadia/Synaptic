"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSection, reorderSections } from "./actions";

export type Tile = {
  id: string;
  // Real sections can be dragged to reorder; Unsorted/Shared can't.
  movable: boolean;
  href: string;
  name: string;
  subtitle: string;
  colorClass: string;
  badge?: string;
};

// Big square tiles; the first PINNED show until you ask for the rest.
// Drag a tile onto another to reorder (that's how you choose what's pinned).
const PINNED = 4;

export function SectionTiles({ tiles: initial }: { tiles: Tile[] }) {
  const [tiles, setTiles] = useState(initial);
  const [showAll, setShowAll] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const visible = showAll ? tiles : tiles.slice(0, PINNED);
  const hidden = tiles.length - PINNED;

  function drop(targetId: string) {
    const from = tiles.findIndex((t) => t.id === dragging);
    const to = tiles.findIndex((t) => t.id === targetId);
    setDragging(null);
    setOver(null);
    if (from < 0 || to < 0 || from === to || !tiles[to].movable) return;
    const next = [...tiles];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setTiles(next);
    startTransition(() => reorderSections(next.filter((t) => t.movable).map((t) => t.id)));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
        {visible.map((t) => (
          <Link
            key={t.id}
            href={t.href}
            draggable={t.movable}
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = "move";
              setDragging(t.id);
            }}
            onDragEnd={() => {
              setDragging(null);
              setOver(null);
            }}
            onDragOver={(e) => {
              if (!dragging || !t.movable) return;
              e.preventDefault();
              setOver(t.id);
            }}
            onDrop={(e) => {
              e.preventDefault();
              drop(t.id);
            }}
            title={t.movable ? "Drag to reorder" : undefined}
            className={`group relative flex aspect-square flex-col justify-end rounded-3xl p-5 text-white shadow-[0_1px_2px_rgba(13,13,13,0.06)] transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-[0_12px_28px_rgba(13,13,13,0.12)] ${t.colorClass} ${
              t.movable ? "cursor-grab active:cursor-grabbing" : ""
            } ${dragging === t.id ? "scale-95 opacity-40" : ""} ${over === t.id && dragging !== t.id ? "ring-4 ring-ink ring-offset-2 ring-offset-background" : ""}`}
          >
            {t.badge && (
              <span className="absolute top-4 right-4 rounded-full bg-white/25 px-2.5 py-1 text-xs font-semibold">
                {t.badge}
              </span>
            )}
            <span className="text-xl leading-tight font-extrabold tracking-wide uppercase sm:text-2xl">
              {t.name}
            </span>
            <span className="mt-1 text-xs font-medium">{t.subtitle}</span>
          </Link>
        ))}
        <AddSectionTile />
      </div>
      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          aria-expanded={showAll}
          className="flex items-center gap-1.5 self-start rounded-full px-2 py-1 text-xs font-semibold text-ink-muted hover:bg-chip"
        >
          {showAll ? (
            "Show less"
          ) : (
            <>
              <span aria-hidden className="flex gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-tile-aqua" />
                <span className="h-1.5 w-1.5 rounded-full bg-tile-aqua" />
                <span className="h-1.5 w-1.5 rounded-full bg-tile-aqua" />
              </span>
              {hidden} more
            </>
          )}
        </button>
      )}
    </div>
  );
}

function AddSectionTile() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await createSection(name);
      if (result.error) {
        setError(result.error);
        return;
      }
      setName("");
      setOpen(false);
      setError(null);
      if (result.id) router.push(`/pursuits/s/${result.id}`);
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex aspect-square flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-border-subtle text-ink-muted transition-colors hover:border-tile-aqua hover:text-tile-teal"
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-tile-aqua text-2xl font-bold text-white">
          +
        </span>
        <span className="text-xs font-semibold">New section</span>
      </button>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="flex aspect-square flex-col justify-center gap-2 rounded-3xl border-2 border-tile-aqua bg-white p-4"
    >
      <label htmlFor="new-section" className="text-xs font-semibold text-ink-muted">
        Section name
      </label>
      <input
        id="new-section"
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        placeholder="e.g. School"
        className="rounded-xl border border-border-subtle px-3 py-2 text-sm"
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="flex-1 rounded-full bg-ink px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
        >
          {isPending ? "Adding…" : "Add"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-full px-3 py-2 text-xs text-ink-muted hover:bg-chip"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
