"use client";

import { useRef, useState, useTransition } from "react";
import {
  assignNoteSection,
  createContentSection,
  deleteContentSection,
  deleteNote,
  generateFlashcards,
  mergeNotes,
  updateNote,
} from "./actions";
import { DeleteButton } from "../DeleteButton";
import { RichContent } from "./RichContent";
import { autoTitle } from "@/lib/text";

type NoteForDisplay = {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  tags: { id: string; name: string }[];
  sourceDumps: { id: string }[];
  sectionId: string | null;
};

type SectionForDisplay = { id: string; name: string };

// Same grouping rule as DumpControls' groupBySection — a note whose
// sectionId doesn't match any current section (one just got deleted)
// falls back to unsectioned instead of disappearing.
function groupBySection(notes: NoteForDisplay[], sections: SectionForDisplay[]) {
  const bySection = new Map<string, NoteForDisplay[]>();
  const unsectioned: NoteForDisplay[] = [];
  for (const n of notes) {
    const section = n.sectionId && sections.some((s) => s.id === n.sectionId) ? n.sectionId : null;
    if (section === null) {
      unsectioned.push(n);
    } else {
      bySection.set(section, [...(bySection.get(section) ?? []), n]);
    }
  }
  return { unsectioned, bySection };
}

// Client Component: needs local state for which notes are checked, and to
// call the mergeNotes Server Action directly (not through a <form>).
export function MergeControls({
  pursuitId,
  notes,
  sections,
}: {
  pursuitId: string;
  notes: NoteForDisplay[];
  sections: SectionForDisplay[];
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
  // Cards start collapsed to just a title — expanding is what shows the
  // full note, so scanning a long Organized tab means reading titles, not
  // scrolling past walls of text.
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [addingSection, setAddingSection] = useState(false);
  const [dragOverSection, setDragOverSection] = useState<string | "unsectioned" | null>(null);
  const newSectionRef = useRef<HTMLInputElement>(null);

  function toggle(id: string) {
    setSelected((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
    );
  }

  function toggleExpanded(id: string) {
    setExpandedIds((cur) => {
      const next = new Set(cur);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function handleDrop(sectionId: string | null, e: React.DragEvent) {
    e.preventDefault();
    setDragOverSection(null);
    const noteId = e.dataTransfer.getData("text/plain");
    if (!noteId) return;
    startTransition(() => assignNoteSection(pursuitId, noteId, sectionId));
  }

  function renderCard(n: NoteForDisplay) {
    const isExpanded = expandedIds.has(n.id) || editingId === n.id;
    return (
      <div
        key={n.id}
        id={n.id}
        draggable
        onDragStart={(e) => e.dataTransfer.setData("text/plain", n.id)}
        className="flex scroll-mt-6 cursor-grab gap-3 rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(13,13,13,0.06)] transition-shadow hover:shadow-[0_8px_24px_rgba(13,13,13,0.08),0_2px_6px_rgba(13,13,13,0.06)] active:cursor-grabbing"
      >
        <span className="text-ink-faint">▤</span>
        <div className="flex flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="checkbox"
              checked={selected.includes(n.id)}
              onChange={() => toggle(n.id)}
              title="Select to merge"
            />
            <button
              type="button"
              onClick={() => toggleExpanded(n.id)}
              className="flex flex-1 items-center gap-2 overflow-hidden text-left"
            >
              <span className="text-xs text-ink-faint">
                {isExpanded ? "▾" : "▸"}
              </span>
              <span className="flex-1 truncate text-sm font-medium">
                {autoTitle(n.content, 10)}
              </span>
            </button>
            <span className="text-xs whitespace-nowrap text-ink-muted">
              {new Date(n.createdAt).toLocaleDateString("en-US", { timeZone: "UTC" })} · from{" "}
              {n.sourceDumps.length} dumps
            </span>
            <a
              href={`/pursuits/${pursuitId}/print?note=${n.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs whitespace-nowrap text-ink-faint hover:text-ink"
            >
              Export PDF
            </a>
          </div>

          {isExpanded && (
            <>
              <div className="flex items-center justify-end gap-3">
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
                      setExpandedIds((cur) => new Set(cur).add(n.id));
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
            </>
          )}
        </div>
      </div>
    );
  }

  const { unsectioned, bySection } = groupBySection(notes, sections);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
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
        {addingSection ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const name = newSectionRef.current?.value.trim();
              if (!name) return;
              startTransition(() => createContentSection(pursuitId, name));
              setAddingSection(false);
            }}
          >
            <input
              ref={newSectionRef}
              type="text"
              autoFocus
              placeholder="Section name"
              onBlur={() => setAddingSection(false)}
              className="rounded-md border border-border-subtle bg-white px-2.5 py-1.5 text-xs"
            />
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setAddingSection(true)}
            className="self-start rounded-full border border-dashed border-border-subtle px-3.5 py-2 text-xs text-ink-faint transition-colors hover:border-ink hover:text-ink"
          >
            + Section
          </button>
        )}
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOverSection("unsectioned");
        }}
        onDragLeave={() => setDragOverSection(null)}
        onDrop={(e) => handleDrop(null, e)}
        className={`flex flex-col gap-4 rounded-2xl transition-colors ${
          dragOverSection === "unsectioned" ? "bg-chip" : ""
        }`}
      >
        {unsectioned.map(renderCard)}
      </div>

      {sections.map((s) => {
        const items = bySection.get(s.id) ?? [];
        return (
          <div key={s.id} className="flex flex-col gap-2">
            <div className="mt-2 flex items-center gap-2 border-b border-border-subtle pb-1.5">
              <span className="text-xs font-semibold tracking-wide text-ink-muted uppercase">
                {s.name}
              </span>
              <DeleteButton
                action={deleteContentSection.bind(null, pursuitId, s.id)}
                confirmMessage={`Delete section "${s.name}"? Its notes go back to unsectioned.`}
                className="text-ink-faint hover:text-red-500"
              >
                ×
              </DeleteButton>
            </div>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverSection(s.id);
              }}
              onDragLeave={() => setDragOverSection(null)}
              onDrop={(e) => handleDrop(s.id, e)}
              className={`flex flex-col gap-4 rounded-2xl transition-colors ${
                dragOverSection === s.id ? "bg-chip" : ""
              }`}
            >
              {items.length > 0 ? (
                items.map(renderCard)
              ) : (
                <p className="px-2 py-2 text-xs text-ink-faint">Drag a note here</p>
              )}
            </div>
          </div>
        );
      })}

      {notes.length === 0 && (
        <p className="text-sm text-ink-muted">No organized notes yet.</p>
      )}
    </div>
  );
}
