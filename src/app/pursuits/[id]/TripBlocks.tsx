"use client";

import { AvatarFace } from "@/app/AvatarFace";
import type { Avatar } from "@/lib/avatar";
import { useState, useTransition } from "react";
import { DEFAULT_OPTION_COLUMNS, OPTION_COLUMNS, type BlockIcon, type OptionColumn } from "@/lib/blocks";
import { addBudgetLine, addChoice, deleteBudgetLine, deleteChoice, setBudgetPeople, toggleVote, updateBudgetLine, updateChoice, type ChoiceStatus } from "./choices";

export type Person = { id: string; name: string; initial: string; color: string; avatar?: Avatar | null };
export type ChoiceItem = { id: string; title: string; url: string | null; status: ChoiceStatus; price: number | null; rating: number | null; date: string | null; note: string | null; voters: string[] };
export type BudgetLineItem = { id: string; label: string; unit: number; days: number; perPerson: boolean };

const euros = (cents: number) => `${(cents / 100).toLocaleString("es-ES", { maximumFractionDigits: 2 })} €`;
const domain = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

// Line icons for an options block (Alojamiento → bed, Vuelos → plane…).
export function BlockIconSvg({ icon, size = 16 }: { icon: BlockIcon | "budget"; size?: number }) {
  const p = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  switch (icon) {
    case "bed":
      return (
        <svg {...p}>
          <path d="M3 6v13M3 16h18v3M21 16v-4a3 3 0 0 0-3-3h-8v7" />
          <path d="M6.5 12.5a1.5 1.5 0 1 0 0-.01" />
        </svg>
      );
    case "plane":
      return (
        <svg {...p}>
          <path d="M10.5 13.5 4 11l1.4-1.4 7.5.6 4.3-4.3a1.9 1.9 0 0 1 2.7 2.7l-4.3 4.3.6 7.5L14.8 21l-2.5-6.5" />
          <path d="m7 17-2.5 2.5M6 14l-2 .5M10 18l-.5 2" />
        </svg>
      );
    case "food":
      return (
        <svg {...p}>
          <path d="M6 3v8a2 2 0 0 0 4 0V3M8 11v10M16 21V3c-2 1-3.5 4-3.5 7.5 0 2 1.5 3 3.5 3" />
        </svg>
      );
    case "pin":
      return (
        <svg {...p}>
          <path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11Z" />
          <circle cx="12" cy="10" r="2.3" />
        </svg>
      );
    case "ticket":
      return (
        <svg {...p}>
          <path d="M4 7h16v3.2a2 2 0 0 0 0 3.6V17H4v-3.2a2 2 0 0 0 0-3.6Z" />
          <path d="M14 7v10" strokeDasharray="1.6 1.8" />
        </svg>
      );
    case "car":
      return (
        <svg {...p}>
          <path d="M5 16V12l2-5h10l2 5v4M3.5 12h17v4.5h-17Z" />
          <circle cx="7.5" cy="17.5" r="1.5" />
          <circle cx="16.5" cy="17.5" r="1.5" />
        </svg>
      );
    case "star":
      return (
        <svg {...p}>
          <path d="m12 4 2.4 5 5.4.6-4 3.7 1.1 5.4L12 16l-4.9 2.7 1.1-5.4-4-3.7 5.4-.6Z" />
        </svg>
      );
    case "budget":
      return (
        <svg {...p}>
          <rect x="5" y="3" width="14" height="18" rx="2" />
          <path d="M8 7h8M8.5 11h.01M12 11h.01M15.5 11h.01M8.5 14.5h.01M12 14.5h.01M15.5 14.5h.01M8.5 18h.01M12 18h3.5" />
        </svg>
      );
    default:
      return (
        <svg {...p}>
          <path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" />
        </svg>
      );
  }
}

const ThumbIcon = ({ filled = false }: { filled?: boolean }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" aria-hidden>
    <path d="M7 10v10H4V10ZM7 10l4-7a2.5 2.5 0 0 1 2.5 3L13 9h5.6a2 2 0 0 1 2 2.4l-1.4 7a2 2 0 0 1-2 1.6H7" />
  </svg>
);
const LinkIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
    <path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1" />
  </svg>
);

