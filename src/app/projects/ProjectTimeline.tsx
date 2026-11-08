"use client";

import Link from "next/link";
import { useState } from "react";
import type { ProjectItem } from "@/lib/projects";

const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const ms = (day: string) => Date.parse(`${day}T00:00:00Z`);

// A month of the notebook's projects as bars, in each project's colour,
// with today marked. Projects without dates are named below.
export function ProjectTimeline({ projects, today }: { projects: ProjectItem[]; today: string }) {
  const [ty, tm] = today.split("-").map(Number);
  const [month, setMonth] = useState({ y: ty, m: tm - 1 });
  const first = Date.UTC(month.y, month.m, 1);
  const days = new Date(Date.UTC(month.y, month.m + 1, 0)).getUTCDate();
  const last = Date.UTC(month.y, month.m, days);
  const dated = projects
    .filter((p) => p.startDate || p.dueDate)
    .map((p) => ({ p, from: ms(p.startDate ?? p.dueDate!), to: ms(p.dueDate ?? p.startDate!) }))
    .filter(({ from, to }) => to >= first && from <= last);
  const undated = projects.filter((p) => !p.startDate && !p.dueDate);
  const pct = (t: number) => ((Math.min(Math.max(t, first), last) - first) / 86400000 / days) * 100;
  const todayMs = ms(today);
  const shift = (d: number) => setMonth(({ y, m }) => ({ y: m + d < 0 ? y - 1 : m + d > 11 ? y + 1 : y, m: (m + d + 12) % 12 }));

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 text-sm">
        <span className="font-medium">
          {MONTHS[month.m]} {month.y}
        </span>
        <button type="button" onClick={() => shift(-1)} aria-label="Mes anterior" className="rounded px-1.5 text-ink-faint hover:bg-chip hover:text-ink">
          ‹
        </button>
        <button type="button" onClick={() => shift(1)} aria-label="Mes siguiente" className="rounded px-1.5 text-ink-faint hover:bg-chip hover:text-ink">
          ›
        </button>
      </div>
      <div className="grid border-b border-[#ededeb] pb-2 text-[11px] text-ink-faint" style={{ gridTemplateColumns: `repeat(${days}, 1fr)` }}>
        {Array.from({ length: days }, (_, i) => (
          <span key={i} className={i % 2 ? "max-sm:invisible" : ""}>
            {i + 1}
          </span>
        ))}
      </div>
      <div className="relative" style={{ height: Math.max(1, dated.length) * 44 + 12 }}>
        {todayMs >= first && todayMs <= last && <span className="absolute inset-y-0 w-0.5 bg-[#e16259]" style={{ left: `${pct(todayMs) + 50 / days}%` }} />}
        {dated.map(({ p, from, to }, i) => (
          <Link
            key={p.id}
            href={`/pursuits/${p.id}`}
            className="absolute flex h-9 items-center gap-2 overflow-hidden rounded-lg px-3 text-[13px] font-medium whitespace-nowrap hover:brightness-95"
            style={{
              left: `${pct(from)}%`,
              width: `${Math.max(pct(to + 86400000) - pct(from), 100 / days)}%`,
              top: 6 + i * 44,
              background: `${p.color}2e`,
              boxShadow: `inset 3px 0 0 ${p.color}`,
              opacity: p.finished ? 0.6 : 1,
            }}
          >
            {p.title}
            <span className="font-normal opacity-60">
              {p.tasks.filter((t) => t.status === "DONE").length}/{p.tasks.length}
            </span>
          </Link>
        ))}
        {dated.length === 0 && <p className="pt-3 text-sm text-ink-faint">Ningún proyecto con fechas este mes.</p>}
      </div>
      {undated.length > 0 && <p className="text-xs text-ink-faint">Sin fechas: {undated.map((p) => p.title).join(", ")}. Pónselas dentro de cada proyecto.</p>}
    </div>
  );
}
