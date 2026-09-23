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
// Used both when creating a pursuit (no defaults) and when editing one's
// type afterward (defaultType/defaultCustomType prefill it).
export function TypeSelect({
  defaultType = "PROJECT",
  defaultCustomType = "",
}: {
  defaultType?: string;
  defaultCustomType?: string;
}) {
  const [type, setType] = useState(defaultType);

  return (
    <div className="flex gap-2">
      <select
        name="type"
        value={type}
        onChange={(e) => setType(e.target.value)}
        className="rounded-md border border-border-subtle bg-white px-3 py-2 text-sm text-ink"
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
          defaultValue={defaultCustomType}
          placeholder="Name your own type"
          required
          className="rounded-md border border-border-subtle bg-white px-3 py-2 text-sm text-ink"
        />
      )}
    </div>
  );
}
