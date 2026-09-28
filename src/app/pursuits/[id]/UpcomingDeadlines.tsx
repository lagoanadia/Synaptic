"use client";

import { useEffect, useState } from "react";
import { listPursuitDeadlines } from "./actions";
import type { ClassroomDeadline } from "@/lib/googleClassroom";

// Sits above the tabs, not inside Files — a deadline is time-sensitive
// info you want to see no matter which tab you're on, not something
// filed away next to static attachments.
export function UpcomingDeadlines({
  pursuitId,
  hasCourse,
}: {
  pursuitId: string;
  hasCourse: boolean;
}) {
  const [deadlines, setDeadlines] = useState<ClassroomDeadline[] | null>(null);
  // Captured alongside the fetch, not read via Date.now() during render —
  // render has to stay a pure function of props/state.
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    if (!hasCourse) return;
    let cancelled = false;
    listPursuitDeadlines(pursuitId).then((result) => {
      if (!cancelled) {
        setDeadlines(result.deadlines ?? []);
        setNow(Date.now());
      }
    });
    return () => {
      cancelled = true;
    };
  }, [pursuitId, hasCourse]);

  // Silent by default: no course linked, still loading, the fetch failed
  // (an expired connection here is a "try again later" case, not worth a
  // banner for a passive glance-only widget), or genuinely nothing due.
  if (!hasCourse || !deadlines || now === null || deadlines.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-border-subtle bg-white p-3">
      <span className="text-xs font-semibold text-ink-faint">Upcoming from Classroom</span>
      {deadlines.slice(0, 3).map((d) => {
        const overdue = d.dueAt.getTime() < now;
        return (
          <a
            key={d.id}
            href={d.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between gap-3 text-sm hover:underline"
          >
            <span className="truncate">{d.title}</span>
            <span
              className={`shrink-0 text-xs ${overdue ? "text-red-500" : "text-ink-faint"}`}
            >
              {overdue ? "Overdue · " : "Due "}
              {d.dueAt.toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
            </span>
          </a>
        );
      })}
    </div>
  );
}
