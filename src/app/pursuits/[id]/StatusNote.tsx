"use client";

import { useT } from "@/app/LangProvider";
import { useRef, useState, useTransition } from "react";
import { updateStatusNote } from "./actions";

// Grows with content instead of scrolling internally, same trick as the
// Brain Dump composer's textarea — collapsing to "auto" first keeps a
// shrinking edit (deleting lines) from leaving dead white space below.
function autoResize(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

// Sticky note on the subject. Saves on blur.
export function StatusNote({
  pursuitId,
  initialNote,
}: {
  pursuitId: string;
  initialNote: string | null;
}) {
  const t = useT();
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
      placeholder={t("Cómo va, qué queda pendiente…")}
      rows={1}
      disabled={isPending}
      className="min-h-24 w-full resize-none overflow-hidden bg-transparent text-[15px] leading-relaxed text-ink outline-none placeholder:text-[#a08a4f] disabled:opacity-50"
    />
  );
}
