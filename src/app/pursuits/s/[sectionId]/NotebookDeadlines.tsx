"use client";

import { useLocale, useT } from "@/app/LangProvider";
import { useSyncExternalStore } from "react";
import { useParams } from "next/navigation";
import { useOpenTab } from "./tabs";
import type { NotebookDeadline } from "@/lib/notebookDeadlines";

const subscribe = () => () => {};

const DAY = 86400000;
const startOfDay = (t: number) => {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

// A notebook's Classroom assignments, one row per subject: a ring with how
// much is handed in and chips for what's left. Hidden when none of its
// subjects is linked to Classroom.
// side: shown in a narrow panel, one card per row.
// status: why there's no list, shown instead of hiding the panel.
export function NotebookDeadlines({ list, status = "ok", groupOf, groups, side = false }: { list: NotebookDeadline[]; status?: "ok" | "none" | "disconnected" | "error"; groupOf: Record<string, string | null>; groups: string[]; side?: boolean }) {
  const t = useT();
  const locale = useLocale();
  // Only the open section tab's subjects (?s=Teoría), like the folders.
  const tab = useOpenTab(groups);
  const { sectionId } = useParams<{ sectionId: string }>();
  // Dates depend on the viewer's own clock and time zone, so this draws in
  // the browser (right away: the list came with the page).
  const now = useSyncExternalStore(subscribe, () => Math.floor(Date.now() / 60000) * 60000, () => 0);
  if (!now || status === "none") return null;
  if (status !== "ok")
    return (
      <section className="flex flex-col gap-2">
        <h2 className="flex items-center gap-2 border-b border-border-subtle pb-2 text-sm font-semibold">{t("Entregas")}</h2>
        <div className="flex flex-col gap-2 rounded-lg border border-border-subtle bg-white px-4 py-3 text-[13px] text-ink-muted">
          {status === "disconnected" ? t("Google Classroom no está conectado (o la conexión ha caducado).") : t("No se han podido cargar las entregas de Classroom.")}
          {status === "disconnected" ? (
            <a href={`/api/classroom/connect?pursuitId=${encodeURIComponent(`s:${sectionId}`)}`} className="w-fit rounded-md bg-ink px-3 py-1.5 text-xs font-semibold text-white">
              {t("Conectar Classroom")}
            </a>
          ) : (
            <button type="button" onClick={() => window.location.reload()} className="w-fit rounded-md border border-border-subtle px-3 py-1.5 text-xs font-medium hover:bg-chip">
              {t("Reintentar")}
            </button>
          )}
        </div>
      </section>
    );
  if (list.length === 0) return null;
  const today = startOfDay(now);
  // "This term": what was due in the last four months or is still to come.
  const term = list.filter((d) => d.dueAt >= today - 120 * DAY && (!tab || groupOf[d.folderId] === tab));
  if (term.length === 0) return null;
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
    if (d.turnedIn) return { text: `✓ ${t("Entregada")}`, tone: "bg-chip text-ink-muted" };
    const days = Math.round((startOfDay(d.dueAt) - today) / DAY);
    const red = "bg-chip text-ink font-semibold";
    const amber = "bg-chip text-ink-muted";
    if (days < -1) return { text: t("Hace {0} días", { 0: -days }), tone: red };
    if (days === -1) return { text: t("Ayer"), tone: red };
    if (days === 0) return { text: `${t("Hoy")} ${new Date(d.dueAt).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}`, tone: d.dueAt < now ? red : amber };
    if (days === 1) return { text: t("Mañana"), tone: amber };
    if (days < 7) return { text: new Date(d.dueAt).toLocaleDateString(locale, { weekday: "long" }), tone: days <= 3 ? amber : "bg-chip text-ink-muted" };
    return { text: new Date(d.dueAt).toLocaleDateString(locale, { day: "numeric", month: "short" }), tone: "bg-chip text-ink-muted" };
  };

  // The subject's colour lives only here: a ring of how much is handed in.
  const ring = (color: string, value: number, size = 28, width = 3.5) => {
    // A pixel of room so the stroke never touches the edge (it got clipped).
    const r = (size - width) / 2 - 1;
    const c = 2 * Math.PI * r;
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0 overflow-visible" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#ebebea" strokeWidth={width} />
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
      <div className={`grid grid-cols-1 gap-3 ${side ? "" : "md:grid-cols-2"}`}>
        {rows.map((r) => (
          <div key={r.id} className="flex flex-col rounded-lg border border-border-subtle bg-white px-4 pt-1 pb-1.5">
            <a href={`/pursuits/${r.id}`} className="flex items-center gap-2 py-2.5" title={t("{0} de {1} entregadas", { 0: r.done, 1: r.total })}>
              {ring(r.color, r.total ? r.done / r.total : 0)}
              <span className="truncate text-sm font-semibold text-ink">
                {r.folder}
              </span>
              <span className="ml-auto shrink-0 text-xs text-ink-faint">
                {r.done}/{r.total}
              </span>
            </a>
            {r.todo.length === 0 ? (
              <span className="border-t border-border-subtle py-2 text-[13px] text-ink-faint">{t("Todo entregado")} ✓</span>
            ) : (
              <>
                {r.todo.slice(0, MAX).map((d) => {
                  const w = when(d);
                  return (
                    <a key={d.id} href={d.url} target="_blank" rel="noreferrer" title={d.title} className="-mx-2 flex items-center gap-3 rounded-md border-t border-border-subtle px-2 py-2 text-[13px] hover:bg-chip/60">
                      <span className="min-w-0 flex-1 truncate">{d.title}</span>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold first-letter:uppercase ${w.tone}`}>{w.text}</span>
                    </a>
                  );
                })}
                {r.todo.length > MAX && <span className="border-t border-border-subtle py-1.5 text-xs text-ink-faint">+{r.todo.length - MAX}</span>}
              </>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
