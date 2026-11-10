"use client";

import { useT } from "@/app/LangProvider";
import { useState, useTransition } from "react";
import { Faces, type Person } from "./TripBlocks";
import { addDateOption, addExpense, addSaving, deleteDateOption, deleteExpense, deleteSaving, setSavingsGoal, toggleDate } from "./sharedBlocks";
import type { Debt } from "@/lib/shared";

const euros = (cents: number) => `${(cents / 100).toLocaleString("es-ES", { maximumFractionDigits: 2 })} €`;
const toCents = (v: string) => Math.round((Number(v.replace(",", ".").replace(/[^\d.]/g, "")) || 0) * 100);
const dayLabel = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const X = ({ onClick, label }: { onClick: () => void; label: string }) => {
  const t = useT();
  return ((
  <button type="button" onClick={onClick} aria-label={label} title={t("Quitar")} className="text-ink-faint/40 hover:text-red-600">
    ×
  </button>
));
};

export type ExpenseItem = { id: string; label: string; amount: number; paidById: string };

// Gastos: who paid what, and the fewest payments that even it out.
export function ExpensesBlock({ pursuitId, blockId, items, people, me, debts }: { pursuitId: string; blockId: string; items: ExpenseItem[]; people: Person[]; me: string; debts: Debt[] }) {
  const t = useT();
  const [, start] = useTransition();
  const [payer, setPayer] = useState(me);
  const byId = new Map(people.map((p) => [p.id, p]));
  const face = (id: string) => <Faces people={byId.get(id) ? [byId.get(id)!] : []} size={22} />;
  return (
    <div className="flex flex-col gap-4 text-sm">
      <div className="flex flex-col">
        {items.map((e) => (
          <div key={e.id} className="grid grid-cols-[22px_minmax(0,1fr)_auto_20px] items-center gap-3 border-b border-[#f1f0ee] py-2.5">
            {face(e.paidById)}
            <span className="truncate">
              {t(e.label)} <span className="text-ink-faint">{t("· pagó")}{" "}{byId.get(e.paidById)?.name ?? "alguien"}</span>
            </span>
            <span className="tabular-nums">{euros(e.amount)}</span>
            <X label={t("Quitar gasto")} onClick={() => start(() => deleteExpense(e.id))} />
          </div>
        ))}
        <form
          onSubmit={(ev) => {
            ev.preventDefault();
            const f = ev.currentTarget;
            const label = (f.elements.namedItem("l") as HTMLInputElement).value;
            const amount = toCents((f.elements.namedItem("a") as HTMLInputElement).value);
            if (!label.trim() || !amount) return;
            f.reset();
            start(() => addExpense(pursuitId, blockId, label, amount, payer));
          }}
          className="flex flex-wrap items-center gap-2 pt-3"
        >
          <input name="l" placeholder={t("+ Gasto (cena, gasolina…)")} aria-label={t("Gasto")} className="min-w-40 flex-1 outline-none placeholder:text-ink-faint" />
          <input name="a" inputMode="decimal" placeholder="0 €" aria-label={t("Importe")} className="w-20 rounded bg-chip px-2 py-1 text-right" />
          {people.length > 1 && (
            <select value={payer} onChange={(e) => setPayer(e.target.value)} aria-label={t("Quién pagó")} className="rounded bg-chip px-2 py-1 text-ink-muted">
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {t("pagó")}{" "}{p.id === me ? "yo" : p.name}
                </option>
              ))}
            </select>
          )}
          <button type="submit" className="rounded-md bg-ink px-3 py-1 text-xs font-medium text-white">
            {t("Añadir")}
          </button>
        </form>
      </div>
      {items.length > 0 && (
        <div className="flex flex-col gap-2 rounded-lg bg-callout p-3">
          {debts.length === 0 ? (
            <span className="text-ink-muted">{t("Estáis en paz.")}</span>
          ) : (
            debts.map((d) => (
              <span key={`${d.from}${d.to}`} className="flex items-center gap-2">
                {face(d.from)}
                <span className="text-ink-faint">→</span>
                {face(d.to)}
                <span>
                  {byId.get(d.from)?.id === me ? t("Tú") : byId.get(d.from)?.name} {byId.get(d.from)?.id === me ? "debes" : "debe"} <b className="font-semibold">{euros(d.cents)}</b> a {byId.get(d.to)?.id === me ? "ti" : byId.get(d.to)?.name}
                </span>
              </span>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export type DateItem = { id: string; day: string; voters: string[] };

// Fechas: days as columns, people as rows; tick the ones you can make.
export function DatesBlock({ pursuitId, blockId, items, people, me, best }: { pursuitId: string; blockId: string; items: DateItem[]; people: Person[]; me: string; best: string | null }) {
  const t = useT();
  const [, start] = useTransition();
  const [adding, setAdding] = useState(false);
  return (
    <div className="flex flex-col gap-3 text-sm">
      {items.length > 0 && (
        <div className="overflow-x-auto">
          <table className="border-separate border-spacing-y-1">
            <thead>
              <tr>
                <th />
                {items.map((d) => (
                  <th key={d.id} className={`px-2 pb-1 text-xs font-medium whitespace-nowrap ${d.day === best ? "text-ink" : "text-ink-faint"}`}>
                    <span className="flex items-center justify-center gap-1">
                      {d.day === best && <span aria-label={t("Mejor día")}>★</span>}
                      {dayLabel(d.day)}
                      <button type="button" onClick={() => start(() => deleteDateOption(d.id))} aria-label={t("Quitar día")} className="text-ink-faint/40 hover:text-red-600">
                        ×
                      </button>
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {people.map((p) => (
                <tr key={p.id}>
                  <td className="pr-4">
                    <span className="flex items-center gap-2 whitespace-nowrap">
                      <Faces people={[p]} size={22} />
                      {p.id === me ? t("Tú") : p.name}
                    </span>
                  </td>
                  {items.map((d) => {
                    const yes = d.voters.includes(p.id);
                    const mine = p.id === me;
                    return (
                      <td key={d.id} className="px-2 text-center">
                        <button
                          type="button"
                          disabled={!mine}
                          onClick={() => start(() => toggleDate(d.id))}
                          aria-pressed={yes}
                          aria-label={`${p.name}: ${dayLabel(d.day)}`}
                          className={`grid size-8 place-items-center rounded-md ${yes ? "bg-[#e6f2ea] text-[#3f7d57]" : "bg-chip text-transparent"} ${mine ? "hover:ring-1 hover:ring-ink-faint" : "cursor-default"} ${d.day === best && yes ? "ring-1 ring-[#3f7d57]" : ""}`}
                        >
                          ✓
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {adding ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const v = (e.currentTarget.elements.namedItem("d") as HTMLInputElement).value.trim();
            const m = /^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?$/.exec(v);
            if (!m) return;
            const y = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : new Date().getFullYear();
            const d = new Date(Date.UTC(y, Number(m[2]) - 1, Number(m[1])));
            if (d.getUTCMonth() !== Number(m[2]) - 1) return;
            e.currentTarget.reset();
            start(() => addDateOption(pursuitId, blockId, d.toISOString().slice(0, 10)));
          }}
          className="flex items-center gap-2"
        >
          <input autoFocus name="d" placeholder={t("dd/mm")} aria-label={t("Día")} onBlur={(e) => !e.target.value && setAdding(false)} className="w-24 rounded bg-chip px-2 py-1" />
          <button type="submit" className="rounded-md bg-ink px-3 py-1 text-xs font-medium text-white">
            {t("Añadir")}
          </button>
        </form>
      ) : (
        <button type="button" onClick={() => setAdding(true)} className="self-start text-ink-faint hover:text-ink">
          {t("+ Proponer un día")}
        </button>
      )}
    </div>
  );
}

export type SavingItem = { id: string; amount: number; userId: string; createdAt: string };

// Meta de ahorro: the goal, a progress bar and each contribution.
export function SavingsBlock({ pursuitId, blockId, goal, items, people }: { pursuitId: string; blockId: string; goal: number | null; items: SavingItem[]; people: Person[] }) {
  const t = useT();
  const [, start] = useTransition();
  const byId = new Map(people.map((p) => [p.id, p]));
  const saved = items.reduce((t, s) => t + s.amount, 0);
  const pct = goal ? Math.min(100, (saved / goal) * 100) : 0;
  return (
    <div className="flex max-w-[640px] flex-col gap-4 text-sm">
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-2xl font-semibold tabular-nums">{euros(saved)}</span>
          <span className="flex items-center gap-1 text-ink-faint">
            {t("de")}
            <input
              key={goal ?? 0}
              defaultValue={goal ? String(goal / 100) : ""}
              placeholder={t("meta")}
              inputMode="decimal"
              aria-label={t("Meta")}
              onBlur={(e) => {
                const v = toCents(e.target.value);
                if ((v || null) !== goal) start(() => setSavingsGoal(pursuitId, blockId, v || null));
              }}
              className="w-20 rounded bg-chip px-2 py-0.5 text-right text-ink"
            />
            €
          </span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-[#ededeb]" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-[#448361] transition-[width]" style={{ width: `${pct}%` }} />
        </div>
        {goal ? <span className="text-xs text-ink-faint">{saved >= goal ? t("¡Meta conseguida!") : t("Faltan {0} · {1} %", { 0: euros(goal - saved), 1: Math.round(pct) })}</span> : <span className="text-xs text-ink-faint">{t("Pon una meta para ver cuánto falta.")}</span>}
      </div>
      <div className="flex flex-col">
        {items.map((s) => (
          <div key={s.id} className="grid grid-cols-[22px_minmax(0,1fr)_auto_20px] items-center gap-3 border-b border-[#f1f0ee] py-2">
            <Faces people={byId.get(s.userId) ? [byId.get(s.userId)!] : []} size={22} />
            <span className="text-ink-faint">{new Date(s.createdAt).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}</span>
            <span className="tabular-nums">+{euros(s.amount)}</span>
            <X label={t("Quitar aportación")} onClick={() => start(() => deleteSaving(s.id))} />
          </div>
        ))}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const input = e.currentTarget.elements.namedItem("a") as HTMLInputElement;
            const v = toCents(input.value);
            if (!v) return;
            input.value = "";
            start(() => addSaving(pursuitId, blockId, v));
          }}
          className="flex items-center gap-2 pt-3"
        >
          <input name="a" inputMode="decimal" placeholder={t("+ Añadir lo ahorrado (€)")} aria-label={t("Cantidad ahorrada")} className="flex-1 outline-none placeholder:text-ink-faint" />
        </form>
      </div>
    </div>
  );
}
