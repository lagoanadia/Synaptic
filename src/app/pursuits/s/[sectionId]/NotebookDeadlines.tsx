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

// A notebook's Classroom assignments, one row per subject: a ring with how
// much is handed in and chips for what's left. Hidden when none of its
// subjects is linked to Classroom.
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
  // One row per subject: how much of it is handed in, then what's still
  // to do (late first, then soonest). Subjects with something late go
  // first, then by their next deadline; all-done ones last.
  const rows = [...new Set(term.map((d) => d.folderId))]
    .map((id) => {
      const mine = term.filter((d) => d.folderId === id);
      const pending = mine.filter((d) => !d.turnedIn && d.dueAt >= today - 30 * DAY);
      const late = pending.filter((d) => d.dueAt < now).reverse();
      const next = pending.filter((d) => d.dueAt >= now);
      return { id, folder: mine[0].folder, color: mine[0].color, done: mine.filter((d) => d.turnedIn).length, total: mine.length, todo: [...late, ...next], late: late.length };
    })
    .sort((a, b) => (b.late > 0 ? 1 : 0) - (a.late > 0 ? 1 : 0) || (a.todo.length ? 0 : 1) - (b.todo.length ? 0 : 1) || (a.todo[0]?.dueAt ?? 0) - (b.todo[0]?.dueAt ?? 0));
  const done = term.filter((d) => d.turnedIn).length;
  const MAX = 4;

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

  const ring = (color: string, value: number, size = 34, width = 4) => {
    const r = (size - width) / 2;
    const c = 2 * Math.PI * r;
    return (
      <svg width={size} height={size} className="shrink-0" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f3e4cc" strokeWidth={width} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeDasharray={`${c * value} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </svg>
    );
  };

  return (
    <section className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2 border-b border-border-subtle pb-2 text-sm font-semibold">
        {t("Entregas")}
        <span aria-hidden className="size-3 rounded-[3px] bg-[conic-gradient(#ea4335_0_25%,#fbbc04_0_50%,#34a853_0_75%,#4285f4_0)]" title="Google Classroom" />
        <span className="ml-auto text-xs font-normal text-ink-faint">{t("{0} de {1} entregadas", { 0: done, 1: term.length })}</span>
      </h2>
      <div className="overflow-hidden rounded-xl bg-white shadow-[0_1px_3px_rgba(0,0,0,.05)]">
        {rows.map((r) => (
          <div key={r.id} className="flex flex-col gap-2.5 border-b border-[#f5ecdc] px-4 py-3 last:border-b-0 sm:flex-row sm:items-center sm:gap-4 sm:px-5">
            <a href={`/pursuits/${r.id}`} className="flex w-40 shrink-0 items-center gap-2.5" title={t("{0} de {1} entregadas", { 0: r.done, 1: r.total })}>
              {ring(r.color, r.total ? r.done / r.total : 0)}
              <span className="truncate text-sm font-extrabold" style={{ color: r.color }}>
                {r.folder}
              </span>
              <span className="text-xs text-ink-faint">
                {r.done}/{r.total}
              </span>
            </a>
            {r.todo.length === 0 ? (
              <span className="text-[13px] text-ink-faint">{t("Todo entregado")} ✓</span>
            ) : (
              <span className="flex min-w-0 flex-wrap gap-2">
                {r.todo.slice(0, MAX).map((d) => {
                  const w = when(d);
                  return (
                    <a
                      key={d.id}
                      href={d.url}
                      target="_blank"
                      rel="noreferrer"
                      title={d.title}
                      className="flex max-w-full items-center gap-2 rounded-lg border border-[#efe4d2] bg-[#fffdf9] py-1.5 pr-1.5 pl-2.5 text-[13px] transition-colors hover:border-[#d9c9ad] hover:bg-white"
                    >
                      <span className="max-w-[260px] truncate">{d.title}</span>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold first-letter:uppercase ${w.tone}`}>{w.text}</span>
                    </a>
                  );
                })}
                {r.todo.length > MAX && <span className="self-center text-xs text-ink-faint">+{r.todo.length - MAX}</span>}
              </span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
