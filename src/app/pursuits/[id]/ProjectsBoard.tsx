"use client";

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
  const label = new Date(dueDate).toLocaleDateString("en-US", {
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
      {overdue ? `Overdue · ${label}` : `Due ${label}`}
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
        confirmMessage={`Delete "${project.title}"? Its board and cards go with it — this can't be undone.`}
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

// A Project is a different axis from Brain Dump/Organized — one concrete
// deliverable with a deadline, tracked on its own Kanban board (see
// projects/[projectId]/ProjectBoard.tsx), not raw capture. The template
// picker only has one real option today (Kanban); it's still shown as its
// own badge, not silently assumed, so a second template later (a plain
// checklist, say) is just another option here instead of a new concept.
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
              setError("Couldn't create that project — try again");
            }
          });
        }}
        className="flex flex-wrap items-center gap-2"
      >
        <input
          ref={titleRef}
          type="text"
          placeholder="New project title"
          required
          disabled={isPending}
          className="flex-1 rounded-xl border border-border-subtle bg-white px-3.5 py-2.5 text-sm disabled:opacity-50"
        />
        <input
          ref={dateRef}
          type="date"
          title="Due date (optional)"
          disabled={isPending}
          className="rounded-xl border border-border-subtle bg-white px-3 py-2.5 text-sm disabled:opacity-50"
        />
        <span
          title="The only board template today — more can be added later"
          className="rounded-full bg-accent-soft px-3 py-2 text-xs font-semibold text-accent whitespace-nowrap"
        >
          📋 Kanban
        </span>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold whitespace-nowrap text-white transition-transform hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-50"
        >
          + New
        </button>
      </form>
      {error && <p className="text-xs text-red-500">{error}</p>}

      {projects.length === 0 ? (
        <p className="text-sm text-ink-muted">
          No projects yet — give one a title above to start its board.
        </p>
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
