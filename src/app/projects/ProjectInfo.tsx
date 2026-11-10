"use client";
import { useLocale, useT } from "@/app/LangProvider";
import type { T } from "@/lib/i18n";

import { useEffect, useRef, useState, useTransition } from "react";
import { CalendarIcon } from "@/app/icons";
import { STATE_LABEL, progress, projectState, type ProjectItem } from "@/lib/projects";
import { setProjectInfo } from "./actions";

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const DAY = 86400000;
const ms = (d: string) => Date.parse(`${d}T00:00:00Z`);
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
const short = (d: string, locale: string) => new Date(ms(d)).toLocaleDateString(locale, { day: "numeric", month: "short", timeZone: "UTC" });

function countdown(t: T, due: string, today: string): { text: string; late: boolean } {
  const days = Math.round((ms(due) - ms(today)) / DAY);
  if (days === 0) return { text: t("se entrega hoy"), late: false };
  if (days === 1) return { text: t("queda 1 día"), late: false };
  if (days > 1) return { text: t("quedan {0} días", { 0: days }), late: false };
  return { text: days === -1 ? t("se pasó ayer") : t("se pasó hace {0} días", { 0: -days }), late: true };
}

// Under a project folder's title, like a Notion page's properties: its state
// (from its tasks), its dates (one chip that opens a calendar) and progress.
export function ProjectInfo({ project, today }: { project: ProjectItem; today: string }) {
  const locale = useLocale();
  const t = useT();
  const [, start] = useTransition();
  const [start_, setStart] = useState(project.startDate);
  const [due, setDue] = useState(project.dueDate);
  const [finished, setFinished] = useState(project.finished);
  const [open, setOpen] = useState(false);
  const s = STATE_LABEL[projectState({ finished, tasks: project.tasks })];
  const { done, total } = progress(project.tasks);
  const save = (d: Parameters<typeof setProjectInfo>[1]) => start(() => setProjectInfo(project.id, d));
  const left = due && !finished ? countdown(t, due, today) : null;

  return (
    <div className="relative -mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
      <span className="flex items-center gap-1.5 px-2 py-1">
        <span className="size-2 rounded-full" style={{ background: s.fg }} />
        {t(s.label)}
      </span>
      <span className="text-ink-faint/50 max-sm:hidden" aria-hidden>
        ·
      </span>
      <button type="button" onClick={() => setOpen((o) => !o)} className={`flex items-center gap-1.5 rounded-md px-2 py-1 hover:bg-chip ${open ? "bg-chip" : ""} ${start_ || due ? "" : "text-ink-faint"}`}>
        <CalendarIcon size={15} />
        {start_ || due ? (
          <>
            {start_ && short(start_, locale)}
            {start_ && due && " → "}
            {due && short(due, locale)}
            {left && <span className={left.late ? "text-[#c4554d]" : "text-ink-faint"}>· {left.text}</span>}
          </>
        ) : (
          t("Añadir fechas")
        )}
      </button>
      {total > 0 && (
        <>
          <span className="text-ink-faint/50 max-sm:hidden" aria-hidden>
            ·
          </span>
          <span className="flex items-center gap-2 px-2 py-1 text-ink-faint">
            <span className="h-1.5 w-24 overflow-hidden rounded bg-[#ededeb]">
              <span className="block h-full rounded" style={{ width: `${(done / total) * 100}%`, background: project.color }} />
            </span>
            {done}{" "}{t("de")}{" "}{total}
          </span>
        </>
      )}
      {open && (
        <DatePicker
          start={start_}
          due={due}
          today={today}
          finished={finished}
          onClose={() => setOpen(false)}
          onDates={(a, b) => {
            setStart(a);
            setDue(b);
            save({ startDate: a, dueDate: b });
          }}
          onFinished={(f) => {
            setFinished(f);
            setOpen(false);
            save({ finished: f });
          }}
        />
      )}
    </div>
  );
}