// Overlapping faces, one per person: their avatar, or their initial.
export function Faces({ people, size = 22 }: { people: Person[]; size?: number }) {
  return (
    <span className="flex">
      {people.map((p, i) =>
        p.avatar ? (
          <span key={p.id} title={p.name} className="rounded-full ring-2 ring-white" style={{ marginLeft: i ? -size * 0.28 : 0 }}>
            <AvatarFace avatar={p.avatar} size={size} uid={`f${p.id}${size}`} />
          </span>
        ) : (
          <span
            key={p.id}
            title={p.name}
            className="grid place-items-center rounded-full font-semibold text-white ring-2 ring-white"
            style={{ width: size, height: size, fontSize: size * 0.48, background: p.color, marginLeft: i ? -size * 0.28 : 0 }}
          >
            {p.initial}
          </span>
        ),
      )}
    </span>
  );
}

const STATUS: Record<ChoiceStatus, { label: string; cls: string; next: ChoiceStatus }> = {
  IDEA: { label: "Idea", cls: "bg-chip text-ink-muted", next: "VOTING" },
  VOTING: { label: "En votación", cls: "bg-[#fbf0d3] text-[#a8740f]", next: "CHOSEN" },
  CHOSEN: { label: "Elegido", cls: "bg-[#e6f2ea] text-[#3f7d57]", next: "IDEA" },
};

// "Precio": shows "540 €", click to type a new one.
function PriceCell({ cents, onSave }: { cents: number | null; onSave: (cents: number | null) => void }) {
  const [editing, setEditing] = useState(false);
  if (editing)
    return (
      <input
        autoFocus
        defaultValue={cents === null ? "" : String(cents / 100)}
        inputMode="decimal"
        aria-label="Precio en euros"
        onBlur={(e) => {
          setEditing(false);
          const v = e.target.value.replace(",", ".").replace(/[^\d.]/g, "");
          onSave(v === "" ? null : Math.round(Number(v) * 100));
        }}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        className="w-20 rounded border border-border-subtle px-1.5 py-0.5 text-sm"
      />
    );
  return (
    <button type="button" onClick={() => setEditing(true)} className={`text-left text-sm tabular-nums ${cents === null ? "text-ink-faint" : ""}`}>
      {cents === null ? "+ precio" : euros(cents)}
    </button>
  );
}

// Column widths after the option's name; the last one holds ×.
const WIDTH: Record<OptionColumn, string> = { status: "110px", price: "90px", votes: "96px", rating: "92px", date: "92px", note: "minmax(0,0.8fr)" };
const LABEL = Object.fromEntries(OPTION_COLUMNS.map((c) => [c.id, c.label])) as Record<OptionColumn, string>;

// "12 nov" ↔ "2026-11-12"; typed as dd/mm or dd/mm/aaaa.
const shortDay = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("es-ES", { day: "numeric", month: "short", timeZone: "UTC" });
function parseDay(text: string): string | null | undefined {
  const t = text.trim();
  if (!t) return null;
  const m = /^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?$/.exec(t);
  if (!m) return undefined;
  const y = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : new Date().getFullYear();
  const d = new Date(Date.UTC(y, Number(m[2]) - 1, Number(m[1])));
  if (d.getUTCMonth() !== Number(m[2]) - 1) return undefined;
  return d.toISOString().slice(0, 10);
}

function DateCell({ value, onSave }: { value: string | null; onSave: (v: string | null) => void }) {
  const [editing, setEditing] = useState(false);
  if (editing)
    return (
      <input
        autoFocus
        defaultValue={value ? value.split("-").reverse().join("/") : ""}
        placeholder="dd/mm"
        aria-label="Fecha"
        onBlur={(e) => {
          const v = parseDay(e.target.value);
          setEditing(false);
          if (v !== undefined && v !== value) onSave(v);
        }}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        className="w-full rounded bg-chip px-1.5 py-0.5 outline-none"
      />
    );
  return (
    <button type="button" onClick={() => setEditing(true)} className={`text-left ${value ? "" : "text-ink-faint"}`}>
      {value ? shortDay(value) : "+ fecha"}
    </button>
  );
}

