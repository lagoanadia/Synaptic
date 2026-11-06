"use client";

import { KanbanIcon } from "@/app/icons";
import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createProject, deleteProject } from "./actions";
import { DeleteButton } from "../DeleteButton";

export type ProjectForDisplay = {
  id: string;
  title: string;
  dueDate: string | null;
  totalCards: number;
  doneCards: number;
};

function daysUntil(dueDate: string) {
  const diff = new Date(dueDate).getTime() - Date.now();
  return Math.ceil(diff / 86400000);
}

function DueBadge({ dueDate }: { dueDate: string }) {
  const days = daysUntil(dueDate);
  const label = new Date(dueDate).toLocaleDateString("es-ES", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
  });
  const overdue = days < 0;
  const soon = days >= 0 && days <= 3;
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${
        overdue
          ? "bg-crimson-soft text-crimson"
          : soon
            ? "bg-gold-soft text-ink"
            : "bg-chip text-ink-muted"
      }`}
    >
      {overdue ? `Atrasado · ${label}` : `Entrega ${label}`}
    </span>
  );
}

function ProjectCardTile({ pursuitId, project }: { pursuitId: string; project: ProjectForDisplay }) {
  const pct =
    project.totalCards === 0 ? 0 : Math.round((project.doneCards / project.totalCards) * 100);
  return (
    <div className="group relative flex flex-col gap-3 rounded-2xl border border-border-subtle bg-white p-4 transition-shadow hover:shadow-[0_8px_16px_rgba(13,13,13,0.08)]">
      <DeleteButton
        action={deleteProject.bind(null, pursuitId, project.id)}
        confirmMessage={`¿Eliminar "${project.title}"? Se borran también su tablero y tarjetas — no se puede deshacer.`}
        className="absolute top-3 right-3 text-ink-faint opacity-0 hover:text-red-500 group-hover:opacity-100"
      >
        ×
      </DeleteButton>
      <Link href={`/pursuits/${pursuitId}/projects/${project.id}`} className="flex flex-col gap-3">
        <p className="pr-5 text-sm font-semibold text-ink">{project.title}</p>
        <div className="flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-chip">
            <div
              className="h-full rounded-full bg-accent transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-xs text-ink-faint">{pct}%</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-ink-faint">
            {project.doneCards}/{project.totalCards} done
          </span>
          {project.dueDate && <DueBadge dueDate={project.dueDate} />}
        </div>
      </Link>
    </div>
  );
}

// One deliverable with a deadline and its own Kanban board
// (projects/[projectId]/ProjectBoard.tsx).
export function ProjectsBoard({
  pursuitId,
  projects,
}: {
  pursuitId: string;
  projects: ProjectForDisplay[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col gap-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const title = titleRef.current?.value.trim();
          if (!title) return;
          const dueDate = dateRef.current?.value || null;
          setError(null);
          startTransition(async () => {
            try {
              const id = await createProject(pursuitId, title, dueDate);
              router.push(`/pursuits/${pursuitId}/projects/${id}`);
            } catch {
              setError("No se ha podido crear el proyecto — inténtalo de nuevo");
            }
          });
        }}
        className="flex flex-wrap items-center gap-2"
      >
        <input
          ref={titleRef}
          type="text"
          placeholder="Título del proyecto"
          required
          disabled={isPending}
          className="flex-1 rounded-xl border border-border-subtle bg-white px-3.5 py-2.5 text-sm disabled:opacity-50"
        />
        <input
          ref={dateRef}
          type="date"
          title="Fecha de entrega (opcional)"
          disabled={isPending}
          className="rounded-xl border border-border-subtle bg-white px-3 py-2.5 text-sm disabled:opacity-50"
        />
        <span
          title="La única plantilla por ahora"
          className="rounded-full bg-accent-soft px-3 py-2 text-xs font-semibold text-accent whitespace-nowrap"
        >
          <KanbanIcon size={14} /> Kanban
        </span>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold whitespace-nowrap text-white transition-transform hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-50"
        >
          + Nuevo
        </button>
      </form>
      {error && <p className="text-xs text-red-500">{error}</p>}

      {projects.length === 0 ? (
null
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <ProjectCardTile key={p.id} pursuitId={pursuitId} project={p} />
          ))}
        </div>
      )}
    </div>
  );
}
