"use client";

import { useState, useTransition } from "react";
import { TypeSelect } from "../TypeSelect";
import { updatePursuitMeta } from "./actions";

const TYPE_LABEL: Record<string, string> = {
  PROJECT: "Project",
  BOOK: "Book",
  LANGUAGE: "Language",
  SKILL: "Skill",
  OTHER: "Other",
};

const STATUS_OPTIONS = ["ACTIVE", "PAUSED", "DONE"];

// Same 3-color set as the Pursuits dashboard cards (see PursuitsBoard.tsx),
// pulled from nadia-lagoa.vercel.app's own project cards. This dot is a
// single identity marker rather than a full card, so — unlike the board,
// which colors by position within a section — it just cycles the 3
// colors by type so a given type always shows the same dot here.
const TYPE_ORDER = ["PROJECT", "BOOK", "LANGUAGE", "SKILL", "OTHER"];
const TYPE_DOT_COLORS = ["bg-flame", "bg-crimson", "bg-cobalt"];
function typeDot(type: string) {
  const i = TYPE_ORDER.indexOf(type);
  return TYPE_DOT_COLORS[(i < 0 ? 0 : i) % TYPE_DOT_COLORS.length];
}

// Type and status were only ever set at creation — this makes that same
// dot + label line double as an inline editor, toggled by clicking it.
export function PursuitMeta({
  pursuitId,
  type,
  customType,
  status,
  sectionName,
  availableSections,
}: {
  pursuitId: string;
  type: string;
  customType: string | null;
  status: string;
  sectionName: string | null;
  availableSections: string[];
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, startTransition] = useTransition();

  const typeLabel = type === "OTHER" && customType ? customType : TYPE_LABEL[type];

  if (!isEditing) {
    return (
      <button
        type="button"
        onClick={() => setIsEditing(true)}
        className="flex items-center gap-2"
      >
        <span
          className={`h-2 w-2 rounded-full ${
            status === "ACTIVE" ? typeDot(type) : "bg-ink-faint"
          }`}
        />
        <span className="text-sm text-ink-muted hover:text-ink hover:underline">
          {typeLabel} · {status.toLowerCase()}
          {sectionName && ` · ${sectionName}`}
        </span>
      </button>
    );
  }

  return (
    <form
      action={(formData) => {
        startTransition(async () => {
          await updatePursuitMeta(pursuitId, formData);
          setIsEditing(false);
        });
      }}
      className="flex flex-wrap items-center gap-2"
    >
      <TypeSelect defaultType={type} defaultCustomType={customType ?? ""} />
      <select
        name="status"
        defaultValue={status}
        className="rounded-md border border-border-subtle bg-white px-3 py-2 text-sm text-ink"
      >
        {STATUS_OPTIONS.map((s) => (
          <option key={s} value={s}>
            {s.toLowerCase()}
          </option>
        ))}
      </select>
      <input
        type="text"
        name="section"
        list="pursuit-sections"
        defaultValue={sectionName ?? ""}
        placeholder="Section (optional)"
        className="rounded-md border border-border-subtle bg-white px-3 py-2 text-sm text-ink"
      />
      <datalist id="pursuit-sections">
        {availableSections.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      <button
        type="submit"
        disabled={isPending}
        className="text-xs font-semibold text-accent disabled:opacity-50"
      >
        Save
      </button>
      <button
        type="button"
        onClick={() => setIsEditing(false)}
        className="text-xs text-ink-faint hover:text-ink"
      >
        Cancel
      </button>
    </form>
  );
}
