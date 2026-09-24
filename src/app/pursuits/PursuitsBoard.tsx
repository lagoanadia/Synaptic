"use client";

import { useRef, useState, useTransition } from "react";
import { assignSection, deletePursuit } from "./actions";
import { DeleteButton } from "./DeleteButton";

const TYPE_LABEL: Record<string, string> = {
  PROJECT: "Project",
  BOOK: "Book",
  LANGUAGE: "Language",
  SKILL: "Skill",
  OTHER: "Other",
};

function typeLabel(p: { type: string; customType: string | null }) {
  if (p.type === "OTHER" && p.customType) return p.customType;
  return TYPE_LABEL[p.type];
}

export type PursuitForDisplay = {
  id: string;
  title: string;
  type: string;
  customType: string | null;
  status: string;
  timeAgoLabel: string;
  ownerId: string;
  pursuitTags: { id: string; name: string }[];
};

function PursuitCard({
  p,
  viewerId,
  selectMode,
  selected,
  onToggle,
}: {
  p: PursuitForDisplay;
  viewerId: string;
  selectMode: boolean;
  selected: boolean;
  onToggle: (id: string) => void;
}) {
  const canSelect = selectMode && p.ownerId === viewerId;

  const cardBody = (
    <div className="flex flex-1 flex-col gap-3">
      <div className="flex items-center gap-2">
        <span
          className={`h-2 w-2 flex-shrink-0 rounded-full ${
            p.status === "ACTIVE" ? "bg-accent" : "bg-ink-faint"
          }`}
        />
        <span className="truncate text-xs text-ink-muted">
          {typeLabel(p)} · {p.status.toLowerCase()}
        </span>
      </div>
      <div className="text-base font-semibold">{p.title}</div>
      {p.pursuitTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {p.pursuitTags.map((t) => (
            <span
              key={t.id}
              className="rounded bg-chip px-2 py-0.5 text-xs text-ink-muted"
            >
              {t.name}
            </span>
          ))}
        </div>
      )}
      <div className="text-xs text-ink-faint">last touched {p.timeAgoLabel}</div>
    </div>
  );

  return (
    <div
      className={`flex w-56 flex-shrink-0 flex-col gap-3 rounded-lg border p-5 ${
        selected
          ? "border-solid border-accent bg-accent-soft"
          : "border-dashed border-border-subtle bg-white hover:border-solid hover:border-ink"
      }`}
    >
      <div className="flex flex-1 items-start gap-2">
        {canSelect && (
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggle(p.id)}
            className="mt-1 flex-shrink-0"
          />
        )}
        {canSelect ? (
          <button type="button" onClick={() => onToggle(p.id)} className="flex-1 text-left">
            {cardBody}
          </button>
        ) : (
          <a href={`/pursuits/${p.id}`} className="flex-1">
            {cardBody}
          </a>
        )}
      </div>
      {!selectMode && p.ownerId === viewerId && (
        <DeleteButton
          action={deletePursuit.bind(null, p.id)}
          confirmMessage={`Delete "${p.title}"? This deletes everything inside it and can't be undone.`}
          className="self-start text-xs text-ink-faint hover:text-red-500"
        >
          Delete
        </DeleteButton>
      )}
    </div>
  );
}

function PursuitRow({
  label,
  pursuits,
  viewerId,
  selectMode,
  selected,
  onToggle,
}: {
  label: string;
  pursuits: PursuitForDisplay[];
  viewerId: string;
  selectMode: boolean;
  selected: Set<string>;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <span className="text-sm text-ink-muted">{label}</span>
      <div className="flex gap-4 overflow-x-auto pb-2">
        {pursuits.map((p) => (
          <PursuitCard
            key={p.id}
            p={p}
            viewerId={viewerId}
            selectMode={selectMode}
            selected={selected.has(p.id)}
            onToggle={onToggle}
          />
        ))}
      </div>
    </div>
  );
}

// Lets the viewer multi-select their own pursuits (checkboxes replace the
// status dot) and drop them all into one section in a single action —
// meant for exactly the case where a deleted section scattered pursuits
// back into "No section" and re-typing the name on each one is tedious.
export function PursuitsBoard({
  sectionRows,
  shared,
  unsectioned,
  sectionNames,
  viewerId,
}: {
  sectionRows: [string, PursuitForDisplay[]][];
  shared: PursuitForDisplay[];
  unsectioned: PursuitForDisplay[];
  sectionNames: string[];
  viewerId: string;
}) {
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const sectionInputRef = useRef<HTMLInputElement>(null);

  const ownedCount =
    sectionRows.reduce((n, [, ps]) => n + ps.length, 0) + unsectioned.length;

  function toggle(id: string) {
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelected(new Set());
  }

  function handleAssign() {
    const name = sectionInputRef.current?.value.trim();
    if (!name || selected.size === 0) return;
    startTransition(async () => {
      await assignSection(Array.from(selected), name);
      exitSelectMode();
    });
  }

  return (
    <div className="flex flex-col gap-8">
      {ownedCount > 0 && (
        <div>
          {selectMode ? (
            <div className="flex flex-wrap items-center gap-2 rounded-md bg-chip px-3 py-2">
              <span className="text-xs text-ink-muted">
                {selected.size} selected
              </span>
              <input
                ref={sectionInputRef}
                type="text"
                list="pursuit-sections-bulk"
                placeholder="Section name"
                className="rounded-md border border-border-subtle bg-white px-3 py-1.5 text-xs"
              />
              <datalist id="pursuit-sections-bulk">
                {sectionNames.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
              <button
                type="button"
                onClick={handleAssign}
                disabled={isPending || selected.size === 0}
                className="rounded-md bg-ink px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                Assign section
              </button>
              <button
                type="button"
                onClick={exitSelectMode}
                className="text-xs text-ink-faint hover:text-ink"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setSelectMode(true)}
              className="text-xs text-ink-muted hover:text-ink hover:underline"
            >
              Select pursuits…
            </button>
          )}
        </div>
      )}

      {sectionRows.map(([name, rowPursuits]) => (
        <PursuitRow
          key={name}
          label={name}
          pursuits={rowPursuits}
          viewerId={viewerId}
          selectMode={selectMode}
          selected={selected}
          onToggle={toggle}
        />
      ))}
      {shared.length > 0 && (
        <PursuitRow
          label="Shared with me"
          pursuits={shared}
          viewerId={viewerId}
          selectMode={selectMode}
          selected={selected}
          onToggle={toggle}
        />
      )}
      {unsectioned.length > 0 && (
        <PursuitRow
          label="No section"
          pursuits={unsectioned}
          viewerId={viewerId}
          selectMode={selectMode}
          selected={selected}
          onToggle={toggle}
        />
      )}
      {sectionRows.length === 0 && shared.length === 0 && unsectioned.length === 0 && (
        <p className="text-sm text-ink-muted">
          No pursuits yet — create your first one above.
        </p>
      )}
    </div>
  );
}
