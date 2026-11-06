"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { createContentSection } from "./actions";

type SectionTile = { id: string; name: string; pages: number; notes: number };

// The subject page's landing view: one tile per content section (U1, U2…)
// filling the width, instead of one long narrow list. A tile opens Brain
// Dump filtered to that section.
export function SectionGrid({ pursuitId, tiles }: { pursuitId: string; tiles: SectionTile[] }) {
  return (
    <section aria-label="Sections" className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
        {tiles.map((t) => (
          <Link
            key={t.id}
            href={`/pursuits/${pursuitId}?tab=pages&section=${t.id}`}
            className={`flex aspect-[4/3] flex-col justify-between rounded-3xl p-4 text-white transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_28px_rgba(13,13,13,0.12)] ${
              t.id === "unsorted" ? "bg-ink-muted" : "bg-tile-blue"
            }`}
          >
            <span className="text-lg leading-tight font-extrabold break-words uppercase">{t.name}</span>
            <span className="text-xs font-medium">
              {t.pages} page{t.pages === 1 ? "" : "s"} · {t.notes} note{t.notes === 1 ? "" : "s"}
            </span>
          </Link>
        ))}
        <NewSectionTile pursuitId={pursuitId} />
      </div>
      {tiles.length === 0 && (
        <Link
          href={`/pursuits/${pursuitId}/dump/new`}
          className="self-start rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white"
        >
          + First page
        </Link>
      )}
    </section>
  );
}

function NewSectionTile({ pursuitId }: { pursuitId: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [isPending, startTransition] = useTransition();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex aspect-[4/3] flex-col items-center justify-center gap-1.5 rounded-3xl border-2 border-dashed border-border-subtle text-ink-muted transition-colors hover:border-tile-sky hover:text-tile-sky"
      >
        <span className="text-2xl font-bold">+</span>
        <span className="text-xs font-semibold">New section</span>
      </button>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          await createContentSection(pursuitId, name);
          setName("");
          setOpen(false);
        });
      }}
      className="flex aspect-[4/3] flex-col justify-center gap-2 rounded-3xl border-2 border-tile-sky bg-white p-3"
    >
      <input
        autoFocus
        aria-label="Section name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        placeholder="e.g. UD3"
        className="rounded-xl border border-border-subtle px-3 py-2 text-sm"
      />
      <button
        type="submit"
        disabled={isPending || name.trim() === ""}
        className="rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
      >
        {isPending ? "Adding…" : "Add"}
      </button>
    </form>
  );
}
