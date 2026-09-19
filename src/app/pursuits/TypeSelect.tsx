"use client";

import { useState } from "react";

const OPTIONS = [
  { value: "PROJECT", label: "Project" },
  { value: "BOOK", label: "Book" },
  { value: "LANGUAGE", label: "Language" },
  { value: "SKILL", label: "Skill" },
  { value: "OTHER", label: "Other (custom)" },
];

// Client Component because it needs local state to show/hide the custom
// label input — the rest of the page around it stays a Server Component.
export function TypeSelect() {
  const [type, setType] = useState("PROJECT");

  return (
    <div className="flex gap-2">
      <select
        name="type"
        value={type}
        onChange={(e) => setType(e.target.value)}
        className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
      >
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {type === "OTHER" && (
        <input
          type="text"
          name="customType"
          placeholder="Name your own type"
          required
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
      )}
    </div>
  );
}
