"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  assignDumpSection,
  createContentSection,
  deleteBrainDump,
  deleteContentSection,
  finalizeBrainDump,
  organizeDumps,
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
  author: { name: string; image: string | null; colorIndex: number };
};

type SectionForDisplay = { id: string; name: string };

// Groups dumps by sectionId, keeping each group's own relative order and
// the Pursuit's section order — dumps whose sectionId doesn't match any
// current section (one just got deleted elsewhere) fall back into the
// unsectioned bucket rather than disappearing.
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
  return { unsectioned, bySection };
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
}: {
  pursuitId: string;
  d: DumpForDisplay;
  selected: boolean;
  onToggle: () => void;
  showAuthors: boolean;
  isPending: boolean;
  startTransition: (fn: () => void | Promise<void>) => void;
  onDragStart: (e: React.DragEvent) => void;
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
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

  function handleDrop(sectionId: string | null, e: React.DragEvent) {
    e.preventDefault();
    setDragOverSection(null);
    const dumpId = e.dataTransfer.getData("text/plain");
    if (!dumpId) return;
    startTransition(() => assignDumpSection(pursuitId, dumpId, sectionId));
  }

  const { unsectioned, bySection } = groupBySection(dumps, sections);

  function renderRows(list: DumpForDisplay[]) {
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
        onDrop={(e) => handleDrop(null, e)}
        className={`flex flex-col rounded-xl transition-colors ${
          dragOverSection === "unsectioned" ? "bg-chip" : ""
        }`}
      >
        {renderRows(unsectioned)}
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
              onDrop={(e) => handleDrop(s.id, e)}
              className={`flex flex-col rounded-xl transition-colors ${
                dragOverSection === s.id ? "bg-chip" : ""
              }`}
            >
              {items.length > 0 ? (
                renderRows(items)
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
