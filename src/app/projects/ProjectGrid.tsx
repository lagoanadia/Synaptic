"use client";

import Link from "next/link";
import { Folder } from "../Covers";
import { STATE_LABEL, dueLabel, nextTask, progress, projectState, type ProjectItem } from "@/lib/projects";
import type { FolderCover } from "@/lib/covers";

// A notebook's projects as their folders: pending tasks peek out as sheets,
// then its state, progress in its own colour and what's next.
export function ProjectGrid({ projects, today, after }: { projects: ProjectItem[]; today: string; after?: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-[repeat(auto-fill,150px)]">
      {projects.map((p) => {
        const state = projectState(p);
        const { done, total } = progress(p.tasks);
        const next = state === "done" ? null : nextTask(p.tasks);
        const due = next?.dueDate ? dueLabel(next.dueDate, today) : p.dueDate && state !== "done" ? dueLabel(p.dueDate, today) : null;
        const s = STATE_LABEL[state];
        return (
          <Link key={p.id} href={`/pursuits/${p.id}`} className="group flex flex-col gap-3">
            <span className="transition-transform group-hover:-translate-y-0.5">
              <Folder cover={p.cover as FolderCover} sheets={Math.min(3, total - done)} reserveSheets />
            </span>
            <span className="flex flex-col">
              <span className="leading-snug font-semibold">{p.title}</span>
              <span className="mt-2 inline-flex w-fit items-center gap-1.5 rounded-full px-2 py-0.5 text-xs" style={{ background: s.bg, color: s.fg }}>
                <span className="size-1.5 rounded-full" style={{ background: s.fg }} />
                {s.label}
              </span>
              {total > 0 && (
                <span className="mt-2.5 flex items-center gap-2 text-xs text-ink-faint">
                  <span className="h-1.5 flex-1 overflow-hidden rounded bg-[#ededeb]">
                    <span className="block h-full rounded" style={{ width: `${(done / total) * 100}%`, background: p.color }} />
                  </span>
                  {done}/{total}
                </span>
              )}
              {next && (
                <span className="mt-2 text-[13px] text-ink-muted">
                  → {next.title}
                  {due && <span className={`ml-1.5 ${due.late || due.text === "hoy" ? "text-[#c4554d]" : "text-ink-faint"}`}>{due.text}</span>}
                </span>
              )}
            </span>
          </Link>
        );
      })}
      {after && (
        // Same room above as a folder (sheets + tab), so "+" lines up with the covers.
        <div>
          <div className="pt-[12%]" />
          <div className="pt-[min(max(1.5px,5.5%),15px)]" />
          {after}
        </div>
      )}
    </div>
  );
}
