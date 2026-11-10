"use client";

import { useT } from "@/app/LangProvider";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { createContentSection, deleteContentSection, listClassroomFiles, movePage, renamePage, renameUnit, setUnitClassroom } from "./actions";
import { useRouter } from "next/navigation";
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
}) {
  const t = useT();
  const label = t(groupLabel);
  const none = t("Sin {0}", { 0: label.toLowerCase() });
  const asBoard = view === "board" && units.length > 0;
  const [cards, setCards] = useState(initial);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [newUnit, setNewUnit] = useState<string | null>(null);
  const [classroomUnits, setClassroomUnits] = useState<string[] | null>(null);
  const [renaming, setRenaming] = useState<{ card: PageCard; x: number; y: number } | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();

  const renameDone = useRef(false);
  function rename(card: PageCard, title: string) {
    setRenaming(null);
    if (renameDone.current) return;
    renameDone.current = true;
    const trimmed = title.trim();
    if (!trimmed || trimmed === card.title) return;
    setCards((cs) => cs.map((c) => (c.key === card.key ? { ...c, title: trimmed } : c)));
    startTransition(async () => {
      await renamePage(pursuitId, { dumpId: card.dumpId, noteId: card.noteId }, trimmed);
      router.refresh();
    });
  }

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
      {renaming && (
        <div className="fixed inset-0 z-50" onMouseDown={(e) => e.target === e.currentTarget && setRenaming(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              rename(renaming.card, new FormData(e.currentTarget).get("title") as string);
            }}
            className="absolute w-72 rounded-lg bg-white p-2 shadow-[0_0_0_1px_rgba(15,15,15,.05),0_10px_26px_rgba(15,15,15,.16)]"
            style={{ left: renaming.x, top: renaming.y }}
          >
            <input
              name="title"
              autoFocus
              defaultValue={renaming.card.title}
              onFocus={(e) => e.currentTarget.select()}
              onKeyDown={(e) => e.key === "Escape" && setRenaming(null)}
              onBlur={(e) => rename(renaming.card, e.currentTarget.value)}
              aria-label={t("Título de la página")}
              className="w-full rounded-md border border-border-subtle px-2 py-1.5 text-sm outline-none focus:border-ink/30"
            />
          </form>
        </div>
      )}
      {!asBoard && <div className="flex flex-wrap items-center gap-2">
        <Link href={`/pursuits/${pursuitId}/dump/new`} className="rounded-md bg-ink px-3 py-1.5 text-sm font-medium text-white">
          {t("+ Página")}
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
              placeholder={t("Nombre ({0})", { 0: label })}
              aria-label={t("Nombre ({0})", { 0: label })}
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
                <ColumnMenu
                  name={col.name}
                  reviewHref={study && (cardStats[colKey]?.cards ?? 0) > 0 ? `/review?pursuit=${pursuitId}&unit=${colKey}` : null}
                  classroom={
                    col.id && classroomCourseId
                      ? {
                          value: col.classroomUnit ?? "",
                          options: classroomUnits ?? (col.classroomUnit ? [col.classroomUnit] : []),
                          load: loadClassroomUnits,
                          set: (v) => startTransition(() => setUnitClassroom(pursuitId, col.id!, v || null)),
                        }
                      : null
                  }
                  onDelete={col.id ? () => window.confirm(t("¿Eliminar \"{0}\"? Sus páginas pasan a {1}.", { 0: col.name, 1: none })) && startTransition(() => deleteContentSection(pursuitId, col.id!)) : null}
                />
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
                  onContextMenu={(e) => {
                    e.preventDefault();
                    renameDone.current = false;
                    setRenaming({ card: c, x: Math.min(e.clientX, window.innerWidth - 300), y: Math.min(e.clientY, window.innerHeight - 80) });
                  }}
                  className={`flex flex-col gap-2 rounded-md bg-white px-3 py-2.5 shadow-[0_0_0_1px_rgba(15,15,15,.06),0_1px_2px_rgba(15,15,15,.06)] transition-shadow hover:shadow-[0_0_0_1px_rgba(15,15,15,.08),0_4px_10px_rgba(15,15,15,.08)] ${
                    dragging === c.key ? "opacity-40" : ""
                  }`}
                >
                  <span className="flex items-start gap-2">
                    <span className="min-w-0 flex-1 text-sm leading-snug font-medium">{c.title}</span>
                    {c.organized && <Sparkles />}
                  </span>
                </Link>
              ))}

              <Link
                href={`/pursuits/${pursuitId}/dump/new${col.id ? `?section=${col.id}` : ""}`}
                className="rounded-md px-1.5 py-1 text-sm text-ink-faint hover:bg-white/70 hover:text-ink"
              >
                {t("+ Página")}
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
                placeholder={t("Nombre ({0})", { 0: label })}
                aria-label={t("Nombre ({0})", { 0: label })}
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
  const t = useT();
  if (cards.length === 0) return <p className="py-6 text-sm text-ink-faint">{t("Aún no hay páginas.")}</p>;
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
              aria-label={t("Grupo")}
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
          <span className="w-4">{c.organized && <Sparkles />}</span>
          <span className="w-14 text-right text-xs text-ink-faint">{c.date}</span>
        </li>
      ))}
    </ul>
  );
}