// Pick a start, then a due date, on one month grid (Monday first, in Spanish).
function DatePicker({
  start,
  due,
  today,
  finished,
  onClose,
  onDates,
  onFinished,
}: {
  start: string | null;
  due: string | null;
  today: string;
  finished: boolean;
  onClose: () => void;
  onDates: (start: string | null, due: string | null) => void;
  onFinished: (finished: boolean) => void;
}) {
  const locale = useLocale();
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);
  const [field, setField] = useState<"start" | "due">(start && !due ? "due" : "start");
  const anchor = new Date(ms(start ?? due ?? today));
  const [month, setMonth] = useState({ y: anchor.getUTCFullYear(), m: anchor.getUTCMonth() });

  useEffect(() => {
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && onClose();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    // Next tick, so the click that opened it doesn't close it.
    const timer = setTimeout(() => document.addEventListener("mousedown", close));
    document.addEventListener("keydown", esc);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [onClose]);

  const first = Date.UTC(month.y, month.m, 1);
  const days = new Date(Date.UTC(month.y, month.m + 1, 0)).getUTCDate();
  const lead = (new Date(first).getUTCDay() + 6) % 7;
  const shift = (d: number) => setMonth(({ y, m }) => ({ y: m + d < 0 ? y - 1 : m + d > 11 ? y + 1 : y, m: (m + d + 12) % 12 }));

  function pick(day: string) {
    if (field === "start") {
      // A start after the due date drops the due date.
      onDates(day, due && due < day ? null : due);
      setField("due");
    } else if (start && day < start) {
      onDates(day, null);
      setField("due");
    } else {
      onDates(start, day);
    }
  }

  const box = (f: "start" | "due", label: string, value: string | null) => (
    <button type="button" onClick={() => setField(f)} className={`flex-1 rounded-md border px-2 py-1.5 text-left ${field === f ? "border-ink" : "border-border-subtle"}`}>
      <span className="block text-ink-faint">{label}</span>
      {value ? short(value, locale) : <span className="text-ink-faint">{t("Elegir")}</span>}
    </button>
  );

  return (
    <div ref={ref} className="absolute top-full left-0 z-20 mt-1 w-[300px] rounded-lg border border-border-subtle bg-white p-3 shadow-[0_12px_32px_-10px_rgba(0,0,0,.25)] sm:left-24">
      <div className="mb-2 flex gap-2 text-xs">
        {box("start", t("Inicio"), start)}
        {box("due", t("Entrega"), due)}
      </div>
      <div className="mb-1 flex items-center justify-between px-1 text-sm font-medium">
        <span>
          {MONTHS[month.m]} {month.y}
        </span>
        <span className="flex text-ink-faint">
          <button type="button" onClick={() => shift(-1)} aria-label={t("Mes anterior")} className="rounded px-1.5 hover:bg-chip hover:text-ink">
            ‹
          </button>
          <button type="button" onClick={() => shift(1)} aria-label={t("Mes siguiente")} className="rounded px-1.5 hover:bg-chip hover:text-ink">
            ›
          </button>
        </span>
      </div>
      <div className="grid grid-cols-7 gap-y-0.5 text-center text-xs">
        {["L", "M", "X", "J", "V", "S", "D"].map((d) => (
          <span key={d} className="py-1 text-ink-faint">
            {d}
          </span>
        ))}
        {Array.from({ length: lead }, (_, i) => (
          <span key={`e${i}`} />
        ))}
        {Array.from({ length: days }, (_, i) => {
          const d = iso(first + i * DAY);
          const end = d === start || d === due;
          const inside = !!start && !!due && d > start && d < due;
          return (
            <button
              key={d}
              type="button"
              onClick={() => pick(d)}
              className={`mx-auto grid size-7 place-items-center rounded-full ${end ? "bg-ink text-white" : inside ? "bg-chip" : "hover:bg-chip"} ${d === today && !end ? "font-semibold text-[#e16259]" : ""}`}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 border-t border-border-subtle pt-2 text-xs whitespace-nowrap text-ink-faint">
        <button type="button" onClick={() => onFinished(!finished)} className="rounded px-1 py-0.5 hover:bg-chip hover:text-ink">
          {finished ? t("Reabrir proyecto") : t("Marcar como terminado")}
        </button>
        {(start || due) && (
          <button type="button" onClick={() => onDates(null, null)} className="rounded px-1 py-0.5 hover:bg-chip hover:text-ink">
            {t("Quitar fechas")}
          </button>
        )}
      </div>
    </div>
  );
}
