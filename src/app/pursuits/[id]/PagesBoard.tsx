"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { CheckIcon, TrashIcon } from "@/app/icons";
import { DeleteButton } from "../DeleteButton";
import { createContentSection, deleteContentSection, listClassroomFiles, movePage, renameUnit, setUnitClassroom } from "./actions";
import { ImportSlides } from "./ImportSlides";
import { unitCode } from "@/lib/slides";

export type PageCard = {
  key: string;
  dumpId: string | null;
  noteId: string | null;
  href: string;
  title: string;
  preview: string;
  organized: boolean;
  files: number;
  flashcards: number;
  sectionId: string | null;
  date: string;
};
type Unit = { id: string; name: string; classroomUnit: string | null };

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

// One column per unit, one card per page; drag a card to another column
// to move it. A page's organized version, files and flashcards live
// inside it (the card only shows that they exist).
export function PagesBoard({
  pursuitId,
  units,
  cards: initial,
  classroomCourseId,
}: {
  pursuitId: string;
  units: Unit[];
  cards: PageCard[];
  classroomCourseId: string | null;
}) {
  const [cards, setCards] = useState(initial);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [newUnit, setNewUnit] = useState<string | null>(null);
  const [classroomUnits, setClassroomUnits] = useState<string[] | null>(null);
  const [, startTransition] = useTransition();

  const columns: (Unit | { id: null; name: string; classroomUnit: null })[] = [
    ...units,
    { id: null, name: "No unit", classroomUnit: null },
  ];

  function drop(sectionId: string | null) {
    const card = cards.find((c) => c.key === dragging);
    setDragging(null);
    setOver(null);
    if (!card || card.sectionId === sectionId) return;
    setCards((cs) => [...cs.filter((c) => c.key !== card.key), { ...card, sectionId }]);
    startTransition(() => movePage(pursuitId, { dumpId: card.dumpId, noteId: card.noteId }, sectionId));
  }

  async function loadClassroomUnits() {
    if (!classroomCourseId || classroomUnits) return;
    const r = await listClassroomFiles(classroomCourseId);
    const codes = new Set((r.files ?? []).map((f) => unitCode(f.title)).filter((c): c is string => !!c));
    setClassroomUnits([...codes].sort((a, b) => Number(a.slice(2)) - Number(b.slice(2))));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link href={`/pursuits/${pursuitId}/dump/new`} className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white">
          + Page
        </Link>
        <ImportSlides pursuitId={pursuitId} sectionId={null} />
        {newUnit === null ? (
          <button type="button" onClick={() => setNewUnit("")} className="rounded-full bg-chip px-4 py-2 text-sm font-semibold">
            + Unit
          </button>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const name = newUnit.trim();
              setNewUnit(null);
              if (name) startTransition(() => createContentSection(pursuitId, name));
            }}
          >
            <input
              autoFocus
              value={newUnit}
              onChange={(e) => setNewUnit(e.target.value)}
              onBlur={() => !newUnit.trim() && setNewUnit(null)}
              placeholder="Unit name"
              aria-label="Unit name"
              className="rounded-full border border-border-subtle bg-white px-4 py-2 text-sm"
            />
          </form>
        )}
      </div>

      <div className="grid auto-cols-[minmax(280px,1fr)] grid-flow-col gap-4 overflow-x-auto pb-2">
        {columns.map((col) => {
          const colKey = col.id ?? "none";
          const items = cards.filter((c) => c.sectionId === col.id);
          if (col.id === null && items.length === 0 && units.length > 0) return null;
          return (
            <section
              key={colKey}
              aria-label={col.name}
              onDragOver={(e) => {
                if (!dragging) return;
                e.preventDefault();
                setOver(colKey);
              }}
              onDragLeave={() => setOver((o) => (o === colKey ? null : o))}
              onDrop={(e) => {
                e.preventDefault();
                drop(col.id);
              }}
              className={`group/col flex min-h-64 flex-col gap-2.5 rounded-3xl p-3 transition-colors ${
                over === colKey ? "bg-accent-soft ring-2 ring-tile-sky" : "bg-[#e8e6e1]"
              }`}
            >
              <header className="flex items-center gap-2 px-1.5 py-1">
                {col.id ? (
                  <UnitName pursuitId={pursuitId} id={col.id} name={col.name} />
                ) : (
                  <span className="min-w-0 flex-1 truncate text-sm font-extrabold">{col.name}</span>
                )}
                {col.id && classroomCourseId && (
                  <select
                    value={col.classroomUnit ?? ""}
                    onFocus={loadClassroomUnits}
                    onChange={(e) => startTransition(() => setUnitClassroom(pursuitId, col.id!, e.target.value || null))}
                    title="Classroom unit for this column's slides"
                    aria-label={`Classroom unit for ${col.name}`}
                    className={`rounded-full border-0 px-2 py-0.5 text-xs font-semibold ${col.classroomUnit ? "bg-tile-sky text-white" : "bg-white/70 text-ink-muted"}`}
                  >
                    <option value="">Classroom</option>
                    {(classroomUnits ?? (col.classroomUnit ? [col.classroomUnit] : [])).map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                )}
                <span className="text-xs font-semibold text-ink-muted">{items.length}</span>
                {col.id && (
                  <DeleteButton
                    action={deleteContentSection.bind(null, pursuitId, col.id)}
                    confirmMessage={`Delete the unit "${col.name}"? Its pages move to No unit.`}
                    className="rounded-full p-1 text-ink-faint opacity-0 group-hover/col:opacity-100 hover:text-red-600 focus:opacity-100"
                  >
                    <TrashIcon size={14} title={`Delete unit ${col.name}`} />
                  </DeleteButton>
                )}
              </header>

              {items.map((c) => (
                <Link
                  key={c.key}
                  href={c.href}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = "move";
                    setDragging(c.key);
                  }}
                  onDragEnd={() => {
                    setDragging(null);
                    setOver(null);
                  }}
                  onDragOver={(e) => {
                    if (!dragging) return;
                    e.preventDefault();
                    setOver(colKey);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    drop(col.id);
                  }}
                  className={`flex flex-col gap-2 rounded-2xl bg-white p-3.5 shadow-[0_1px_2px_rgba(13,13,13,0.06)] transition-all hover:-translate-y-0.5 hover:shadow-md ${
                    dragging === c.key ? "opacity-40" : ""
                  }`}
                >
                  <span className="text-sm leading-snug font-bold">{c.title}</span>
                  {c.preview && <span className="line-clamp-2 text-xs text-ink-muted">{c.preview}</span>}
                  <span className="flex flex-wrap gap-1.5">
                    {c.organized ? (
                      <span className="flex items-center gap-1 rounded-full bg-mint/15 px-2 py-0.5 text-[11px] font-semibold text-mint">
                        <CheckIcon size={11} /> Organized
                      </span>
                    ) : (
                      <span className="rounded-full bg-chip px-2 py-0.5 text-[11px] font-semibold text-ink-muted">Raw</span>
                    )}
                    {c.files > 0 && (
                      <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent">{plural(c.files, "file")}</span>
                    )}
                    {c.flashcards > 0 && (
                      <span className="rounded-full bg-chip px-2 py-0.5 text-[11px] font-semibold text-ink-muted">{plural(c.flashcards, "card")}</span>
                    )}
                    <span className="ml-auto text-[11px] text-ink-faint">{c.date}</span>
                  </span>
                </Link>
              ))}

              <Link
                href={`/pursuits/${pursuitId}/dump/new${col.id ? `?section=${col.id}` : ""}`}
                className="rounded-xl px-2 py-1.5 text-xs font-semibold text-ink-muted hover:bg-white/60 hover:text-ink"
              >
                + Page
              </Link>
            </section>
          );
        })}
      </div>
    </div>
  );
}

// Click the unit's name to rename it (Enter saves, Esc cancels).
function UnitName({ pursuitId, id, name }: { pursuitId: string; id: string; name: string }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function save() {
    const next = value.trim();
    setEditing(false);
    if (!next || next === name) return setValue(name);
    startTransition(async () => {
      const r = await renameUnit(pursuitId, id, next);
      if (r.error) {
        setError(r.error);
        setValue(name);
      } else setError(null);
    });
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") {
            setValue(name);
            setEditing(false);
          }
        }}
        aria-label="Unit name"
        className="min-w-0 flex-1 rounded-lg bg-white px-2 py-0.5 text-sm font-extrabold"
      />
    );
  }
  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      title={error ?? "Rename"}
      className={`min-w-0 flex-1 truncate rounded-lg px-1 text-left text-sm font-extrabold hover:bg-white/60 ${error ? "text-red-600" : ""}`}
    >
      {value}
    </button>
  );
}