// Click the unit's name to rename it (Enter saves, Esc cancels).
function UnitName({ pursuitId, id, name }: { pursuitId: string; id: string; name: string }) {
  const t = useT();
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
        aria-label={t("Nombre de la unidad")}
        className="min-w-0 flex-1 rounded-lg bg-white px-2 py-0.5 text-sm font-extrabold"
      />
    );
  }
  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      title={error ?? t("Renombrar")}
      className={`min-w-0 flex-1 truncate rounded-lg px-1 text-left text-sm font-extrabold hover:bg-white/60 ${error ? "text-red-600" : ""}`}
    >
      {value}
    </button>
  );
}

// Organized pages get these little stars; the rest, nothing.
function Sparkles() {
  const t = useT();
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" className="mt-0.5 shrink-0 text-[#c99a2e]" role="img" aria-label={t("Organizada")}>
      <title>{t("Organizada")}</title>
      <path d="M10 3.5 11.8 8l4.7 1.8-4.7 1.8L10 16l-1.8-4.4L3.5 9.8 8.2 8z" />
      <path d="M17.5 14l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z" />
    </svg>
  );
}

// A column's ⋯: review this unit, its Classroom unit (for the slides
// picker), delete. Nothing else in the header.
function ColumnMenu({
  name,
  reviewHref,
  classroom,
  onDelete,
}: {
  name: string;
  reviewHref: string | null;
  classroom: { value: string; options: string[]; load: () => void; set: (v: string) => void } | null;
  onDelete: (() => void) | null;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  if (!reviewHref && !classroom && !onDelete) return null;
  return (
    <span className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-label={t("Opciones de {0}", { 0: name })} title={t("Opciones")} className="rounded px-1.5 text-ink-faint hover:bg-white hover:text-ink">
        ⋯
      </button>
      {open && (
        <>
          <button type="button" aria-label={t("Cerrar")} className="fixed inset-0 z-10 cursor-default" onClick={() => setOpen(false)} />
          <div className="absolute top-full right-0 z-20 mt-1 flex w-56 flex-col rounded-lg bg-white p-1 text-sm shadow-[0_0_0_1px_rgba(15,15,15,.05),0_10px_26px_rgba(15,15,15,.16)]">
            {reviewHref && (
              <Link href={reviewHref} className="rounded-md px-2.5 py-1.5 hover:bg-chip">
                {t("▶ Repasar esta unidad")}
              </Link>
            )}
            {classroom && (
              <label className="flex items-center justify-between gap-2 rounded-md px-2.5 py-1.5 hover:bg-chip">
                <span>{t("Diapositivas de")}</span>
                <select value={classroom.value} onFocus={classroom.load} onChange={(e) => classroom.set(e.target.value)} className="rounded bg-chip px-1.5 py-0.5 text-xs">
                  <option value="">{t("Classroom…")}</option>
                  {classroom.options.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {onDelete && (
              <button type="button" onClick={() => { setOpen(false); onDelete(); }} className="rounded-md px-2.5 py-1.5 text-left text-red-600 hover:bg-chip">
                {t("Eliminar")}
              </button>
            )}
          </div>
        </>
      )}
    </span>
  );
}
