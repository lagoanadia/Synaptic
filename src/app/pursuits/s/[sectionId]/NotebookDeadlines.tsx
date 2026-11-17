"use client";

import { useLocale, useT } from "@/app/LangProvider";
import { useEffect, useState } from "react";
import { listNotebookDeadlines, type NotebookDeadline } from "../../actions";

const DAY = 86400000;
const startOfDay = (t: number) => {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};
const initials = (s: string) => s.replace(/[^\p{L}\p{N}]/gu, "").slice(0, 2).toUpperCase();

// A notebook's Classroom assignments at a glance: how many are handed in,
// the next two weeks as a strip of days, and a card per assignment (late
// first, then soonest, then the last ones handed in). Hidden when none of
// its subjects is linked to Classroom.
export function NotebookDeadlines({ sectionId }: { sectionId: string }) {
  const t = useT();
  const locale = useLocale();
  const [data, setData] = useState<{ list: NotebookDeadline[]; now: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    listNotebookDeadlines(sectionId)
      .catch(() => [])
      .then((list) => !cancelled && setData({ list, now: Date.now() }));
    return () => {
      cancelled = true;
    };
  }, [sectionId]);

  if (!data || data.list.length === 0) return null;
  const { list, now } = data;
  const today = startOfDay(now);
  // "This term": what was due in the last four months or is still to come.
  const term = list.filter((d) => d.dueAt >= today - 120 * DAY);
  const done = term.filter((d) => d.turnedIn).length;
  const late = list.filter((d) => !d.turnedIn && d.dueAt < now && d.dueAt >= today - 30 * DAY).reverse();
  const next = list.filter((d) => !d.turnedIn && d.dueAt >= now);
  const handed = list.filter((d) => d.turnedIn && d.dueAt >= today - 30 * DAY).reverse();
  // Trello-style columns: late, this week, later, handed in.
  const weekEnd = today + 7 * DAY;
  const columns: { id: string; title: string; dot: string; items: NotebookDeadline[] }[] = [
    { id: "late", title: t("Atrasadas"), dot: "#c0473d", items: late },
    { id: "week", title: t("Esta semana"), dot: "#d99a2b", items: next.filter((d) => d.dueAt < weekEnd) },
    { id: "later", title: t("Más adelante"), dot: "#4a6a9a", items: next.filter((d) => d.dueAt >= weekEnd) },
    { id: "done", title: t("Entregadas"), dot: "#6f8a5c", items: handed },
  ];

  const when = (d: NotebookDeadline): { text: string; tone: string } => {
    if (d.turnedIn) return { text: `✓ ${t("Entregada")}`, tone: "bg-[#e4efdf] text-[#4f7a42]" };
    const days = Math.round((startOfDay(d.dueAt) - today) / DAY);
    const red = "bg-[#fde2df] text-[#c0473d]";
    const amber = "bg-[#fff1d6] text-[#a26f22]";
    if (days < -1) return { text: t("Hace {0} días", { 0: -days }), tone: red };
    if (days === -1) return { text: t("Ayer"), tone: red };
    if (days === 0) return { text: `${t("Hoy")} ${new Date(d.dueAt).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}`, tone: d.dueAt < now ? red : amber };
    if (days === 1) return { text: t("Mañana"), tone: amber };
    if (days < 7) return { text: new Date(d.dueAt).toLocaleDateString(locale, { weekday: "long" }), tone: days <= 3 ? amber : "bg-[#eef2f8] text-[#4a6a9a]" };
    return { text: new Date(d.dueAt).toLocaleDateString(locale, { day: "numeric", month: "short" }), tone: "bg-[#eef2f8] text-[#4a6a9a]" };
  };

  const days = Array.from({ length: 14 }, (_, i) => today + i * DAY);
  const R = 40;
  const C = 2 * Math.PI * R;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2 border-b border-border-subtle pb-2 text-sm font-semibold">
        {t("Entregas")}
        <span aria-hidden className="size-3 rounded-[3px] bg-[conic-gradient(#ea4335_0_25%,#fbbc04_0_50%,#34a853_0_75%,#4285f4_0)]" title="Google Classroom" />
      </h2>
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex items-center justify-center gap-4 rounded-xl bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,.05)] sm:w-40 sm:flex-col sm:gap-1">
          <svg width="96" height="96" viewBox="0 0 96 96" role="img" aria-label={t("{0} de {1} entregadas", { 0: done, 1: term.length })}>
            <circle cx="48" cy="48" r={R} fill="none" stroke="#f3e4cc" strokeWidth="10" />
            <circle cx="48" cy="48" r={R} fill="none" stroke="#6f8a5c" strokeWidth="10" strokeLinecap="round" strokeDasharray={`${term.length ? (C * done) / term.length : 0} ${C}`} transform="rotate(-90 48 48)" />
            <text x="48" y="47" textAnchor="middle" fontSize="20" fontWeight="800" fill="currentColor">
              {done}/{term.length}
            </text>
            <text x="48" y="62" textAnchor="middle" fontSize="10" fill="#8a8277">
              {t("entregadas")}
            </text>
          </svg>
        </div>
        <div className="min-w-0 flex-1 rounded-xl bg-white p-3 shadow-[0_1px_3px_rgba(0,0,0,.05)] sm:p-4">
          <div className="mb-2 text-xs text-ink-faint">{t("Próximas 2 semanas")}</div>
          <div className="grid grid-cols-7 gap-1 sm:grid-cols-14">
            {days.map((day, i) => {
              const date = new Date(day);
              const due = list.filter((d) => startOfDay(d.dueAt) === day);
              const weekend = date.getDay() === 0 || date.getDay() === 6;
              return (
                <div key={day} className={`flex min-h-20 flex-col items-center gap-1 rounded-lg py-1.5 text-[11px] ${i === 0 ? "bg-[#fde8e4] font-bold text-[#c0473d]" : weekend ? "bg-[#f6efe3] text-ink-faint" : "bg-[#faf5ec] text-ink-faint"}`}>
                  <span>{date.toLocaleDateString(locale, { weekday: "narrow" })}</span>
                  <span>{date.getDate()}</span>
                  {due.map((d) => (
                    <a
                      key={d.id}
                      href={d.url}
                      target="_blank"
                      rel="noreferrer"
                      title={`${d.folder} · ${d.title}`}
                      className={`grid size-[18px] place-items-center rounded-full text-[8px] font-bold text-white ${d.turnedIn ? "opacity-40" : ""}`}
                      style={{ background: d.color }}
                    >
                      {initials(d.folder)}
                    </a>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-1 items-start sm:grid sm:grid-cols-4 sm:overflow-visible">
        {columns.map((col) => (
          <div key={col.id} className="flex w-[78%] shrink-0 snap-start flex-col gap-2 rounded-xl bg-black/[.035] p-2 sm:w-auto">
            <div className="flex items-center gap-2 px-1.5 pt-0.5 text-[13px] font-semibold">
              <i className="size-2 rounded-full" style={{ background: col.dot }} />
              {col.title}
              <span className="text-xs font-normal text-ink-faint">{col.items.length}</span>
            </div>
            {col.items.length === 0 && <p className="px-1.5 py-3 text-xs text-ink-faint">{t("Nada por aquí.")}</p>}
            {col.items.slice(0, 6).map((d) => {
              const w = when(d);
              return (
                <a
                  key={d.id}
                  href={d.url}
                  target="_blank"
                  rel="noreferrer"
                  className={`flex flex-col gap-1 rounded-lg border-l-4 bg-white px-3 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,.06)] transition-transform hover:-translate-y-0.5 ${d.turnedIn ? "opacity-60" : ""}`}
                  style={{ borderLeftColor: d.color }}
                >
                  <span className="truncate text-[10px] font-bold tracking-wide" style={{ color: d.color }}>
                    {d.folder}
                  </span>
                  <span className="line-clamp-2 text-[13px] leading-snug font-semibold">{d.title}</span>
                  {col.id !== "done" && <span className={`mt-0.5 w-fit rounded-full px-2 py-0.5 text-[11px] font-bold first-letter:uppercase ${w.tone}`}>{w.text}</span>}
                </a>
              );
            })}
            {col.items.length > 6 && <span className="px-1.5 text-xs text-ink-faint">+{col.items.length - 6}</span>}
          </div>
        ))}
      </div>
    </section>
  );
}
