"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  createContentSection,
  deleteBrainDump,
  deleteContentSection,
  finalizeBrainDump,
  organizeDumps,
  reorderDumpSection,
} from "./actions";
import { DeleteButton } from "../DeleteButton";
import { AuthorBadge } from "./AuthorBadge";
import { autoTitle } from "@/lib/text";

type DumpForDisplay = {
  id: string;
  content: string | null;
  images: string[];
  processed: boolean;
  createdAt: string;
  sectionId: string | null;
  sectionOrder: number;
  author: { name: string; image: string | null; colorIndex: number };
};

type SectionForDisplay = { id: string; name: string };

// Groups dumps by sectionId — within a group, sorted by sectionOrder
// (set to its index in the list every time something's dragged into or
// reordered within that group — see reorderDumpSection) rather than
// createdAt, which would otherwise put whatever's newest on top
// regardless of where it was actually dropped. A dump that's never been
// touched keeps sectionOrder 0, and the sort is stable, so untouched
// groups still read in their original createdAt-desc order. Dumps whose
// sectionId doesn't match any current section (one just got deleted
// elsewhere) fall back into unsectioned rather than disappearing.
function groupBySection(dumps: DumpForDisplay[], sections: SectionForDisplay[]) {
  const bySection = new Map<string, DumpForDisplay[]>();
  const unsectioned: DumpForDisplay[] = [];
  for (const d of dumps) {
    const section = d.sectionId && sections.some((s) => s.id === d.sectionId) ? d.sectionId : null;
    if (section === null) {
      unsectioned.push(d);
    } else {
      bySection.set(section, [...(bySection.get(section) ?? []), d]);
    }
  }
  unsectioned.sort((a, b) => a.sectionOrder - b.sectionOrder);
  for (const items of bySection.values()) {
    items.sort((a, b) => a.sectionOrder - b.sectionOrder);
  }
  return { unsectioned, bySection };
}

// Builds the full ordered id list a group should have after dragging
// draggedId onto targetId within it — draggedId is removed first (a
// no-op if it wasn't already in this group, i.e. it's arriving from
// somewhere else) then spliced back in right before or after targetId
// depending which half of targetId's row the cursor is over.
function withDraggedInsertedAt(
  list: DumpForDisplay[],
  draggedId: string,
  targetId: string,
  insertAfter: boolean,
): string[] {
  const ids = list.filter((d) => d.id !== draggedId).map((d) => d.id);
  const targetIndex = ids.indexOf(targetId);
  const insertAt = insertAfter ? targetIndex + 1 : targetIndex;
  ids.splice(insertAt, 0, draggedId);
  return ids;
}

