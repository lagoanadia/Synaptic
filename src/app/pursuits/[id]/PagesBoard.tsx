"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { BoltIcon, CardsIcon, CheckIcon, QuestionIcon, TrashIcon } from "@/app/icons";
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


// One column per unit, one card per page; drag a card to another column
// to move it. A page's organized version, files and flashcards live
// inside it (the card only shows that they exist).
export function PagesBoard({
  pursuitId,
  units,
  cards: initial,
  cardStats,
  classroomCourseId,
  groupLabel = "Unidad",
  view = "board",
  study = true,
  color = "#a0523f",
}: {
  pursuitId: string;
  units: Unit[];
  cards: PageCard[];
  // Flashcards per unit id ("none" = No unit).
  cardStats: Record<string, { cards: number; due: number }>;
  classroomCourseId: string | null;
  // What groups are called in this folder ("Unidad", "Tema"…).
  groupLabel?: string;
  view?: "list" | "board";
  study?: boolean;
  // The folder's colour (dots).
  color?: string;
}) {
  const label = groupLabel;
  const none = `Sin ${label.toLowerCase()}`;
  const asBoard = view === "board" && units.length > 0;
  const [cards, setCards] = useState(initial);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [newUnit, setNewUnit] = useState<string | null>(null);
  const [classroomUnits, setClassroomUnits] = useState<string[] | null>(null);
  const [, startTransition] = useTransition();

  const columns: (Unit | { id: null; name: string; classroomUnit: null })[] = [
    ...units,
    { id: null, name: none, classroomUnit: null },
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
      {!asBoard && <div className="flex flex-wrap items-center gap-2">
        <Link href={`/pursuits/${pursuitId}/dump/new`} className="rounded-md bg-ink px-3 py-1.5 text-sm font-medium text-white">
          + Página
        </Link>
        <ImportSlides pursuitId={pursuitId} sectionId={null} />
        {units.length === 0 ? null : newUnit === null ? (
          <button type="button" onClick={() => setNewUnit("")} className="rounded-md px-3 py-1.5 text-sm text-ink-muted hover:bg-chip">
            + {label}
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
              placeholder={`Nombre (${label})`}
              aria-label={`Nombre (${label})`}
              className="rounded-md border border-border-subtle bg-white px-3 py-1.5 text-sm"
            />
          </form>
        )}
      </div>}

      {!asBoard && <PagesList cards={cards} units={units} none={none} grouped={units.length > 0} onMove={(card, sectionId) => {
        setCards((cs) => cs.map((c) => (c.key === card.key ? { ...c, sectionId } : c)));
        startTransition(() => movePage(pursuitId, { dumpId: card.dumpId, noteId: card.noteId }, sectionId));
      }} />}
      {asBoard && <div className="grid auto-cols-[minmax(260px,1fr)] grid-flow-col gap-3 overflow-x-auto pb-2">
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
              className={`group/col flex min-h-56 flex-col gap-2 rounded-lg p-2.5 transition-colors ${
                over === colKey ? "bg-accent-soft ring-2 ring-accent" : "bg-sidebar"
              }`}
            >
              <header className="flex min-h-7 items-center gap-1.5 px-1 py-0.5">
                {col.id ? (
                  <UnitName pursuitId={pursuitId} id={col.id} name={col.name} />
                ) : (
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">{col.name}</span>
                )}
                {col.id && classroomCourseId && (
                  <select
                    value={col.classroomUnit ?? ""}
                    onFocus={loadClassroomUnits}
                    onChange={(e) => startTransition(() => setUnitClassroom(pursuitId, col.id!, e.target.value || null))}
                    title="Unidad de Classroom para las diapositivas de esta columna"
                    aria-label={`Unidad de Classroom para ${col.name}`}
                    className={`rounded border-0 px-1.5 py-0.5 text-[11px] ${col.classroomUnit ? "bg-[#e7f3f8] text-[#337ea9]" : "hidden bg-white text-ink-muted group-hover/col:block"}`}
                  >
                    <option value="">Classroom</option>
                    {(classroomUnits ?? (col.classroomUnit ? [col.classroomUnit] : [])).map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                )}
                {study && (
                  <UnitPlay
                    pursuitId={pursuitId}
                    unitKey={colKey}
                    organized={items.filter((c) => c.organized).length}
                    pages={items.length}
                    stats={cardStats[colKey] ?? { cards: 0, due: 0 }}
                    color={color}
                  />
                )}
                {col.id && (
                  <DeleteButton
                    action={deleteContentSection.bind(null, pursuitId, col.id)}
                    confirmMessage={`¿Eliminar "${col.name}"? Sus páginas pasan a ${none}.`}
                    className="rounded-full p-1 text-ink-faint opacity-0 group-hover/col:opacity-100 hover:text-red-600 focus:opacity-100"
                  >
                    <TrashIcon size={14} title={`Eliminar ${col.name}`} />
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
                  className={`flex flex-col gap-2 rounded-md bg-white px-3 py-2.5 shadow-[0_0_0_1px_rgba(15,15,15,.06),0_1px_2px_rgba(15,15,15,.06)] transition-shadow hover:shadow-[0_0_0_1px_rgba(15,15,15,.08),0_4px_10px_rgba(15,15,15,.08)] ${
                    dragging === c.key ? "opacity-40" : ""
                  }`}
                >
                  <span className="text-sm leading-snug font-medium">{c.title}</span>
                  <span className="flex">
                    {c.organized ? (
                      <span className="flex items-center gap-1 rounded bg-[#edf3ec] px-1.5 py-0.5 text-xs text-[#448361]">
                        <CheckIcon size={11} /> Organizada
                      </span>
                    ) : (
                      <span className="rounded bg-chip px-1.5 py-0.5 text-xs text-ink-muted">Sin organizar</span>
                    )}
                  </span>
                </Link>
              ))}

              <Link
                href={`/pursuits/${pursuitId}/dump/new${col.id ? `?section=${col.id}` : ""}`}
                className="rounded-md px-1.5 py-1 text-sm text-ink-faint hover:bg-white/70 hover:text-ink"
              >
                + Página
              </Link>
            </section>
          );
        })}
        <div className="flex min-h-56 flex-col items-center justify-center gap-2 rounded-lg border-[1.5px] border-dashed border-[#e3e2de] p-3 text-sm text-ink-faint">
          {newUnit === null ? (
            <button type="button" onClick={() => setNewUnit("")} className="rounded-md px-2 py-1 hover:bg-chip hover:text-ink">
              + {label}
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
                placeholder={`Nombre (${label})`}
                aria-label={`Nombre (${label})`}
                className="w-40 rounded-md border border-border-subtle bg-white px-2 py-1 text-sm"
              />
            </form>
          )}
          <ImportSlides pursuitId={pursuitId} sectionId={null} />
        </div>
      </div>}
    </div>
  );
}

