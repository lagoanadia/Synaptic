"use client";

import { useTransition } from "react";
import { STATE_LABEL, progress, projectState, type ProjectItem } from "@/lib/projects";
import { setProjectInfo } from "./actions";

// Top of a project folder: state, progress, dates and "terminado".
export function ProjectInfo({ project }: { project: ProjectItem }) {
  const [, start] = useTransition();
  const state = projectState(project);
  const s = STATE_LABEL[state];
  const { done, total } = progress(project.tasks);
  const set = (d: Parameters<typeof setProjectInfo>[1]) => start(() => setProjectInfo(project.id, d));
  const field = "rounded-md bg-chip px-2 py-1 text-sm text-ink outline-none";
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs" style={{ background: s.bg, color: s.fg }}>
        <span className="size-1.5 rounded-full" style={{ background: s.fg }} />
        {s.label}
      </span>
      {total > 0 && (
        <span className="flex w-44 items-center gap-2 text-xs text-ink-faint">
          <span className="h-1.5 flex-1 overflow-hidden rounded bg-[#ededeb]">
            <span className="block h-full rounded" style={{ width: `${(done / total) * 100}%`, background: project.color }} />
          </span>
          {done}/{total}
        </span>
      )}
      <label className="flex items-center gap-2 text-ink-faint">
        Inicio
        <input type="date" defaultValue={project.startDate ?? ""} onChange={(e) => set({ startDate: e.target.value || null })} className={field} />
      </label>
      <label className="flex items-center gap-2 text-ink-faint">
        Entrega
        <input type="date" defaultValue={project.dueDate ?? ""} onChange={(e) => set({ dueDate: e.target.value || null })} className={field} />
      </label>
      <label className="ml-auto flex cursor-pointer items-center gap-2 text-ink-muted">
        <input type="checkbox" defaultChecked={project.finished} onChange={(e) => set({ finished: e.target.checked })} className="size-4 accent-[#448361]" />
        Terminado
      </label>
    </div>
  );
}
