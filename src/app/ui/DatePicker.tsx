"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useT } from "@/app/LangProvider";
import { CalendarIcon, Chevron, Popover } from "./Popover";

// "2026-11-15" ↔ Date, in local time (no UTC off-by-one).
export const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const parse = (v: string | null | undefined) => {
  const m = v?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
};
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const todayDate = () => {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
};
const shortDay = (v: string, locale: string) => parse(v)!.toLocaleDateString(locale, { day: "numeric", month: "short" });

// A date field with Synaptic's own calendar instead of the browser's.
// `children` replaces the trigger's content (e.g. just an icon); with `name`
// the value is also submitted with the surrounding form.
export function DatePicker({
  value,
  onChange,
  name,
  disabled,
  title,
  ariaLabel,
  placeholder,
  className = "",
  children,
  align,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  name?: string;
  disabled?: boolean;
  title?: string;
  ariaLabel?: string;
  placeholder?: string;
  className?: string;
  children?: React.ReactNode;
  align?: "start" | "end";
}) {
  const t = useT();
  const locale = useLocale();
  const button = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const label = value ? parse(value)!.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" }) : (placeholder ?? t("Fecha"));

  return (
    <>
      <button
        ref={button}
        type="button"
        disabled={disabled}
        title={title}
        aria-label={ariaLabel ?? title}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={children ? className : `inline-flex items-center gap-2 text-left ${value ? "" : "text-ink-faint"} ${className}`}
      >
        {children ?? (
          <>
            <span className="text-ink-faint">
              <CalendarIcon />
            </span>
            {label}
          </>
        )}
      </button>
      {name && <input type="hidden" name={name} value={value ?? ""} />}
      <Popover anchor={button} open={open} onClose={() => setOpen(false)} label={ariaLabel ?? title} align={align}>
        <div className="w-[264px] p-3">
          <Calendar
            start={null}
            end={value}
            onPick={(d) => {
              onChange(d);
              setOpen(false);
              button.current?.focus();
            }}
          />
          <Footer
            onClear={() => {
              onChange(null);
              setOpen(false);
            }}
            right={
              <button type="button" onClick={() => (onChange(isoDay(todayDate())), setOpen(false))} className="rounded-md px-2 py-1 font-medium text-accent hover:bg-accent-soft">
                {t("Hoy")}
              </button>
            }
          />
        </div>
      </Popover>
    </>
  );
}

export type Range = { start: string | null; end: string | null };

// One date or a start → end span. A single day is saved as just the end
// (the due date), so a task with one date keeps working as before.
const normalize = (start: string | null, end: string | null): Range => {
  if (start && !end) return { start: null, end: start };
  if (start && end && start === end) return { start: null, end };
  if (start && end && start > end) return { start: end, end: start };
  return { start, end };
};

