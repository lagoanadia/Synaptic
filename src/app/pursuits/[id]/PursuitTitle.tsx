"use client";

import { useState, useTransition } from "react";
import { renamePursuit } from "./actions";

// Click to rename.
export function PursuitTitle({
  pursuitId,
  title,
  className = "text-2xl font-semibold",
}: {
  pursuitId: string;
  title: string;
  className?: string;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(title);
  const [isPending, startTransition] = useTransition();

  function startEditing() {
    setValue(title);
    setIsEditing(true);
  }

  function cancel() {
    setValue(title);
    setIsEditing(false);
  }

  function save() {
    const trimmed = value.trim();
    if (!trimmed || trimmed === title) {
      cancel();
      return;
    }
    startTransition(async () => {
      await renamePursuit(pursuitId, trimmed);
      setIsEditing(false);
    });
  }

  if (!isEditing) {
    return (
      <button
        type="button"
        onClick={startEditing}
        className={`text-left hover:underline ${className}`}
      >
        {title}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            save();
          }
          if (e.key === "Escape") cancel();
        }}
        autoFocus
        disabled={isPending}
        className="flex-1 rounded-md border border-border-subtle bg-white px-2 py-1 text-2xl font-semibold outline-none disabled:opacity-50"
      />
      <button
        type="button"
        onClick={save}
        disabled={isPending}
        className="text-xs font-semibold text-accent disabled:opacity-50"
      >
        Save
      </button>
      <button
        type="button"
        onClick={cancel}
        disabled={isPending}
        className="text-xs text-ink-faint hover:text-ink"
      >
        Cancel
      </button>
    </div>
  );
}
