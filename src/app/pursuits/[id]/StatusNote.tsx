"use client";

import { useRef, useState, useTransition } from "react";
import { updateStatusNote } from "./actions";

// Grows with content instead of scrolling internally, same trick as the
// Brain Dump composer's textarea — collapsing to "auto" first keeps a
// shrinking edit (deleting lines) from leaving dead white space below.
function autoResize(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

// A quick scratchpad right on the Pursuit itself — current status,
// pending items, whatever doesn't belong in a Brain Dump page — saved
// as plain text with no markup, no history, just a sticky note. Saves
// on blur (clicking away), not on every keystroke, so it doesn't fight
// the drafting rhythm of actually writing a few lines.
export function StatusNote({
  pursuitId,
  initialNote,
}: {
  pursuitId: string;
  initialNote: string | null;
}) {
  const [value, setValue] = useState(initialNote ?? "");
  const [isPending, startTransition] = useTransition();
  const savedRef = useRef(initialNote ?? "");

  function save() {
    if (value === savedRef.current) return;
    savedRef.current = value;
    startTransition(() => updateStatusNote(pursuitId, value));
  }

  return (
    <textarea
      value={value}
      onChange={(e) => {
        setValue(e.target.value);
        autoResize(e.target);
      }}
      onBlur={save}
      placeholder="Quick notes — current status, what's pending…"
      rows={1}
      disabled={isPending}
      className="w-full resize-none overflow-hidden rounded-xl border border-dashed border-border-subtle bg-callout px-4 py-3 text-sm leading-relaxed text-ink outline-none placeholder:text-ink-faint disabled:opacity-50"
    />
  );
}