function DumpRow({
  pursuitId,
  d,
  selected,
  onToggle,
  showAuthors,
  isPending,
  startTransition,
  onDragStart,
  onDropOnRow,
}: {
  pursuitId: string;
  d: DumpForDisplay;
  selected: boolean;
  onToggle: () => void;
  showAuthors: boolean;
  isPending: boolean;
  startTransition: (fn: () => void | Promise<void>) => void;
  onDragStart: (e: React.DragEvent) => void;
  onDropOnRow: (e: React.DragEvent) => void;
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDropOnRow}
      className="-mx-2 flex cursor-grab items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-chip active:cursor-grabbing"
    >
      {!d.processed && (
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          className="flex-shrink-0"
        />
      )}
      <Link
        href={`/pursuits/${pursuitId}/dump/${d.id}`}
        className="flex flex-1 items-center gap-3 overflow-hidden"
      >
        <span
          className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${
            d.processed ? "bg-ink-faint" : "bg-accent"
          }`}
        />
        {showAuthors && (
          <AuthorBadge
            name={d.author.name}
            image={d.author.image}
            colorIndex={d.author.colorIndex}
          />
        )}
        {d.images.length > 0 && <span>🖼</span>}
        <span className="flex-1 truncate text-sm">{autoTitle(d.content)}</span>
        <span className="text-xs whitespace-nowrap text-ink-faint">
          {new Date(d.createdAt).toLocaleDateString("en-US", { timeZone: "UTC" })}
        </span>
        {d.processed && (
          <span className="text-xs whitespace-nowrap text-ink-faint">→ in note</span>
        )}
      </Link>
      {!d.processed && (
        <button
          type="button"
          disabled={isPending}
          onClick={() => startTransition(() => finalizeBrainDump(pursuitId, d.id))}
          className="text-xs whitespace-nowrap text-ink-faint hover:text-ink disabled:opacity-50"
          title="Already written the way you want it — skip the AI and use it as a note directly"
        >
          Finalize
        </button>
      )}
      <DeleteButton
        action={deleteBrainDump.bind(null, pursuitId, d.id)}
        confirmMessage="Delete this page? This can't be undone."
        className="px-1 text-ink-faint hover:text-red-500"
      >
        ×
      </DeleteButton>
    </div>
  );
}

// Client Component: needs local state for which unprocessed dumps are
// checked to send to Organize — not every dump needs the AI's help, so
// Organize no longer just grabs everything unprocessed by default.
export function DumpControls({
  pursuitId,
  dumps,
  showAuthors,
  sections,
}: {
  pursuitId: string;
  dumps: DumpForDisplay[];
  showAuthors: boolean;
  sections: SectionForDisplay[];
}) {
  const unprocessed = dumps.filter((d) => !d.processed);
  const [selected, setSelected] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();
  const [organizeError, setOrganizeError] = useState<string | null>(null);
  const [addingSection, setAddingSection] = useState(false);
  const [dragOverSection, setDragOverSection] = useState<string | "unsectioned" | null>(null);
  const newSectionRef = useRef<HTMLInputElement>(null);

  // A dump that got organized (or deleted) since this state was last set
  // shouldn't still count toward the selection — its checkbox is gone too.
  const effectiveSelected = selected.filter((id) =>
    unprocessed.some((d) => d.id === id),
  );

  function toggle(id: string) {
    setSelected((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
    );
  }

  // Dropped on empty space in a group — append to the end of it.
  function handleGroupDrop(sectionId: string | null, list: DumpForDisplay[], e: React.DragEvent) {
    e.preventDefault();
    setDragOverSection(null);
    const draggedId = e.dataTransfer.getData("text/plain");
    if (!draggedId) return;
    const ids = [...list.filter((d) => d.id !== draggedId).map((d) => d.id), draggedId];
    startTransition(() => reorderDumpSection(pursuitId, sectionId, ids));
  }

  // Dropped on a specific row — insert right there instead of at the end,
  // whether that row's own group is the dragged page's current one or not.
  function handleRowDrop(
    sectionId: string | null,
    list: DumpForDisplay[],
    targetId: string,
    e: React.DragEvent,
  ) {
    e.preventDefault();
    e.stopPropagation();
    setDragOverSection(null);
    const draggedId = e.dataTransfer.getData("text/plain");
    if (!draggedId || draggedId === targetId) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const insertAfter = e.clientY - rect.top > rect.height / 2;
    const ids = withDraggedInsertedAt(list, draggedId, targetId, insertAfter);
    startTransition(() => reorderDumpSection(pursuitId, sectionId, ids));
  }

  const { unsectioned, bySection } = groupBySection(dumps, sections);

  function renderRows(list: DumpForDisplay[], sectionId: string | null) {
    return list.map((d) => (
      <DumpRow
        key={d.id}
        pursuitId={pursuitId}
        d={d}
        selected={selected.includes(d.id)}
        onToggle={() => toggle(d.id)}
        showAuthors={showAuthors}
        isPending={isPending}
        startTransition={startTransition}
        onDragStart={(e) => e.dataTransfer.setData("text/plain", d.id)}
        onDropOnRow={(e) => handleRowDrop(sectionId, list, d.id, e)}
      />
    ));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Link
          href={`/pursuits/${pursuitId}/dump/new`}
          className="self-start rounded-full border border-border-subtle bg-white px-4 py-2 text-sm text-ink-muted transition-colors hover:border-ink hover:text-ink"
        >
          + New page
        </Link>
        {addingSection ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const name = newSectionRef.current?.value.trim();
              if (!name) return;
              startTransition(() => createContentSection(pursuitId, name));
              setAddingSection(false);
            }}
            className="flex items-center gap-1.5"
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

      {effectiveSelected.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                const result = await organizeDumps(pursuitId, effectiveSelected);
                setOrganizeError(result.error);
              })
            }
            className="self-start rounded-full border border-accent px-3.5 py-1.5 text-xs font-semibold text-accent transition-colors hover:bg-accent-soft disabled:opacity-50"
          >
            ✦ Organize {effectiveSelected.length} selected →
          </button>
          {organizeError && <p className="text-xs text-red-500">{organizeError}</p>}
        </div>
      )}

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOverSection("unsectioned");
        }}
        onDragLeave={() => setDragOverSection(null)}
        onDrop={(e) => handleGroupDrop(null, unsectioned, e)}
        className={`flex flex-col rounded-xl transition-colors ${
          dragOverSection === "unsectioned" ? "bg-chip" : ""
        }`}
      >
        {renderRows(unsectioned, null)}
      </div>

      {sections.map((s) => {
        const items = bySection.get(s.id) ?? [];
        return (
          <div key={s.id} className="flex flex-col gap-1">
            <div className="mt-2 flex items-center gap-2 border-b border-border-subtle pb-1.5">
              <span className="text-xs font-semibold tracking-wide text-ink-muted uppercase">
                {s.name}
              </span>
              <DeleteButton
                action={deleteContentSection.bind(null, pursuitId, s.id)}
                confirmMessage={`Delete section "${s.name}"? Its pages go back to unsectioned.`}
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
              onDrop={(e) => handleGroupDrop(s.id, items, e)}
              className={`flex flex-col rounded-xl transition-colors ${
                dragOverSection === s.id ? "bg-chip" : ""
              }`}
            >
              {items.length > 0 ? (
                renderRows(items, s.id)
              ) : (
                <p className="px-2 py-2 text-xs text-ink-faint">Drag a page here</p>
              )}
            </div>
          </div>
        );
      })}

      {dumps.length === 0 && (
        <p className="text-sm text-ink-muted">Nothing dumped yet — start above.</p>
      )}
    </div>
  );
}
