"use client";
import { useLocale, useT } from "@/app/LangProvider";
import type { T } from "@/lib/i18n";

import { useState, useTransition } from "react";
import { RangePicker } from "@/app/ui/DatePicker";
import { CalendarIcon } from "@/app/icons";
import { STATE_LABEL, progress, projectState, type ProjectItem } from "@/lib/projects";
import { setProjectInfo } from "./actions";

const DAY = 86400000;
const ms = (d: string) => Date.parse(`${d}T00:00:00Z`);
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
      <RangePicker
        value={{ start: start_, end: due }}
        onChange={(r) => {
          setStart(r.start);
          setDue(r.end);
          save({ startDate: r.start, dueDate: r.end });
        }}
        ariaLabel={t("Fechas")}
        endLabel={t("Entrega")}
        className={`flex items-center gap-1.5 rounded-md px-2 py-1 hover:bg-chip aria-expanded:bg-chip ${start_ || due ? "" : "text-ink-faint"}`}
        extra={(close) => (
          <button
            type="button"
            onClick={() => {
              setFinished(!finished);
              close();
              save({ finished: !finished });
            }}
            className="rounded-md px-2 py-1 text-ink-muted hover:bg-hover hover:text-ink"
          >
            {finished ? t("Reabrir proyecto") : t("Marcar como terminado")}
          </button>
        )}
      >
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
      </RangePicker>
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
    </div>
  );
}
