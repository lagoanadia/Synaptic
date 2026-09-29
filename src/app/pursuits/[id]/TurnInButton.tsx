"use client";

import { useState, useTransition } from "react";
import { listPursuitDeadlines } from "./actions";
import type { ClassroomDeadline } from "@/lib/googleClassroom";

// Shared by a note card (MergeControls) and a Brain Dump's own page: pick
// which pending Classroom assignment this note/dump fulfills, then hand
// off to whichever turnIn*ToClassroom action the caller wired up. The
// picker's own list (pending work for the linked course) is the same
// regardless of what's being submitted, so it's fetched here once, lazily
// — only once someone actually opens the picker, not on every page load.
export function TurnInButton({
  pursuitId,
  onSubmit,
}: {
  pursuitId: string;
  onSubmit: (courseWorkId: string) => Promise<{ error: string | null; success?: boolean }>;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<ClassroomDeadline[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  // Which assignment's button is mid-submit — not a plain boolean, since
  // isSubmitting from useTransition is shared across every button in the
  // list: with that, clicking one assignment made every OTHER pending
  // assignment's button say "Turning in…" too, even though only the
  // clicked one was actually doing anything.
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    setMessage(null);
    if (pending !== null) return; // Already fetched once this session.
    const result = await listPursuitDeadlines(pursuitId);
    if (result.error) {
      setLoadError(result.error);
      return;
    }
    setPending((result.deadlines ?? []).filter((d) => !d.turnedIn));
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={toggle}
        className="text-xs whitespace-nowrap text-ink-faint hover:text-ink"
      >
        Turn in ▾
      </button>
      {open && (
        <div className="absolute right-0 z-10 mt-1 w-64 rounded-md border border-border-subtle bg-white p-2 text-xs shadow-sm">
          {message ? (
            <p className={message.ok ? "text-forest" : "text-red-500"}>{message.text}</p>
          ) : (
            <>
              {loadError && <p className="text-red-500">{loadError}</p>}
              {pending === null && !loadError && (
                <p className="text-ink-faint">Loading assignments…</p>
              )}
              {pending?.length === 0 && (
                <p className="text-ink-faint">
                  Nothing pending — everything&apos;s already turned in.
                </p>
              )}
              {pending?.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  disabled={submittingId !== null}
                  onClick={() => {
                    setSubmittingId(d.id);
                    startTransition(async () => {
                      const result = await onSubmit(d.id);
                      setSubmittingId(null);
                      setMessage(
                        result.error
                          ? { text: result.error, ok: false }
                          : { text: `Turned in to "${d.title}" ✓`, ok: true },
                      );
                    });
                  }}
                  className="block w-full truncate rounded px-2 py-1 text-left hover:bg-chip disabled:opacity-50"
                >
                  {submittingId === d.id ? "Turning in…" : d.title}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