function Stars({ value, onSave }: { value: number | null; onSave: (v: number | null) => void }) {
  return (
    <span className="flex" role="radiogroup" aria-label="Valoración">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} de 5`} onClick={() => onSave(value === n ? null : n)} className={`px-px text-[15px] leading-none ${value && n <= value ? "text-ink" : "text-ink-faint/30 hover:text-ink-faint"}`}>
          ★
        </button>
      ))}
    </span>
  );
}

// An options block: each option with its link and the columns the block
// shows (state, price, votes, rating, date, note); paste a link to add one.
export function OptionsBlock({ pursuitId, blockId, items, people, me, columns = DEFAULT_OPTION_COLUMNS }: { pursuitId: string; blockId: string; items: ChoiceItem[]; people: Person[]; me: string; columns?: OptionColumn[] }) {
  const [, start] = useTransition();
  const [adding, setAdding] = useState(false);
  const byId = new Map(people.map((p) => [p.id, p]));
  const grid = { gridTemplateColumns: ["minmax(0,1fr)", ...columns.map((c) => WIDTH[c]), "20px"].join(" ") };
  const save = (id: string, data: Parameters<typeof updateChoice>[1]) => start(() => updateChoice(id, data));
  return (
    <div className="flex flex-col text-sm">
      {items.length > 0 && (
        <div className="grid items-center gap-3 pb-2 text-xs text-ink-faint" style={grid}>
          <span>Opción</span>
          {columns.map((c) =>
            c === "votes" ? (
              <span key={c} aria-label="Votos">
                <ThumbIcon />
              </span>
            ) : (
              <span key={c}>{LABEL[c]}</span>
            ),
          )}
          <span />
        </div>
      )}
      {items.map((c) => {
        const s = STATUS[c.status];
        const mine = c.voters.includes(me);
        return (
          <div key={c.id} id={`choice-${c.id}`} className="group grid scroll-mt-24 items-center gap-3 border-b border-[#f1f0ee] py-3" style={grid}>
            <span className="flex min-w-0 flex-col">
              <span className="truncate font-medium">{c.title}</span>
              {c.url && (
                <a href={c.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-ink-faint hover:text-ink">
                  <LinkIcon /> {domain(c.url)}
                </a>
              )}
            </span>
            {columns.map((col) => {
              if (col === "status")
                return (
                  <button key={col} type="button" onClick={() => save(c.id, { status: s.next })} title="Cambiar estado" className={`w-fit rounded px-1.5 py-0.5 text-xs ${s.cls}`}>
                    {s.label}
                  </button>
                );
              if (col === "price") return <PriceCell key={col} cents={c.price} onSave={(price) => save(c.id, { price })} />;
              if (col === "rating") return <Stars key={col} value={c.rating} onSave={(rating) => save(c.id, { rating })} />;
              if (col === "date") return <DateCell key={col} value={c.date} onSave={(date) => save(c.id, { date })} />;
              if (col === "note")
                return (
                  <input
                    key={col}
                    defaultValue={c.note ?? ""}
                    placeholder="+ nota"
                    aria-label="Nota"
                    onBlur={(e) => e.target.value !== (c.note ?? "") && save(c.id, { note: e.target.value })}
                    className="min-w-0 bg-transparent outline-none placeholder:text-ink-faint"
                  />
                );
              return (
                <span key={col} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => start(() => toggleVote(c.id))}
                    title={mine ? "Quitar mi voto" : "Votar"}
                    aria-pressed={mine}
                    className={`rounded p-1 ${mine ? "text-ink" : "text-ink-faint/60 hover:text-ink"}`}
                  >
                    <ThumbIcon filled={mine} />
                  </button>
                  <Faces people={c.voters.map((v) => byId.get(v)).filter((p): p is Person => !!p)} size={20} />
                </span>
              );
            })}
            <button
              type="button"
              onClick={() => window.confirm(`¿Quitar "${c.title}"?`) && start(() => deleteChoice(c.id))}
              title="Quitar"
              aria-label="Quitar opción"
              className="text-ink-faint/40 hover:text-red-600"
            >
              ×
            </button>
          </div>
        );
      })}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const input = e.currentTarget.elements.namedItem("q") as HTMLInputElement;
          const v = input.value;
          input.value = "";
          setAdding(true);
          start(async () => {
            await addChoice(pursuitId, blockId, v);
            setAdding(false);
          });
        }}
        className="pt-3"
      >
        <input
          name="q"
          placeholder={adding ? "Añadiendo…" : "+ Pega un enlace"}
          aria-label="Pega un enlace o escribe una opción"
          onPaste={(e) => {
            const text = e.clipboardData.getData("text").trim();
            if (!/^https?:\/\//.test(text)) return;
            e.preventDefault();
            setAdding(true);
            start(async () => {
              await addChoice(pursuitId, blockId, text);
              setAdding(false);
            });
          }}
          className="w-full py-1 outline-none placeholder:text-ink-faint"
        />
      </form>
    </div>
  );
}

// The budget: what's chosen in each options block, your own lines
// ("Comida · 40 € × 4 días × 4"), the total and per person.
export function BudgetBlock({
  pursuitId,
  blockId,
  chosen,
  lines,
  people,
}: {
  pursuitId: string;
  blockId: string;
  chosen: { label: string; what: string; cents: number | null }[];
  lines: BudgetLineItem[];
  people: number;
}) {
  const [, start] = useTransition();
  const lineTotal = (l: BudgetLineItem) => l.unit * l.days * (l.perPerson ? people : 1);
  const total = chosen.reduce((t, c) => t + (c.cents ?? 0), 0) + lines.reduce((t, l) => t + lineTotal(l), 0);
  const num = (v: string) => Math.round(Number(v.replace(",", ".").replace(/[^\d.]/g, "")) || 0);
  const row = "grid grid-cols-[110px_minmax(0,1fr)_auto] items-center gap-4 border-b border-[#f1f0ee] py-3";
  return (
    <div className="flex max-w-[640px] flex-col text-sm">
      {chosen.map((c) => (
        <div key={c.label} className={row}>
          <span>{c.label}</span>
          <span className={`truncate ${c.what ? "text-ink-muted" : "text-ink-faint"}`}>{c.what || "Sin elegir"}</span>
          <span className="tabular-nums">{c.cents === null ? "—" : euros(c.cents)}</span>
        </div>
      ))}
      {lines.map((l) => (
        <div key={l.id} className={`group ${row}`}>
          <input defaultValue={l.label} aria-label="Concepto" onBlur={(e) => e.target.value !== l.label && start(() => updateBudgetLine(l.id, { label: e.target.value }))} className="min-w-0 bg-transparent outline-none" />
          <span className="flex flex-wrap items-center gap-1 text-ink-muted">
            <input defaultValue={l.unit ? String(l.unit / 100) : ""} placeholder="0" inputMode="decimal" aria-label="Precio" onBlur={(e) => start(() => updateBudgetLine(l.id, { unit: num(e.target.value) * 100 }))} className="w-12 rounded bg-chip px-1 text-right" />€ ×
            <input defaultValue={String(l.days)} inputMode="numeric" aria-label="Días" onBlur={(e) => start(() => updateBudgetLine(l.id, { days: Math.max(1, num(e.target.value)) }))} className="w-8 rounded bg-chip px-1 text-right" />
            días
            <button type="button" onClick={() => start(() => updateBudgetLine(l.id, { perPerson: !l.perPerson }))} title="Por persona" className={`rounded px-1 ${l.perPerson ? "text-ink" : "text-ink-faint line-through"}`}>
              × {people}
            </button>
          </span>
          <span className="flex items-center gap-2 tabular-nums">
            {euros(lineTotal(l))}
            <button type="button" onClick={() => start(() => deleteBudgetLine(l.id))} aria-label="Quitar línea" className="text-ink-faint/40 hover:text-red-600">
              ×
            </button>
          </span>
        </div>
      ))}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const input = e.currentTarget.elements.namedItem("l") as HTMLInputElement;
          const v = input.value;
          input.value = "";
          start(() => addBudgetLine(pursuitId, blockId, v));
        }}
        className="border-b border-[#f1f0ee] py-2.5"
      >
        <input name="l" placeholder="+ Gasto (comida, transporte…)" aria-label="Nuevo gasto" className="w-full outline-none placeholder:text-ink-faint" />
      </form>
      <div className="flex items-baseline justify-between pt-4">
        <span className="text-ink-muted">Total {euros(total)}</span>
        <span>
          <b className="font-semibold">{euros(Math.round(total / Math.max(1, people)))}</b> por persona
        </span>
      </div>
    </div>
  );
}

// "4 personas", with − and + to change how many split the budget.
export function PeopleCount({ pursuitId, blockId, people }: { pursuitId: string; blockId: string; people: number }) {
  const [, start] = useTransition();
  const set = (n: number) => start(() => setBudgetPeople(pursuitId, blockId, n));
  return (
    <span className="flex items-center gap-1.5 text-sm text-ink-faint">
      <button type="button" onClick={() => people > 1 && set(people - 1)} aria-label="Una persona menos" className="rounded px-1 hover:bg-white hover:text-ink">
        −
      </button>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden>
        <circle cx="9" cy="8" r="3.2" />
        <path d="M3.5 19a5.5 5.5 0 0 1 11 0M16 5.2a3.2 3.2 0 0 1 0 6M17.5 14.2A5.5 5.5 0 0 1 20.5 19" />
      </svg>
      {people} {people === 1 ? "persona" : "personas"}
      <button type="button" onClick={() => set(people + 1)} aria-label="Una persona más" className="rounded px-1 hover:bg-white hover:text-ink">
        +
      </button>
    </span>
  );
}

// "2 votaciones te esperan": options put to the vote you haven't voted on.
export function VotesBanner({ pending }: { pending: string[] }) {
  if (pending.length === 0) return null;
  return (
    <div className="flex items-center gap-3 rounded-lg bg-callout px-4 py-3 text-sm">
      <ThumbIcon />
      <span className="flex-1">
        <b className="font-semibold">
          {pending.length} {pending.length === 1 ? "votación" : "votaciones"}
        </b>{" "}
        te {pending.length === 1 ? "espera" : "esperan"}
      </span>
      <button
        type="button"
        onClick={() => {
          const el = document.getElementById(`choice-${pending[0]}`);
          el?.scrollIntoView({ behavior: "smooth", block: "center" });
          el?.classList.add("bg-[#fbf0d3]");
          window.setTimeout(() => el?.classList.remove("bg-[#fbf0d3]"), 1600);
        }}
        className="rounded-md bg-ink px-3 py-1.5 font-medium text-white"
      >
        Votar
      </button>
    </div>
  );
}

// "Columnas": which columns an options block shows.
export function ColumnsMenu({ value, onChange }: { value: OptionColumn[]; onChange: (cols: OptionColumn[]) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} title="Columnas" aria-label="Columnas" className="grid size-7 place-items-center rounded-md bg-white text-ink-faint shadow-[0_0_0_1px_rgba(55,53,47,.09)] hover:text-ink">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
          <path d="M4 6h16M4 12h16M4 18h16M9 4v16M15 4v16" />
        </svg>
      </button>
      {open && (
        <div className="absolute top-full right-0 z-20 mt-1 w-48 rounded-lg border border-border-subtle bg-white p-1.5 text-sm font-normal shadow-[0_12px_30px_-10px_rgba(0,0,0,.25)]">
          {OPTION_COLUMNS.map((c) => {
            const on = value.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                role="checkbox"
                aria-checked={on}
                onClick={() => onChange(on ? value.filter((x) => x !== c.id) : [...value, c.id])}
                className="flex w-full items-center justify-between rounded-md px-2 py-1.5 hover:bg-chip"
              >
                {c.label}
                <span className={`grid size-4 place-items-center rounded border-[1.5px] text-[10px] text-white ${on ? "border-ink bg-ink" : "border-[#c7c5c0]"}`}>{on && "✓"}</span>
              </button>
            );
          })}
        </div>
      )}
    </span>
  );
}
