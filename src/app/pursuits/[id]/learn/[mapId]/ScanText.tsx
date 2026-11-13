"use client";

import { useT } from "@/app/LangProvider";
import { Fragment } from "react";

// Short AI text made easy to scan: "- " lines as a list, **bold**,
// `code` as a chip, and a leading [fuera] as a "not in your notes" tag.
function inline(text: string) {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <b key={i} className="font-semibold text-ink">{part.slice(2, -2)}</b>
    ) : part.startsWith("`") && part.endsWith("`") && part.length > 2 ? (
      <code key={i} className="rounded bg-[#1e1e2e]/[0.07] px-1.5 py-0.5 font-mono text-[0.88em] text-[#7c3aed]">{part.slice(1, -1)}</code>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}

export function ScanText({ text, className = "" }: { text: string; className?: string }) {
  const t = useT();
  let body = text.trim();
  const outside = /^\[fuera\]\s*/i.test(body) || /^nota: la fuente no cubre[^.;]*[.;]\s*/i.test(body);
  body = body.replace(/^\[fuera\]\s*/i, "").replace(/^nota: la fuente no cubre[^.;]*[.;]\s*/i, "");
  // Group lines: runs of "- " lines become one list, the rest paragraphs.
  const groups: { list: boolean; lines: string[] }[] = [];
  for (const raw of body.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const item = /^[-•*]\s+/.test(line);
    const last = groups[groups.length - 1];
    if (last && last.list === item && item) last.lines.push(line.replace(/^[-•*]\s+/, ""));
    else groups.push({ list: item, lines: [item ? line.replace(/^[-•*]\s+/, "") : line] });
  }
  return (
    <div className={`flex flex-col gap-2 leading-relaxed ${className}`}>
      {outside && (
        <span className="w-fit rounded-full bg-[#fdf3c4] px-2.5 py-0.5 text-xs font-medium text-[#8a6d00]">{t("Fuera de tus apuntes")}</span>
      )}
      {groups.map((g, i) =>
        g.list ? (
          <ul key={i} className="flex flex-col gap-1.5">
            {g.lines.map((l, j) => (
              <li key={j} className="flex gap-2.5">
                <span className="mt-[0.6em] size-1.5 shrink-0 rounded-full bg-accent" />
                <span>{inline(l)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p key={i}>{inline(g.lines[0])}</p>
        ),
      )}
    </div>
  );
}
