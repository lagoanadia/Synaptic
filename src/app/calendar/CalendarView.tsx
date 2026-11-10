"use client";

import { useT } from "@/app/LangProvider";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, CheckIcon, TrashIcon } from "@/app/icons";
import { WEEKDAYS, fromKey, sortItems, type CalItem, type CalKind } from "@/lib/calendar";
import { Pill } from "./Pill";
import { GoogleModal, GoogleLogo } from "./GoogleModal";
import { addEvent, removeEvent, toggleEventDone, type NewEvent } from "./actions";

type Folder = { id: string; title: string; color: string; units: { id: string; name: string }[] };
type Pop = { kind: "add"; day: string; x: number; y: number } | { kind: "item"; item: CalItem; x: number; y: number };

const KIND_FILTERS: { kind: CalKind; label: string }[] = [
  { kind: "exam", label: "◆ Exámenes" },
  { kind: "due", label: "● Entregas" },
  { kind: "task", label: "☐ Tareas" },
];

const shortDay = (key: string) => fromKey(key).toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

export function CalendarView({
  title,
  view,
  nav,
  switchTo,
  rows,
  month,
  today,
  items,
  google,
  justConnected,
  folders,
}: {
  title: string;
  view: "month" | "week";
  nav: { prev: string; next: string; today: string };
  switchTo: string;
  rows: string[][];
  month: string;
  today: string;
  items: CalItem[];
  google: "off" | "on" | "error";
  justConnected: string | null;
  folders: Folder[];
}) {
  const t = useT();
  const [hiddenFolders, setHiddenFolders] = useState<Set<string>>(new Set());
  const [hiddenKinds, setHiddenKinds] = useState<Set<CalKind>>(new Set());
  const [pop, setPop] = useState<Pop | null>(null);
  const [selected, setSelected] = useState(today);
  const [modal, setModal] = useState(justConnected === "connected" || justConnected === "failed");

  const shown = items.filter((i) => !hiddenKinds.has(i.kind) && !(i.folderId && hiddenFolders.has(i.folderId)) && !(i.calendarId && hiddenFolders.has(`g:${i.calendarId}`)));
  // Each Google calendar you bring in, with its own colour.
  const calendars = [...new Map(items.filter((i) => i.calendarId).map((i) => [i.calendarId!, { id: i.calendarId!, name: i.calendarName ?? "Google", color: i.color }])).values()];
  const onDay = (d: string) => sortItems(shown.filter((i) => i.day === d));
  const present = folders.filter((f) => items.some((i) => i.folderId === f.id));

  function toggle<T>(set: Set<T>, v: T, apply: (s: Set<T>) => void) {
    const next = new Set(set);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    apply(next);
  }

  function anchor(e: React.MouseEvent<HTMLElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: Math.max(12, Math.min(r.left, window.innerWidth - 312)), y: Math.min(r.bottom + 6, window.innerHeight - 330) };
  }

  const chip = (on: boolean) => `flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ${on ? "bg-chip text-ink-muted" : "bg-chip/40 text-ink-faint line-through"}`;

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-5 px-4 py-8 sm:px-10 lg:py-10">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-[2rem] leading-tight font-bold tracking-tight sm:text-[2.4rem]">{title}</h1>
        <span className="flex items-center text-sm text-ink-muted">
          <Link href={nav.prev} aria-label={t("Anterior")} className="rounded px-1.5 py-1 hover:bg-chip">
            ‹
          </Link>
          <Link href={nav.today} className="rounded px-1.5 py-1 hover:bg-chip">
            {t("Hoy")}
          </Link>
          <Link href={nav.next} aria-label={t("Siguiente")} className="rounded px-1.5 py-1 hover:bg-chip">
            ›
          </Link>
        </span>
        <span className="ml-auto flex items-center gap-2">
          <span className="flex rounded-lg bg-chip p-0.5 text-sm">
            {(["week", "month"] as const).map((v) => (
              <Link key={v} href={v === view ? "#" : switchTo} aria-current={v === view ? "page" : undefined} className={`rounded-md px-3 py-1 ${v === view ? "bg-white shadow-sm" : "text-ink-muted"}`}>
                {v === "week" ? t("Semana") : t("Mes")}
              </Link>
            ))}
          </span>
          <button type="button" onClick={() => setModal(true)} className="flex items-center gap-1.5 rounded-lg border border-border-subtle px-2.5 py-1.5 text-sm text-ink-muted hover:bg-chip">
            <GoogleLogo size={16} />
            <span className="hidden sm:inline">{google === "on" ? t("Sincronizado") : google === "error" ? t("Reconectar") : t("Google Calendar")}</span>
          </button>
        </span>
      </header>

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {present.map((f) => (
          <button key={f.id} type="button" onClick={() => toggle(hiddenFolders, f.id, setHiddenFolders)} className={chip(!hiddenFolders.has(f.id))}>
            <i className="size-2 rounded-full" style={{ background: f.color }} />
            {f.title}
          </button>
        ))}
        {calendars.map((c) => (
          <button key={c.id} type="button" onClick={() => toggle(hiddenFolders, `g:${c.id}`, setHiddenFolders)} className={chip(!hiddenFolders.has(`g:${c.id}`))}>
            <i className="size-2 rounded-full" style={{ background: c.color }} />
            {c.name}
          </button>
        ))}
        {present.length + calendars.length > 0 && <span className="mx-1 w-px shrink-0 bg-border-subtle" />}
        {KIND_FILTERS.map((k) => (
          <button key={k.kind} type="button" onClick={() => toggle(hiddenKinds, k.kind, setHiddenKinds)} className={chip(!hiddenKinds.has(k.kind))}>
            {t(k.label)}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border border-border-subtle">
        <div className="grid grid-cols-7 border-b border-border-subtle text-xs text-ink-faint">
          {WEEKDAYS.map((d) => (
            <span key={d} className="px-2 py-1.5">
              {t(d)}
            </span>
          ))}
        </div>
        {rows.map((week) => (
          <div key={week[0]} className="grid grid-cols-7 border-b border-border-subtle last:border-b-0">
            {week.map((d) => {
              const list = onDay(d);
              const out = view === "month" && d.slice(0, 7) !== month;
              const isToday = d === today;
              return (
                <div
                  key={d}
                  onClick={(e) => {
                    if (window.innerWidth < 640) return setSelected(d);
                    setPop({ kind: "add", day: d, ...anchor(e) });
                  }}
                  className={`group relative flex cursor-pointer flex-col gap-1 border-r border-border-subtle p-1 last:border-r-0 sm:p-1.5 ${view === "week" ? "min-h-[60vh]" : "min-h-16 sm:min-h-[112px]"} ${selected === d ? "max-sm:bg-chip/60" : ""} hover:bg-[#fbfbfa]`}
                >
                  <span className="flex items-center justify-between">
                    <span
                      className={`grid size-6 place-items-center rounded-full text-xs ${isToday ? "bg-[#e5484d] font-semibold text-white" : out ? "text-[#c7c5c0]" : "text-ink-muted"}`}
                    >
                      {fromKey(d).getUTCDate()}
                    </span>
                    {isToday && (
                      <Link href="/review" onClick={(e) => e.stopPropagation()} title={t("Repaso de hoy")} className="hidden size-5 place-items-center rounded bg-accent-soft text-[11px] text-accent sm:grid">
                        ▤
                      </Link>
                    )}
                  </span>
                  <span className="hidden flex-col gap-1 sm:flex">
                    {list.slice(0, view === "week" ? 20 : 4).map((x) => (
                      <Pill
                        key={x.id}
                        item={x}
                        onClick={(e) => {
                          e.stopPropagation();
                          setPop({ kind: "item", item: x, ...anchor(e) });
                        }}
                      />
                    ))}
                    {view === "month" && list.length > 4 && <span className="px-1 text-[11px] text-ink-faint">+{list.length - 4}</span>}
                  </span>
                  <span className="flex flex-wrap justify-center gap-0.5 sm:hidden">
                    {list.map((x) => (
                      <i key={x.id} className="size-1.5 rounded-full" style={{ background: x.color }} />
                    ))}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Phones: the chosen day's events under the grid. */}
      <section className="flex flex-col gap-2 sm:hidden">
        <span className="flex items-center justify-between text-sm">
          <span className="text-ink-faint">{shortDay(selected)}</span>
          <button type="button" onClick={(e) => setPop({ kind: "add", day: selected, ...anchor(e) })} aria-label={t("Añadir")} className="grid size-7 place-items-center rounded-full bg-chip text-ink-muted">
            +
          </button>
        </span>
        {onDay(selected).map((x) => (
          <Pill key={x.id} item={x} onClick={(e) => setPop({ kind: "item", item: x, ...anchor(e) })} />
        ))}
      </section>

      {pop && (
        <>
          <button type="button" aria-label={t("Cerrar")} className="fixed inset-0 z-40 cursor-default" onClick={() => setPop(null)} />
          <div className="fixed z-50 w-[300px] rounded-xl bg-white p-4 text-sm shadow-[0_0_0_1px_rgba(15,15,15,.05),0_14px_36px_rgba(15,15,15,.18)]" style={{ left: pop.x, top: pop.y }}>
            {pop.kind === "add" ? <AddForm day={pop.day} folders={folders} onDone={() => setPop(null)} /> : <Detail item={pop.item} onDone={() => setPop(null)} />}
          </div>
        </>
      )}
      {modal && <GoogleModal status={google} justConnected={justConnected} onClose={() => setModal(false)} />}
    </div>
  );
}

function AddForm({ day, folders, onDone }: { day: string; folders: Folder[]; onDone: () => void }) {
  const t = useT();
  const router = useRouter();
  const [form, setForm] = useState<NewEvent>({ title: "", kind: "exam", day, time: "", pursuitId: folders[0]?.id ?? null, unitId: null });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const units = folders.find((f) => f.id === form.pursuitId)?.units ?? [];
  const kinds: { kind: NewEvent["kind"]; label: string }[] = [
    { kind: "exam", label: "◆ Examen" },
    { kind: "task", label: "☐ Tarea" },
    { kind: "event", label: "● Otro" },
  ];
  const field = "w-full rounded-md border border-border-subtle bg-white px-2 py-1.5 text-sm";
  return (
    <form
      className="flex flex-col gap-2.5"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await addEvent(form);
          if (r.error) return setError(r.error);
          onDone();
          router.refresh();
        });
      }}
    >
      <span className="text-xs text-ink-faint">{shortDay(day)}</span>
      <input autoFocus value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder={t("Examen UD1, entregar memoria…")} aria-label={t("Qué")} className={field} />
      <span className="flex rounded-md bg-chip p-0.5 text-xs">
        {kinds.map((k) => (
          <button key={k.kind} type="button" onClick={() => setForm({ ...form, kind: k.kind })} className={`flex-1 rounded px-2 py-1 ${form.kind === k.kind ? "bg-white shadow-sm" : "text-ink-muted"}`}>
            {t(k.label)}
          </button>
        ))}
      </span>
      <span className="flex gap-2">
        <select value={form.pursuitId ?? ""} onChange={(e) => setForm({ ...form, pursuitId: e.target.value || null, unitId: null })} aria-label={t("Carpeta")} className={field}>
          <option value="">{t("Sin carpeta")}</option>
          {folders.map((f) => (
            <option key={f.id} value={f.id}>
              {f.title}
            </option>
          ))}
        </select>
        <input type="time" value={form.time ?? ""} onChange={(e) => setForm({ ...form, time: e.target.value })} aria-label={t("Hora (opcional)")} className={`${field} w-24 shrink-0`} />
      </span>
      {form.kind === "exam" && units.length > 0 && (
        <select value={form.unitId ?? ""} onChange={(e) => setForm({ ...form, unitId: e.target.value || null })} aria-label={t("Qué entra")} className={field}>
          <option value="">{t("Qué entra…")}</option>
          {units.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      )}
      {error && <span className="text-xs text-red-500">{error}</span>}
      <button type="submit" disabled={pending || !form.title.trim()} className="self-end rounded-md bg-ink px-3 py-1.5 text-sm text-white disabled:opacity-40">
        {t("Añadir")}
      </button>
    </form>
  );
}

function Detail({ item, onDone }: { item: CalItem; onDone: () => void }) {
  const t = useT();
  const router = useRouter();
  const [, start] = useTransition();
  const known = item.dots?.filter((d) => d === "known").length ?? 0;
  const act = (fn: () => Promise<unknown>) =>
    start(async () => {
      await fn();
      onDone();
      router.refresh();
    });
  const mark = item.kind === "exam" ? "◆ " : item.kind === "due" ? "● " : item.kind === "task" ? "☐ " : "";
  return (
    <div className="flex flex-col gap-2.5">
      <span className="text-xs text-ink-faint">
        {shortDay(item.day)}
        {item.time && ` · ${item.time}`}
      </span>
      <b className="text-[15px] leading-snug">
        {mark}
        {item.title}
        {item.folder && <span className="font-normal text-ink-muted"> · {item.folder}</span>}
      </b>
      {item.kind === "due" && <span className="text-xs text-ink-faint">{t("Entrega")}</span>}
      {item.dots && item.dots.length > 0 && (
        <>
          <span className="flex items-center justify-between text-ink-muted">
            {t("Lo que entra")}{item.unit && ` · ${item.unit}`}
            <span className="flex gap-1" aria-label={t("{0} de {1} sabidos", { 0: known, 1: item.dots.length })}>
              {item.dots.slice(0, 12).map((d, i) => (
                <i key={i} className="size-2 rounded-full border-[1.5px]" style={{ borderColor: item.color, background: d === "known" ? item.color : "transparent", opacity: d === "fading" ? 0.4 : 1 }} />
              ))}
            </span>
          </span>
          <span className="text-xs text-ink-faint">{t("Repásalo estos días desde aquí.")}</span>
        </>
      )}
      <span className="flex items-center gap-2 pt-1">
        {item.kind === "exam" && item.folderId && (
          <Link
            href={`/review?pursuit=${item.folderId}${item.unitId ? `&unit=${item.unitId}` : ""}`}
            title={t("Repasar lo que entra")}
            aria-label={t("Repasar lo que entra")}
            className="grid size-10 place-items-center rounded-full bg-accent text-white"
          >
            ▤
          </Link>
        )}
        {item.kind === "task" && (
          <button type="button" onClick={() => act(() => toggleEventDone(item.id))} title={item.done ? t("Pendiente") : t("Hecha")} aria-label={t("Hecha")} className="grid size-10 place-items-center rounded-full bg-accent text-white">
            <CheckIcon size={18} className="block" />
          </button>
        )}
        {item.href && (
          <Link href={item.href} title={t("Abrir")} aria-label={t("Abrir")} className="grid size-10 place-items-center rounded-full border border-border-subtle text-ink-muted hover:bg-chip">
            <ArrowUpRight size={16} />
          </Link>
        )}
        {item.editable && (
          <button
            type="button"
            onClick={() => window.confirm(`¿Quitar "${item.title}"?`) && act(() => removeEvent(item.id))}
            title={t("Quitar")}
            aria-label={t("Quitar")}
            className="ml-auto rounded-md p-2 text-ink-faint hover:bg-chip hover:text-red-600"
          >
            <TrashIcon size={15} />
          </button>
        )}
      </span>
    </div>
  );
}

