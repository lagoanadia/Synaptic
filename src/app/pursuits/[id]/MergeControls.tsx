"use client";

import { useState, useTransition } from "react";
import { deleteNote, generateFlashcards, mergeNotes, updateNote } from "./actions";
import { RichContent } from "./RichContent";

type NoteForDisplay = {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
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
  // Captured the moment "Edit" is clicked — what this editor is saving
  // against, so a save that lands after someone else's is caught instead
  // of silently overwriting it. See updateNote's own comment.
  const [editingUpdatedAt, setEditingUpdatedAt] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<{ noteId: string; text: string } | null>(
    null,
  );
  const [flashcardMessage, setFlashcardMessage] = useState<{
    noteId: string;
    text: string;
  } | null>(null);

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
          className="self-start rounded-full border border-accent px-3.5 py-1.5 text-xs font-semibold text-accent transition-colors hover:bg-accent-soft disabled:opacity-50"
        >
          {isPending ? "Merging…" : `Merge ${selected.length} notes →`}
        </button>
      )}
      <div className="flex flex-col gap-4">
        {notes.map((n) => (
          <div
            key={n.id}
            id={n.id}
            className="flex scroll-mt-6 gap-3 rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(13,13,13,0.06)] transition-shadow hover:shadow-[0_8px_24px_rgba(13,13,13,0.08),0_2px_6px_rgba(13,13,13,0.06)]"
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
                            setSaveError(null);
                            const result = await updateNote(
                              pursuitId,
                              n.id,
                              draft,
                              editingUpdatedAt ?? n.updatedAt,
                            );
                            if (result.error) {
                              // Keep the draft open on a conflict (or any
                              // other error) — closing it here would throw
                              // away exactly the edit this is trying to
                              // protect.
                              setSaveError({ noteId: n.id, text: result.error });
                              return;
                            }
                            setEditingId(null);
                          })
                        }
                        className="text-xs font-semibold text-accent disabled:opacity-50"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(null);
                          setSaveError(null);
                        }}
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
                        setEditingUpdatedAt(n.updatedAt);
                        setSaveError(null);
                      }}
                      className="text-xs text-ink-faint hover:text-ink"
                    >
                      Edit
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() =>
                      startTransition(async () => {
                        const result = await generateFlashcards(pursuitId, n.id);
                        setFlashcardMessage({
                          noteId: n.id,
                          text: result.error ?? `${result.count} flashcards generated →`,
                        });
                      })
                    }
                    className="text-xs text-ink-faint hover:text-ink disabled:opacity-50"
                  >
                    Generate flashcards
                  </button>
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
              {flashcardMessage?.noteId === n.id && (
                <p className="text-xs text-ink-faint">{flashcardMessage.text}</p>
              )}
              {editingId === n.id ? (
                <>
                  {saveError?.noteId === n.id && (
                    <p className="text-xs text-red-500">
                      {saveError.text} Your unsaved text is still here if you want to
                      copy it before reloading.
                    </p>
                  )}
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    rows={6}
                    className="w-full resize-y rounded border border-border-subtle bg-white p-2 text-sm leading-relaxed outline-none"
                  />
                </>
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
                      className="rounded-full bg-chip px-2.5 py-0.5 text-xs text-ink-muted"
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
