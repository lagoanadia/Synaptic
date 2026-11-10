"use client";

import { useT } from "@/app/LangProvider";
import { useEffect, useRef, useState, useTransition } from "react";
import { Folder } from "../Covers";
import { TASK_COLUMNS, dueLabel, type TaskItem, type TaskStatus } from "@/lib/projects";
import type { FolderCover } from "@/lib/covers";
import { addTask, deleteTask, setColumn, updateTask } from "./actions";

export type BoardProject = { id: string; title: string; cover: string };
type View = "board" | "list" | "project";

// Tasks as a board (drag between columns), a list, or grouped by project.
// With one project it's that project's board; with several, each card
// shows which project it's from. Changes show at once and save behind.
// `view`: set from outside (a folder block's header), which hides the tabs.
export function TaskBoard({ tasks: initial, projects, today, view: fixed }: { tasks: TaskItem[]; projects: BoardProject[]; today: string; view?: "board" | "list" }) {
  const t = useT();
  const [tasks, setTasks] = useState(initial);
  const [picked, setView] = useState<View>("board");
  const view = fixed ?? picked;
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<{ status: TaskStatus; before: string | null } | null>(null);
  const [, start] = useTransition();
  const many = projects.length > 1;
  const byId = new Map(projects.map((p) => [p.id, p]));

  // New data from the server (another tab, the home page) replaces ours.
  const key = initial.map((t) => `${t.id}${t.status}${t.title}${t.dueDate}${t.order}`).join();
  const seen = useRef(key);
  useEffect(() => {
    if (seen.current === key) return;
    seen.current = key;
    setTasks(initial);
  }, [key, initial]);

  const seq = useRef(0);
  const endOf = (s: TaskStatus) => Math.max(0, ...tasks.filter((t) => t.status === s).map((t) => t.order)) + 1;
  const column = (s: TaskStatus) => tasks.filter((t) => t.status === s).sort((a, b) => a.order - b.order);

  function change(id: string, data: { title?: string; status?: TaskStatus; dueDate?: string | null }) {
    setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, ...data, ...(data.status && data.status !== t.status ? { order: endOf(data.status) } : {}) } : t)));
    start(() => updateTask(id, data));
  }
  function remove(id: string) {
    setTasks((ts) => ts.filter((t) => t.id !== id));
    start(() => deleteTask(id));
  }
  function add(pursuitId: string, title: string, status: TaskStatus) {
    const temp = `new-${++seq.current}`;
    const order = endOf(status);
    setTasks((ts) => [...ts, { id: temp, title, status, dueDate: null, pursuitId, order }]);
    start(async () => {
      const id = await addTask(pursuitId, title, status);
      setTasks((ts) => (id ? ts.map((t) => (t.id === temp ? { ...t, id } : t)) : ts.filter((t) => t.id !== temp)));
    });
  }
  function drop() {
    const id = dragging;
    const target = over;
    setDragging(null);
    setOver(null);
    if (!id || !target) return;
    const moved = tasks.find((t) => t.id === id);
    if (!moved) return;
    const rest = column(target.status).filter((t) => t.id !== id);
    const at = target.before ? rest.findIndex((t) => t.id === target.before) : rest.length;
    rest.splice(at < 0 ? rest.length : at, 0, { ...moved, status: target.status });
    const order = new Map(rest.map((t, i) => [t.id, i]));
    setTasks((ts) => ts.map((t) => (order.has(t.id) ? { ...t, status: target.status, order: order.get(t.id)! } : t)));
    start(() => setColumn(target.status, rest.map((t) => t.id).filter((x) => !x.startsWith("new-"))));
  }

  const card = (t: TaskItem) => (
    <Card
      key={t.id}
      task={t}
      project={many ? byId.get(t.pursuitId) : undefined}
      today={today}
      onChange={(d) => change(t.id, d)}
      onDelete={() => remove(t.id)}
      dragProps={{
        draggable: true,
        onDragStart: (e: React.DragEvent) => {
          e.dataTransfer.effectAllowed = "move";
          setDragging(t.id);
        },
        onDragEnd: () => {
          setDragging(null);
          setOver(null);
        },
        onDragOver: (e: React.DragEvent) => {
          if (!dragging) return;
          e.preventDefault();
          e.stopPropagation();
          setOver({ status: t.status, before: t.id });
        },
      }}
      faded={dragging === t.id}
      lineAbove={over?.before === t.id && dragging !== t.id}
    />
  );

  return (
    <div className="flex flex-col gap-4">
      {!fixed && (
        <div className="flex gap-5 border-b border-[#ededeb] text-sm text-ink-faint">
          {(
            [
              ["board", "Tablero"],
              ["list", "Lista"],
              ...(many ? [["project", "Por proyecto"]] : []),
            ] as [View, string][]
          ).map(([v, label]) => (
            <button key={v} type="button" onClick={() => setView(v)} className={`-mb-px pb-2 ${view === v ? "border-b-2 border-ink font-medium text-ink" : "hover:text-ink"}`}>
              {label}
            </button>
          ))}
        </div>
      )}

      {view === "board" && (
        <div className="grid gap-3 md:grid-cols-3">
          {TASK_COLUMNS.map((c) => {
            const items = column(c.status);
            return (
              <section
                key={c.status}
                onDragOver={(e) => {
                  if (!dragging) return;
                  e.preventDefault();
                  setOver({ status: c.status, before: null });
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  drop();
                }}
                className={`flex flex-col gap-2 rounded-xl p-2.5 transition-colors ${over?.status === c.status && dragging ? "bg-[#efefec]" : "bg-[#f7f7f5]"}`}
              >
                <h3 className="flex items-center gap-2 px-1 pb-0.5 text-[13px] font-semibold">
                  <span className="size-2 rounded-full" style={{ background: c.dot }} />
                  {t(c.label)}
                  <span className="font-normal text-ink-faint">{items.length}</span>
                </h3>
                {items.map(card)}
                {over?.status === c.status && over.before === null && dragging && <span className="mx-1 h-0.5 rounded bg-[#337ea9]" />}
                <AddTask projects={projects} onAdd={(p, title) => add(p, title, c.status)} />
              </section>
            );
          })}
        </div>
      )}

      {view === "list" && (
        <div className="flex flex-col gap-2">
          {[...column("IN_PROGRESS"), ...column("TODO"), ...column("DONE")].map(card)}
          <AddTask projects={projects} onAdd={(p, title) => add(p, title, "TODO")} />
        </div>
      )}

      {view === "project" && (
        <div className="grid gap-3 md:grid-cols-2">
          {projects.map((p) => {
            const items = tasks.filter((t) => t.pursuitId === p.id).sort((a, b) => (a.status === "DONE" ? 1 : 0) - (b.status === "DONE" ? 1 : 0) || a.order - b.order);
            return (
              <section key={p.id} className="flex flex-col gap-2 rounded-xl bg-[#f7f7f5] p-2.5">
                <h3 className="flex items-center gap-2 px-1 text-[13px] font-semibold">
                  <Folder cover={p.cover as FolderCover} width={18} />
                  {p.title}
                </h3>
                {items.map((t) => (
                  <Card key={t.id} task={t} today={today} onChange={(d) => change(t.id, d)} onDelete={() => remove(t.id)} />
                ))}
                <AddTask projects={[p]} onAdd={(id, title) => add(id, title, "TODO")} />
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Card({
  task,
  project,
  today,
  onChange,
  onDelete,
  dragProps,
  faded,
  lineAbove,
}: {
  task: TaskItem;
  project?: BoardProject;
  today: string;
  onChange: (d: { title?: string; status?: TaskStatus; dueDate?: string | null }) => void;
  onDelete: () => void;
  dragProps?: React.HTMLAttributes<HTMLDivElement> & { draggable?: boolean };
  faded?: boolean;
  lineAbove?: boolean;
}) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const done = task.status === "DONE";
  const due = task.dueDate ? dueLabel(task.dueDate, today) : null;
  return (
    <>
      {lineAbove && <span className="mx-1 h-0.5 rounded bg-[#337ea9]" />}
      <div
        {...dragProps}
        className={`group flex items-start gap-2.5 rounded-lg bg-white px-3 py-2.5 text-sm shadow-[0_0_0_1px_rgba(15,15,15,.06),0_1px_2px_rgba(15,15,15,.04)] ${faded ? "opacity-40" : ""}`}
      >
        <button
          type="button"
          onClick={() => onChange({ status: done ? "TODO" : "DONE" })}
          aria-label={done ? t("Marcar como pendiente") : t("Marcar como hecha")}
          className={`mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border-[1.5px] text-[9px] text-white ${done ? "border-[#448361] bg-[#448361]" : "border-[#c7c6c2] hover:border-[#448361]"}`}
        >
          {done && "✓"}
        </button>
        <div className="min-w-0 flex-1">
          {editing ? (
            <input
              autoFocus
              defaultValue={task.title}
              onBlur={(e) => {
                setEditing(false);
                if (e.target.value.trim() && e.target.value !== task.title) onChange({ title: e.target.value });
              }}
              onKeyDown={(e) => (e.key === "Enter" ? (e.target as HTMLInputElement).blur() : e.key === "Escape" && setEditing(false))}
              aria-label={t("Tarea")}
              className="w-full rounded border border-border-subtle px-1 outline-none"
            />
          ) : (
            <span onClick={() => setEditing(true)} className={`cursor-text ${done ? "text-ink-faint line-through" : ""}`}>
              {task.title}
            </span>
          )}
          {(project || due) && (
            <span className="mt-1 flex items-center gap-1.5 text-xs text-ink-faint">
              {project && (
                <>
                  <Folder cover={project.cover as FolderCover} width={15} />
                  <span className="truncate">{project.title}</span>
                </>
              )}
              {due && !done && <span className={`ml-auto shrink-0 ${due.late || due.text === "hoy" ? "text-[#c4554d]" : ""}`}>{due.text}</span>}
            </span>
          )}
        </div>
        <span className="flex shrink-0 items-center gap-0.5 opacity-40 group-hover:opacity-100">
          <label title={t("Fecha")} className="relative grid size-6 cursor-pointer place-items-center rounded text-ink-faint hover:bg-chip hover:text-ink">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <rect x="3.5" y="5" width="17" height="15" rx="2" />
              <path d="M3.5 10h17M8 3v4M16 3v4" />
            </svg>
            <input
              type="date"
              value={task.dueDate ?? ""}
              onChange={(e) => onChange({ dueDate: e.target.value || null })}
              aria-label={t("Fecha límite")}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
          </label>
          <button type="button" onClick={onDelete} title={t("Eliminar")} aria-label={t("Eliminar tarea")} className="grid size-6 place-items-center rounded text-ink-faint hover:bg-chip hover:text-red-600">
            ×
          </button>
        </span>
      </div>
    </>
  );
}

function AddTask({ projects, onAdd }: { projects: BoardProject[]; onAdd: (pursuitId: string, title: string) => void }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [project, setProject] = useState(projects[0]?.id ?? "");
  if (projects.length === 0) return null;
  return open ? (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const input = e.currentTarget.elements.namedItem("title") as HTMLInputElement;
        if (input.value.trim()) onAdd(project, input.value.trim());
        input.value = "";
      }}
      className="flex flex-col gap-1.5 rounded-lg bg-white p-2 shadow-[0_0_0_1px_rgba(15,15,15,.08)]"
    >
      <input name="title" autoFocus placeholder={t("Nueva tarea")} aria-label={t("Nueva tarea")} onKeyDown={(e) => e.key === "Escape" && setOpen(false)} onBlur={(e) => !e.target.value && projects.length === 1 && setOpen(false)} className="px-1 text-sm outline-none" />
      {projects.length > 1 && (
        <select value={project} onChange={(e) => setProject(e.target.value)} aria-label={t("Proyecto")} className="rounded bg-chip px-1.5 py-0.5 text-xs">
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
      )}
    </form>
  ) : (
    <button type="button" onClick={() => setOpen(true)} className="rounded-md px-1.5 py-1 text-left text-[13px] text-ink-faint hover:bg-white/70 hover:text-ink">
      {t("+ Tarea")}
    </button>
  );
}
