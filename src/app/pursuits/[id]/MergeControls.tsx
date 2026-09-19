"use client";

import { useState, useTransition } from "react";
import { mergeNotes } from "./actions";

type NoteForDisplay = {
  id: string;
  content: string;
  createdAt: string;
  tags: { id: string; name: string }[];
  sourceDumps: { id: string }[];
};

// Client Component: needs local state for which notes are checked, and to
// call the mergeNotes Server Action directly (not through a <form>).
export function MergeControls({
  pursuitId,
  notes,
}: {
  pursuitId: string;
  notes: NoteForDisplay[];
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();

  function toggle(id: string) {
    setSelected((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {selected.length >= 2 && (
        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              await mergeNotes(pursuitId, selected);
              setSelected([]);
            })
          }
          className="self-start rounded-md border border-blue-500 px-3 py-1.5 font-mono text-xs font-medium tracking-wide text-blue-500 uppercase hover:bg-blue-50 disabled:opacity-50 dark:hover:bg-blue-950"
        >
          {isPending ? "Merging…" : `Merge ${selected.length} notes →`}
        </button>
      )}
      <div className="flex flex-col gap-4">
        {notes.map((n) => (
          <div
            key={n.id}
            className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
          >
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 font-mono text-xs text-zinc-500">
                <input
                  type="checkbox"
                  checked={selected.includes(n.id)}
                  onChange={() => toggle(n.id)}
                />
                select to merge
              </label>
              <span className="font-mono text-xs text-zinc-500">
                {new Date(n.createdAt).toLocaleDateString()} · from{" "}
                {n.sourceDumps.length} dumps
              </span>
            </div>
            <p className="text-sm leading-relaxed whitespace-pre-line">
              {n.content}
            </p>
            {n.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {n.tags.map((t) => (
                  <span
                    key={t.id}
                    className="rounded-full bg-zinc-100 px-2 py-0.5 font-mono text-[10px] text-zinc-600 uppercase dark:bg-zinc-800 dark:text-zinc-400"
                  >
                    {t.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
        {notes.length === 0 && (
          <p className="text-sm text-zinc-500">No organized notes yet.</p>
        )}
      </div>
    </div>
  );
}