// The same pages as rows: a link each, with its group and state. The
// group can be changed in place.
function PagesList({
  cards,
  units,
  none,
  grouped,
  onMove,
}: {
  cards: PageCard[];
  units: Unit[];
  none: string;
  grouped: boolean;
  onMove: (card: PageCard, sectionId: string | null) => void;
}) {
  if (cards.length === 0) return <p className="py-6 text-sm text-ink-faint">Aún no hay páginas.</p>;
  return (
    <ul className="flex flex-col">
      {cards.map((c) => (
        <li key={c.key} className="flex items-center gap-3 border-b border-[#f1f1ef] px-1 py-2 text-sm hover:bg-[#fbfbfa]">
          <span aria-hidden>📄</span>
          <Link href={c.href} className="min-w-0 flex-1 truncate font-medium hover:underline">
            {c.title}
          </Link>
          {grouped && (
            <select
              value={c.sectionId ?? ""}
              onChange={(e) => onMove(c, e.target.value || null)}
              aria-label="Grupo"
              className="rounded bg-[#e7f3f8] px-1.5 py-0.5 text-xs text-[#337ea9]"
            >
              <option value="">{none}</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          )}
          <span className={`hidden rounded px-1.5 py-0.5 text-xs sm:inline ${c.organized ? "bg-[#edf3ec] text-[#448361]" : "bg-chip text-ink-muted"}`}>
            {c.organized ? "✓ Organizada" : "Sin organizar"}
          </span>
          <span className="w-14 text-right text-xs text-ink-faint">{c.date}</span>
        </li>
      ))}
    </ul>
  );
}

// A unit's study row: how much of it is organized, and its flashcards as
// Learn / Flashcards / Match, scoped to just this unit.
function UnitPlay({
  pursuitId,
  unitKey,
  organized,
  pages,
  stats,
  color,
}: {
  color: string;
  pursuitId: string;
  unitKey: string;
  organized: number;
  pages: number;
  stats: { cards: number; due: number };
}) {
  const href = (mode: string) => `/review?mode=${mode}&pursuit=${pursuitId}&unit=${unitKey}`;
  const games = [
    { mode: "learn", label: "Aprender", icon: QuestionIcon, enabled: stats.cards > 0 },
    { mode: "flash", label: "Tarjetas", icon: CardsIcon, enabled: stats.cards > 0, due: stats.due > 0 },
    { mode: "match", label: "Unir", icon: BoltIcon, enabled: stats.cards >= 3 },
  ];
  // How organized the unit is, as three dots (no numbers); the study
  // icons only show when you hover the column.
  const filled = pages ? Math.round((organized / pages) * 3) : 0;
  return (
    <span className="flex items-center gap-0.5">
      <span className="hidden items-center group-hover/col:flex">
        {games.map((g) =>
          g.enabled ? (
            <Link key={g.mode} href={href(g.mode)} title={g.label} aria-label={g.label} className="relative rounded p-1 text-ink-muted hover:bg-white hover:text-ink">
              <g.icon size={14} className="block" />
              {g.due && <span className="absolute top-0.5 right-0.5 size-1.5 rounded-full bg-accent" />}
            </Link>
          ) : null,
        )}
      </span>
      {pages > 0 && (
        <span className="ml-1 flex gap-[3px]" title={`${organized} de ${pages} páginas organizadas`} aria-label="Organizada">
          {[0, 1, 2].map((i) => (
            <span key={i} className="size-[7px] rounded-full border-[1.5px]" style={{ borderColor: color, background: i < filled ? color : undefined }} />
          ))}
        </span>
      )}
    </span>
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
        aria-label="Nombre de la unidad"
        className="min-w-0 flex-1 rounded-lg bg-white px-2 py-0.5 text-sm font-extrabold"
      />
    );
  }
  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      title={error ?? "Renombrar"}
      className={`min-w-0 flex-1 truncate rounded-lg px-1 text-left text-sm font-extrabold hover:bg-white/60 ${error ? "text-red-600" : ""}`}
    >
      {value}
    </button>
  );
}
