"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { Folder } from "../Covers";
import { TASK_COLUMNS, dueLabel, progress, type ProjectItem, type TaskItem, type TaskStatus } from "@/lib/projects";
import type { FolderCover } from "@/lib/covers";
import { addTask, updateTask } from "./actions";

function Check({ task, today, onToggle, project }: { task: TaskItem; today: string; onToggle: () => void; project?: { title: string; cover: string } }) {
  const done = task.status === "DONE";
  const due = task.dueDate && !done ? dueLabel(task.dueDate, today) : null;
  return (
    <div className="flex items-center gap-2.5 border-t border-[#f4f4f2] py-1.5 text-sm">
      <button
        type="button"
        onClick={onToggle}
        aria-label={done ? "Marcar como pendiente" : "Marcar como hecha"}
        className={`grid size-4 shrink-0 place-items-center rounded border-[1.5px] text-[9px] text-white ${done ? "border-[#448361] bg-[#448361]" : "border-[#c7c6c2] hover:border-[#448361]"}`}
      >
        {done && "✓"}
      </button>
      <span className={`min-w-0 flex-1 truncate ${done ? "text-ink-faint line-through" : ""}`}>{task.title}</span>
      {due && <span className={`text-xs ${due.late || due.text === "hoy" ? "text-[#c4554d]" : "text-ink-faint"}`}>{due.text}</span>}
      {project && (
        <span className="flex max-w-[40%] shrink-0 items-center gap-1.5 text-xs text-ink-faint">
          <Folder cover={project.cover as FolderCover} width={14} />
          <span className="truncate">{project.title}</span>
        </span>
      )}
    </div>
  );
}

// One project on the home page: its checklist and progress.
export function ProjectChecklist({ project, today }: { project: ProjectItem; today: string }) {
  const [tasks, setTasks] = useState(project.tasks);
  const [, start] = useTransition();
  const seq = useRef(0);
  const { done, total } = progress(tasks);
  const sorted = [...tasks].sort((a, b) => (a.status === "DONE" ? 0 : 1) - (b.status === "DONE" ? 0 : 1) || a.order - b.order);
  const toggle = (t: TaskItem) => {
    const status: TaskStatus = t.status === "DONE" ? "TODO" : "DONE";
    setTasks((ts) => ts.map((x) => (x.id === t.id ? { ...x, status } : x)));
    start(() => updateTask(t.id, { status }));
  };
  return (
    <div className="rounded-xl p-4 shadow-[0_0_0_1px_rgba(15,15,15,.07)]">
      <Link href={`/pursuits/${project.id}`} className="flex items-center gap-2 font-semibold hover:underline">
        <Folder cover={project.cover as FolderCover} width={22} />
        {project.title}
      </Link>
      {total > 0 && (
        <div className="mt-1.5 mb-2 flex items-center gap-2 text-xs text-ink-faint">
          {done}/{total}
          <span className="h-1.5 flex-1 overflow-hidden rounded bg-[#ededeb]">
            <span className="block h-full rounded" style={{ width: `${(done / total) * 100}%`, background: project.color }} />
          </span>
          {project.dueDate && dueLabel(project.dueDate, today).text}
        </div>
      )}
      {sorted.map((t) => (
        <Check key={t.id} task={t} today={today} onToggle={() => toggle(t)} />
      ))}
      <QuickAdd
        onAdd={(title) => {
          const temp = `new-${++seq.current}`;
          setTasks((ts) => [...ts, { id: temp, title, status: "TODO", dueDate: null, pursuitId: project.id, order: Math.max(0, ...ts.map((t) => t.order)) + 1 }]);
          start(async () => {
            const id = await addTask(project.id, title);
            setTasks((ts) => ts.map((t) => (t.id === temp && id ? { ...t, id } : t)));
          });
        }}
      />
    </div>
  );
}

// Today's focus: started, due today or late, and done today, from every
// project, as three small columns.
export function TodayFocus({ projects, today, focus }: { projects: ProjectItem[]; today: string; focus: TaskItem[] }) {
  const [tasks, setTasks] = useState(focus);
  const [, start] = useTransition();
  const byId = new Map(projects.map((p) => [p.id, p]));
  const set = (t: TaskItem, status: TaskStatus) => {
    setTasks((ts) => ts.map((x) => (x.id === t.id ? { ...x, status } : x)));
    start(() => updateTask(t.id, { status }));
  };
  if (projects.length === 0) return <p className="py-6 text-sm text-ink-faint">Crea una libreta sin herramientas de estudio para tus proyectos y sus tareas saldrán aquí.</p>;
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {TASK_COLUMNS.map((c) => {
        const items = tasks.filter((t) => t.status === c.status);
        return (
          <div key={c.status} className="rounded-xl bg-[#f7f7f5] p-2.5">
            <div className="flex items-center gap-2 px-1 pb-1.5 text-[13px] font-semibold">
              <span className="size-2 rounded-full" style={{ background: c.dot }} />
              {c.label}
              <span className="font-normal text-ink-faint">{items.length}</span>
            </div>
            {items.map((t) => {
              const p = byId.get(t.pursuitId);
              const due = t.dueDate && t.status !== "DONE" ? dueLabel(t.dueDate, today) : null;
              return (
                <div key={t.id} className="mb-2 flex items-start gap-2.5 rounded-lg bg-white px-3 py-2 text-sm shadow-[0_0_0_1px_rgba(15,15,15,.06)]">
                  <button
                    type="button"
                    onClick={() => set(t, t.status === "DONE" ? "TODO" : "DONE")}
                    aria-label="Hecha"
                    className={`mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border-[1.5px] text-[9px] text-white ${t.status === "DONE" ? "border-[#448361] bg-[#448361]" : "border-[#c7c6c2] hover:border-[#448361]"}`}
                  >
                    {t.status === "DONE" && "✓"}
                  </button>
                  <span className="min-w-0 flex-1">
                    <span className={t.status === "DONE" ? "text-ink-faint line-through" : ""}>{t.title}</span>
                    <span className="mt-1 flex items-center gap-1.5 text-xs text-ink-faint">
                      {p && <Folder cover={p.cover as FolderCover} width={14} />}
                      <span className="truncate">{p?.title}</span>
                      {due && <span className={`ml-auto ${due.late || due.text === "hoy" ? "text-[#c4554d]" : ""}`}>{due.text}</span>}
                    </span>
                  </span>
                  {t.status === "TODO" && (
                    <button type="button" onClick={() => set(t, "IN_PROGRESS")} title="Empezar" className="text-xs text-ink-faint hover:text-ink">
                      ▶
                    </button>
                  )}
                </div>
              );
            })}
            {items.length === 0 && <p className="px-1 py-2 text-xs text-ink-faint">Nada por aquí.</p>}
          </div>
        );
      })}
    </div>
  );
}

function QuickAdd({ onAdd }: { onAdd: (title: string) => void }) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const input = e.currentTarget.elements.namedItem("t") as HTMLInputElement;
        if (input.value.trim()) onAdd(input.value.trim());
        input.value = "";
      }}
      className="border-t border-[#f4f4f2] pt-1.5"
    >
      <input name="t" placeholder="+ Añadir" aria-label="Nueva tarea" className="w-full py-0.5 text-sm text-ink outline-none placeholder:text-ink-faint" />
    </form>
  );
}

export { Check };
