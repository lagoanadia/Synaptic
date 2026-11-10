"use client";

import { useT } from "@/app/LangProvider";
import Link from "next/link";
import { useState } from "react";
import type { ProjectItem } from "@/lib/projects";

const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const WEEKDAYS = ["D", "L", "M", "X", "J", "V", "S"];
const DAY = 86400000;
const ms = (day: string) => Date.parse(`${day}T00:00:00Z`);
const short = (t: number) => new Date(t).toLocaleDateString("es-ES", { day: "numeric", month: "short", timeZone: "UTC" });
const LABEL_W = 150;

// A month of the notebook's projects as a Gantt chart: one row per project,
// a bar in its colour from start to due date, today marked. Projects without
// dates, or with dates in another month, still get a row saying so.
export function ProjectTimeline({ projects, today }: { projects: ProjectItem[]; today: string }) {
  const t = useT();
  const [ty, tm] = today.split("-").map(Number);
  const [month, setMonth] = useState({ y: ty, m: tm - 1 });
  const first = Date.UTC(month.y, month.m, 1);
  const days = new Date(Date.UTC(month.y, month.m + 1, 0)).getUTCDate();
  const last = Date.UTC(month.y, month.m, days);
  const isThisMonth = month.y === ty && month.m === tm - 1;
  const shift = (d: number) => setMonth(({ y, m }) => ({ y: m + d < 0 ? y - 1 : m + d > 11 ? y + 1 : y, m: (m + d + 12) % 12 }));
  const goTo = (t: number) => {
    const d = new Date(t);
    setMonth({ y: d.getUTCFullYear(), m: d.getUTCMonth() });
  };

  if (projects.length === 0) {
    return <p className="rounded-lg border-[1.5px] border-dashed border-[#d8cfbd] px-6 py-8 text-center text-sm text-ink-muted">{t("Crea un nuevo proyecto.")}</p>;
  }

  // Dated projects first (by start), then those without dates.
  const rows = projects
    .map((p) => {
      const from = p.startDate || p.dueDate ? ms(p.startDate ?? p.dueDate!) : null;
      const to = p.startDate || p.dueDate ? ms(p.dueDate ?? p.startDate!) : null;
      return { p, from, to };
    })
    .sort((a, b) => (a.from ?? Infinity) - (b.from ?? Infinity));
  const pct = (t: number) => ((Math.min(Math.max(t, first), last + DAY) - first) / DAY / days) * 100;
  const weekend = (d: number) => [0, 6].includes(new Date(Date.UTC(month.y, month.m, d)).getUTCDay());
  const todayDay = isThisMonth ? Number(today.slice(8, 10)) : null;
  const cols = { gridTemplateColumns: `repeat(${days}, minmax(0, 1fr))` };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-1.5 text-sm">
        <span className="mr-1 font-medium">
          {MONTHS[month.m]} {month.y}
        </span>
        <button type="button" onClick={() => shift(-1)} aria-label={t("Mes anterior")} className="rounded px-1.5 text-ink-faint hover:bg-chip hover:text-ink">
          ‹
        </button>
        <button type="button" onClick={() => shift(1)} aria-label={t("Mes siguiente")} className="rounded px-1.5 text-ink-faint hover:bg-chip hover:text-ink">
          ›
        </button>
        {!isThisMonth && (
          <button type="button" onClick={() => setMonth({ y: ty, m: tm - 1 })} className="ml-1.5 rounded-md border border-border-subtle px-2 py-0.5 text-xs hover:bg-chip">
            {t("Hoy")}
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-border-subtle">
        <div className="relative min-w-[680px]">
          {/* Day columns behind every row: weekends shaded, today a red line. */}
          <div className="pointer-events-none absolute inset-y-0 right-0 grid" style={{ left: LABEL_W, ...cols }} aria-hidden>
            {Array.from({ length: days }, (_, i) => (
              <div key={i} className={`relative border-l border-border-subtle/60 ${weekend(i + 1) ? "bg-ink/[0.03]" : ""}`}>
                {todayDay === i + 1 && <span className="absolute top-10 bottom-0 left-1/2 w-0.5 -translate-x-1/2 bg-[#e16259]" />}
              </div>
            ))}
          </div>

          <div className="relative grid h-10 border-b border-border-subtle" style={{ gridTemplateColumns: `${LABEL_W}px 1fr` }}>
            <span className="flex items-center px-3 text-xs text-ink-faint">{t("Proyecto")}</span>
            <div className="grid" style={cols}>
              {Array.from({ length: days }, (_, i) => (
                <span key={i} className="flex flex-col items-center py-1.5 text-[11px] leading-tight text-ink-faint">
                  <span className="text-[9px] opacity-70">{WEEKDAYS[new Date(Date.UTC(month.y, month.m, i + 1)).getUTCDay()]}</span>
                  <span className={todayDay === i + 1 ? "rounded-full bg-[#e16259] px-1 font-semibold text-white" : ""}>{i + 1}</span>
                </span>
              ))}
            </div>
          </div>

          {rows.map(({ p, from, to }) => {
            const done = p.tasks.filter((t) => t.status === "DONE").length;
            const inMonth = from !== null && to !== null && to >= first && from <= last;
            return (
              <div key={p.id} className="relative grid h-11 border-b border-border-subtle/60 last:border-b-0" style={{ gridTemplateColumns: `${LABEL_W}px 1fr` }}>
                <Link href={`/pursuits/${p.id}`} className="flex min-w-0 items-center gap-2 border-r border-border-subtle px-3 text-[13px] font-medium hover:underline">
                  <span className="size-2 shrink-0 rounded-full" style={{ background: p.color }} />
                  <span className="truncate">{p.title}</span>
                </Link>
                <div className="relative">
                  {from === null ? (
                    <Link href={`/pursuits/${p.id}`} className="absolute top-2 left-2 flex h-7 items-center gap-1 rounded-md border-[1.5px] border-dashed border-[#d3d1cb] bg-background px-2.5 text-xs text-ink-faint hover:border-ink-faint">
                      {t("Sin fechas ·")}{" "}<span className="font-medium text-accent">{t("Añadir fechas")}</span>
                    </Link>
                  ) : inMonth ? (
                    <Link
                      href={`/pursuits/${p.id}`}
                      title={`${short(from)} – ${short(to!)}`}
                      className="absolute top-1.5 flex h-8 items-center gap-1.5 overflow-hidden rounded-md px-2.5 text-[12.5px] font-medium whitespace-nowrap hover:brightness-95"
                      style={{
                        left: `${pct(from)}%`,
                        width: `${Math.max(pct(to! + DAY) - pct(from), 100 / days)}%`,
                        background: `${p.color}2e`,
                        boxShadow: `inset 3px 0 0 ${p.color}`,
                        opacity: p.finished ? 0.6 : 1,
                      }}
                    >
                      {p.title}
                      {p.tasks.length > 0 && (
                        <span className="font-normal opacity-60">
                          {done}/{p.tasks.length}
                        </span>
                      )}
                    </Link>
                  ) : to! < first ? (
                    <button type="button" onClick={() => goTo(to!)} className="absolute top-2 left-2 flex h-7 items-center rounded-md bg-chip px-2.5 text-xs text-ink-muted hover:bg-hover">
                      {t("← Terminó el")}{" "}{short(to!)}
                    </button>
                  ) : (
                    <button type="button" onClick={() => goTo(from)} className="absolute top-2 right-2 flex h-7 items-center rounded-md bg-chip px-2.5 text-xs text-ink-muted hover:bg-hover">
                      {p.startDate ? t("Empieza") : t("Vence")}{" "}{t("el")}{" "}{short(from)} →
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
