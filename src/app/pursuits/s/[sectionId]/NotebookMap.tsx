"use client";

import Link from "next/link";
import { useOpenTab } from "./tabs";
import { useT } from "@/app/LangProvider";
import type { SubjectPath } from "@/lib/blockData";

const DONE = 0.999;

// One unit on the path: a ring of how much is learned, ✓ when all of it.
function Node({ pct, color, current }: { pct: number; color: string; current: boolean }) {
  const s = 48;
  const w = 5;
  const r = (s - w) / 2 - 1;
  const c = 2 * Math.PI * r;
  const full = pct >= DONE;
  return (
    <span className="relative block">
      <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} className="overflow-visible" aria-hidden>
        <circle cx={s / 2} cy={s / 2} r={r} fill={full ? color : "#fff"} stroke={full ? color : "#ebebea"} strokeWidth={w} />
        {pct > 0 && !full && <circle cx={s / 2} cy={s / 2} r={r} fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeDasharray={`${c * pct} ${c}`} transform={`rotate(-90 ${s / 2} ${s / 2})`} />}
      </svg>
      {full && <span className="absolute inset-0 grid place-items-center text-[15px] font-bold text-white">✓</span>}
      {current && <span className="absolute -inset-[4px] rounded-full" style={{ boxShadow: `0 0 0 2px ${color}55` }} />}
    </span>
  );
}

// The notebook's map as a path of units per subject (only the open
// section tab's subjects): what's learned, where you are, and a button to
// carry on with the unit you're on.
export function NotebookMap({ paths, groupOf, groups, title }: { paths: SubjectPath[]; groupOf: Record<string, string | null>; groups: string[]; title: string }) {
  const t = useT();
  const tab = useOpenTab(groups);
  const shown = tab ? paths.filter((p) => groupOf[p.id] === tab) : paths;
  if (shown.length === 0) return null;
  return (
    <section className="flex flex-col gap-3">
      <h2 className="flex items-center gap-3 border-b border-border-subtle pb-2 text-sm font-semibold">
        {title}
      </h2>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {shown.map((p) => {
          const cur = p.units.findIndex((u) => u.pct < DONE);
          const now = cur === -1 ? null : p.units[cur];
          const done = p.units.filter((u) => u.pct >= DONE).length;
          return (
            <div key={p.id} className="flex flex-col rounded-lg border border-border-subtle bg-white px-5 pt-4 pb-4">
              <div className="mb-4 flex items-center gap-2">
                <Link href={`/pursuits/${p.id}`} className="truncate text-sm font-semibold text-ink hover:underline">
                  {p.title}
                </Link>
                <span className="ml-auto shrink-0 text-xs text-ink-faint">{t("{0}/{1} unidades", { 0: done, 1: p.units.length })}</span>
              </div>
              <div className="flex items-start gap-1 pb-2">
                {p.units.map((u, i) => (
                  <span key={u.id} className="contents">
                    {i > 0 && <span className="mt-[23px] h-[3px] min-w-3 flex-1 rounded-full" style={{ background: p.units[i - 1].pct >= DONE ? "#c7c5c0" : "#ebebea" }} />}
                    <Link href={u.href} title={u.name} className="flex w-[76px] shrink-0 flex-col items-center gap-1.5 text-center text-[11px] leading-tight font-medium text-ink">
                      <Node pct={u.pct} color={p.color} current={i === cur} />
                      <span className="line-clamp-2 break-words">{u.label}</span>
                      <span className="text-[10px] font-medium text-ink-faint">{Math.round(u.pct * 100)}%</span>
                    </Link>
                  </span>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-border-subtle pt-3.5 text-[13px]">
                {now ? (
                  <>
                    <span className="min-w-0 truncate text-ink-faint">
                      {t("Ahora")}: <b className="text-ink">{now.name}</b>
                    </span>
                    <Link href={now.href} className="ml-3 shrink-0 rounded-md border border-border-subtle px-2.5 py-1 text-xs font-medium text-ink hover:bg-chip">
                      {t("Aprender {0}", { 0: now.label })} →
                    </Link>
                  </>
                ) : (
                  <span className="text-ink-faint">{t("Todo aprendido")} ✓</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
