"use client";

import { CheckIcon } from "@/app/icons";
import { useEffect, useState } from "react";
import { listPursuitDeadlines } from "./actions";
import { NotificationToggle } from "./NotificationToggle";
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
    listPursuitDeadlines(pursuitId)
      .then((result) => {
        if (!cancelled) {
          setDeadlines(result.deadlines ?? []);
          setNow(Date.now());
        }
      })
      // Background fetch: never surface a failure.
      .catch(() => {
        if (!cancelled) {
          setDeadlines([]);
          setNow(Date.now());
        }
      });
    return () => {
      cancelled = true;
    };
  }, [pursuitId, hasCourse]);

  // Hidden until a course is linked; then it stays to hold the reminders toggle.
  if (!hasCourse || !deadlines || now === null) return null;

  // Pending work first, soonest due first.
  const pending = deadlines.filter((d) => !d.turnedIn);
  const done = deadlines.filter((d) => d.turnedIn);
  const ordered = [...pending, ...done].slice(0, 5);

  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-border-subtle bg-white p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-ink-faint">
          Próximas entregas de Classroom
          {deadlines.length > 0 && (
            <span className="font-normal text-ink-faint">
              {" "}
              · {pending.length} pending
            </span>
          )}
        </span>
        <NotificationToggle />
      </div>
      {deadlines.length === 0 && (
        <p className="text-xs text-ink-muted">Nada pendiente pronto.</p>
      )}
      {ordered.map((d) => {
        const overdue = !d.turnedIn && d.dueAt.getTime() < now;
        return (
          <a
            key={d.id}
            href={d.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between gap-3 text-sm hover:underline"
          >
            <span className="truncate">{d.title}</span>
            {d.turnedIn ? (
              <span
                className={`shrink-0 text-xs ${d.late ? "text-amber-600" : "text-forest"}`}
              >
                <CheckIcon size={12} /> {d.late ? "Tarde" : "Hecho"}
              </span>
            ) : (
              <span
                className={`shrink-0 text-xs ${overdue ? "text-red-500" : "text-ink-faint"}`}
              >
                {overdue ? "Atrasada · " : "Entrega "}
                {d.dueAt.toLocaleDateString("es-ES", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
              </span>
            )}
          </a>
        );
      })}
    </div>
  );
}
