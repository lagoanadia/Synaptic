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

// The exact 3 colors from nadia-lagoa.vercel.app's own "Things I've built"
// project cards (Synaptic/Larder/Kook), not an invented palette. Assigned by
// a card's position within its own section/row (cycling through the 3),
// not by pursuit type — so two PROJECT pursuits in the same row get
// different colors. Full saturation while active, softened once
// paused/done, same identity color either way.
const CARD_BG = ["bg-flame", "bg-crimson", "bg-cobalt"];
const CARD_BG_SOFT = ["bg-flame-soft", "bg-crimson-soft", "bg-cobalt-soft"];

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
  colorIndex,
  viewerId,
  selectMode,
  selected,
  onToggle,
}: {
  p: PursuitForDisplay;
  colorIndex: number;
  viewerId: string;
  selectMode: boolean;
  selected: boolean;
  onToggle: (id: string) => void;
}) {
  const canSelect = selectMode && p.ownerId === viewerId;

  // Full-saturation cards (active, unselected) carry white text like the
  // source project cards do; softened/selected cards are pale washes, so
  // they keep the app's usual dark ink text.
  const vivid = !selected && p.status === "ACTIVE";

  const cardBody = (
    <div className="flex flex-1 flex-col gap-3">
      <span className={`truncate text-xs font-medium ${vivid ? "text-white/80" : "text-ink/80"}`}>
        {typeLabel(p)} · {p.status.toLowerCase()}
      </span>
      <div className={`text-base font-semibold ${vivid ? "text-white" : "text-ink"}`}>{p.title}</div>
      {p.pursuitTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {p.pursuitTags.map((t) => (
            <span
              key={t.id}
              className={`rounded-full px-2 py-0.5 text-xs ${vivid ? "bg-white/20 text-white" : "bg-black/10 text-ink"}`}
            >
              {t.name}
            </span>
          ))}
        </div>
      )}
      <div className={`text-xs ${vivid ? "text-white/70" : "text-ink/70"}`}>
        last touched {p.timeAgoLabel}
      </div>
    </div>
  );

  // The whole card is filled with a color from the 3-color set, picked by
  // this card's position within its own section — full strength while
  // active, softened once paused/done — instead of just a status dot.
  const bg = selected
    ? "bg-accent-soft ring-2 ring-accent"
    : p.status === "ACTIVE"
      ? CARD_BG[colorIndex % CARD_BG.length]
      : CARD_BG_SOFT[colorIndex % CARD_BG_SOFT.length];

  return (
    <div
      className={`flex w-56 flex-shrink-0 flex-col gap-3 rounded-2xl p-5 shadow-[0_1px_2px_rgba(13,13,13,0.06)] transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-[0_8px_24px_rgba(13,13,13,0.08),0_2px_6px_rgba(13,13,13,0.06)] ${bg}`}
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
          className={`self-start text-xs ${vivid ? "text-white/70 hover:text-white" : "text-ink/70 hover:text-red-600"}`}
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
        {pursuits.map((p, i) => (
          <PursuitCard
            key={p.id}
            p={p}
            colorIndex={i}
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
