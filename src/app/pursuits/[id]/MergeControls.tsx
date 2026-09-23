"use client";

import { useState, useTransition } from "react";
import { deleteNote, mergeNotes, updateNote } from "./actions";
import { RichContent } from "./RichContent";

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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

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
          className="self-start rounded-md border border-accent px-3 py-1.5 text-xs font-semibold text-accent hover:bg-accent-soft disabled:opacity-50"
        >
          {isPending ? "Merging…" : `Merge ${selected.length} notes →`}
        </button>
      )}
      <div className="flex flex-col gap-4">
        {notes.map((n) => (
          <div
            key={n.id}
            className="flex gap-3 rounded-md bg-callout p-4"
          >
            <span className="text-ink-faint">▤</span>
            <div className="flex flex-1 flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-xs text-ink-muted">
                  <input
                    type="checkbox"
                    checked={selected.includes(n.id)}
                    onChange={() => toggle(n.id)}
                  />
                  select to merge
                </label>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-ink-muted">
                    {new Date(n.createdAt).toLocaleDateString("en-US", { timeZone: "UTC" })} · from{" "}
                    {n.sourceDumps.length} dumps
                  </span>
                  {editingId === n.id ? (
                    <>
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() =>
                          startTransition(async () => {
                            await updateNote(pursuitId, n.id, draft);
                            setEditingId(null);
                          })
                        }
                        className="text-xs font-semibold text-accent disabled:opacity-50"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="text-xs text-ink-faint hover:text-ink"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(n.id);
                        setDraft(n.content);
                      }}
                      className="text-xs text-ink-faint hover:text-ink"
                    >
                      Edit
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => {
                      if (
                        !window.confirm("Delete this note? This can't be undone.")
                      ) {
                        return;
                      }
                      startTransition(async () => {
                        await deleteNote(pursuitId, n.id);
                        setSelected((cur) => cur.filter((x) => x !== n.id));
                      });
                    }}
                    className="text-xs text-ink-faint hover:text-red-500 disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
              {editingId === n.id ? (
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={6}
                  className="w-full resize-y rounded border border-border-subtle bg-white p-2 text-sm leading-relaxed outline-none"
                />
              ) : (
                <RichContent
                  content={n.content}
                  paragraphClassName="text-sm leading-relaxed whitespace-pre-line"
                />
              )}
              {n.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {n.tags.map((t) => (
                    <span
                      key={t.id}
                      className="rounded bg-chip px-2 py-0.5 text-xs text-ink-muted"
                    >
                      {t.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {notes.length === 0 && (
          <p className="text-sm text-ink-muted">No organized notes yet.</p>
        )}
      </div>
    </div>
  );
}