// Start and end dates on one calendar: pick the start, then the end; or a
// quick preset. Every pick saves at once, so what depends on the dates
// (the Gantt chart) follows along.
export function RangePicker({
  value,
  onChange,
  title,
  ariaLabel,
  className = "",
  children,
  align,
  endLabel,
  extra,
}: {
  value: Range;
  onChange: (v: Range) => void;
  title?: string;
  ariaLabel?: string;
  className?: string;
  children?: React.ReactNode;
  align?: "start" | "end";
  endLabel?: string;
  extra?: (close: () => void) => React.ReactNode;
}) {
  const t = useT();
  const locale = useLocale();
  const button = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  // What's being edited while open: a lone start stays a start here.
  const [draft, setDraft] = useState<Range>(value);
  const [field, setField] = useState<"start" | "end">("start");

  const show = () => {
    setDraft(value);
    setField(value.start || !value.end ? "start" : "end");
    setOpen(true);
  };
  const commit = (r: Range) => {
    setDraft(r);
    const n = normalize(r.start, r.end);
    if (n.start !== value.start || n.end !== value.end) onChange(n);
  };
  const close = () => setOpen(false);

  function pick(day: string) {
    if (field === "start") {
      commit({ start: day, end: draft.end && draft.end < day ? null : draft.end });
      setField("end");
    } else if (draft.start && day < draft.start) {
      commit({ start: day, end: null });
    } else {
      commit({ start: draft.start, end: day });
    }
  }

  const today = todayDate();
  const monday = addDays(today, -((today.getDay() + 6) % 7));
  const presets: [string, Range][] = [
    [t("Hoy"), { start: null, end: isoDay(today) }],
    [t("Mañana"), { start: null, end: isoDay(addDays(today, 1)) }],
    [t("Esta semana"), { start: isoDay(today), end: isoDay(addDays(monday, 6)) }],
    [t("Próxima semana"), { start: isoDay(addDays(monday, 7)), end: isoDay(addDays(monday, 13)) }],
  ];

  const box = (f: "start" | "end", label: string, v: string | null) => (
    <button
      type="button"
      onClick={() => setField(f)}
      className={`flex-1 rounded-lg px-2.5 py-1.5 text-left transition-shadow ${field === f ? "bg-white shadow-[0_0_0_1.5px_var(--color-accent)]" : "bg-chip hover:bg-hover"}`}
    >
      <span className="block text-[10.5px] font-medium tracking-wide text-ink-faint uppercase">{label}</span>
      <span className={`text-[13px] ${v ? "font-medium" : "text-ink-faint"}`}>{v ? shortDay(v, locale) : t("Elegir")}</span>
    </button>
  );

  return (
    <>
      <button ref={button} type="button" title={title} aria-label={ariaLabel ?? title} aria-haspopup="dialog" aria-expanded={open} onClick={() => (open ? close() : show())} className={className}>
        {children}
      </button>
      <Popover anchor={button} open={open} onClose={close} label={ariaLabel ?? title} align={align}>
        <div className="w-[300px] p-3">
          <div className="mb-2.5 flex items-center gap-1.5">
            {box("start", t("Inicio"), draft.start)}
            <span className="text-ink-faint" aria-hidden>
              →
            </span>
            {box("end", endLabel ?? t("Fin"), draft.end)}
          </div>
          <div className="mb-2 flex flex-wrap gap-1">
            {presets.map(([label, r]) => {
              const on = normalize(draft.start, draft.end).start === r.start && normalize(draft.start, draft.end).end === r.end;
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => {
                    commit(r);
                    setField("end");
                  }}
                  className={`rounded-full px-2 py-0.5 text-[11.5px] ${on ? "bg-accent text-accent-fg" : "bg-chip text-ink-muted hover:bg-hover hover:text-ink"}`}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <Calendar start={draft.start} end={draft.end} onPick={pick} preview={field === "end" && !!draft.start} />
          <Footer
            onClear={() => {
              commit({ start: null, end: null });
              setField("start");
            }}
            clearLabel={t("Quitar fechas")}
            left={extra?.(close)}
            right={
              <button type="button" onClick={close} className="rounded-md bg-ink px-2.5 py-1 font-medium text-white hover:opacity-90">
                {t("Listo")}
              </button>
            }
          />
        </div>
      </Popover>
    </>
  );
}

function Footer({ onClear, clearLabel, left, right }: { onClear: () => void; clearLabel?: string; left?: React.ReactNode; right: React.ReactNode }) {
  const t = useT();
  return (
    <div className="mt-2 flex items-center justify-between gap-1 border-t border-border-subtle pt-2 text-xs whitespace-nowrap">
      <span className="flex items-center gap-0.5">
        <button type="button" onClick={onClear} className="rounded-md px-2 py-1 text-ink-muted hover:bg-hover hover:text-ink">
          {clearLabel ?? t("Quitar")}
        </button>
        {left}
      </span>
      {right}
    </div>
  );
}

// A month grid (Monday first). With a start, the days up to the end are
// shaded; `preview` shades up to the hovered day while choosing the end.
function Calendar({ start, end, onPick, preview }: { start: string | null; end: string | null; onPick: (day: string) => void; preview?: boolean }) {
  const t = useT();
  const locale = useLocale();
  const today = useMemo(() => todayDate(), []);
  const [cursor, setCursor] = useState<Date>(parse(end) ?? parse(start) ?? today);
  const [hover, setHover] = useState<string | null>(null);
  const month = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const first = addDays(month, -((month.getDay() + 6) % 7));
  const weeks = Math.ceil(((month.getDay() + 6) % 7 + new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()) / 7);
  const days = Array.from({ length: weeks * 7 }, (_, i) => addDays(first, i));
  const weekdays = days.slice(0, 7).map((d) => d.toLocaleDateString(locale, { weekday: "narrow" }));
  const title = month.toLocaleDateString(locale, { month: "long", year: "numeric" });
  const grid = useRef<HTMLDivElement>(null);
  const rangeEnd = preview && hover && start && hover >= start ? hover : end;

  // Opening the calendar puts the keyboard on the chosen day (or today).
  useEffect(() => {
    requestAnimationFrame(() => grid.current?.querySelector<HTMLButtonElement>('[tabindex="0"]')?.focus({ preventScroll: true }));
  }, []);

  const move = (d: Date) => {
    setCursor(d);
    requestAnimationFrame(() => grid.current?.querySelector<HTMLButtonElement>(`[data-day="${isoDay(d)}"]`)?.focus());
  };
  const shiftMonth = (n: number) => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + n, Math.min(cursor.getDate(), 28)));

  return (
    <div className="select-none">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="pl-1 text-sm font-semibold first-letter:uppercase">{title}</span>
        <span className="flex">
          <button type="button" onClick={() => shiftMonth(-1)} aria-label={t("Mes anterior")} className="grid size-7 place-items-center rounded-md text-ink-muted hover:bg-hover hover:text-ink">
            <Chevron dir="left" />
          </button>
          <button type="button" onClick={() => shiftMonth(1)} aria-label={t("Mes siguiente")} className="grid size-7 place-items-center rounded-md text-ink-muted hover:bg-hover hover:text-ink">
            <Chevron dir="right" />
          </button>
        </span>
      </div>
      <div className="grid grid-cols-7 text-center text-[10.5px] font-medium text-ink-faint uppercase">
        {weekdays.map((w, i) => (
          <span key={i} className="py-1">
            {w}
          </span>
        ))}
      </div>
      <div
        ref={grid}
        role="grid"
        className="grid grid-cols-7 gap-y-0.5 text-center text-[13px]"
        onPointerLeave={() => setHover(null)}
        onKeyDown={(e) => {
          const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
          if (step) {
            e.preventDefault();
            move(addDays(cursor, step));
          } else if (e.key === "PageUp" || e.key === "PageDown") {
            e.preventDefault();
            move(new Date(cursor.getFullYear(), cursor.getMonth() + (e.key === "PageUp" ? -1 : 1), Math.min(cursor.getDate(), 28)));
          }
        }}
      >
        {days.map((d) => {
          const day = isoDay(d);
          const inMonth = d.getMonth() === month.getMonth();
          const isStart = day === start;
          const isEnd = day === rangeEnd;
          const sel = isStart || day === end;
          const inside = !!start && !!rangeEnd && day > start && day < rangeEnd;
          const now = day === isoDay(today);
          // The band behind a range: from the start's middle to the end's.
          const band = start && rangeEnd && start < rangeEnd && (isStart || isEnd || inside);
          return (
            <span key={day} className="relative grid place-items-center py-px">
              {band && <span className={`absolute inset-y-px bg-accent-soft ${isStart ? "left-1/2 right-0" : isEnd ? "right-1/2 left-0" : "inset-x-0"}`} aria-hidden />}
              <button
                type="button"
                data-day={day}
                tabIndex={d.getTime() === cursor.getTime() ? 0 : -1}
                aria-pressed={sel}
                aria-label={d.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" })}
                onClick={() => onPick(day)}
                onPointerEnter={() => setHover(day)}
                className={`relative grid size-8 place-items-center rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/50 ${
                  sel || isEnd
                    ? "bg-accent font-semibold text-accent-fg"
                    : now
                      ? "font-semibold text-accent hover:bg-accent-soft"
                      : inside
                        ? "text-ink hover:bg-white/60"
                        : inMonth
                          ? "text-ink hover:bg-hover"
                          : "text-ink-faint/60 hover:bg-hover"
                }`}
              >
                {d.getDate()}
                {now && !(sel || isEnd) && <span className="absolute bottom-1 size-1 rounded-full bg-accent" aria-hidden />}
              </button>
            </span>
          );
        })}
      </div>
    </div>
  );
}
