"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useT } from "@/app/LangProvider";
import { MiniNotebook } from "@/app/Covers";
import type { NotebookCover } from "@/lib/covers";
import { toggleNotebookTodo } from "./actions";

export type HomeTodoGroup = { sectionId: string; name: string; cover: NotebookCover; items: { blockId: string; id: string; text: string; depth: number; doing?: boolean }[] };

// "Por hacer" on the home page: what's still open in every notebook's to-do
// lists. Ticking one here ticks it in its notebook too.
export function HomeTodos({ groups }: { groups: HomeTodoGroup[] }) {
  const t = useT();
  const [done, setDone] = useState<Set<string>>(new Set());
  const [, start] = useTransition();
  if (groups.length === 0) return null;
  return (
    <section className="flex flex-col gap-3">
      <h2 className="border-b border-border-subtle pb-2 text-sm font-semibold">{t("Por hacer")}</h2>
      <div className="grid grid-cols-1 gap-x-10 gap-y-4 md:grid-cols-2">
        {groups.map((g) => (
          <div key={g.sectionId} className="flex flex-col">
            <Link href={`/pursuits/s/${g.sectionId}`} className="mb-1 flex items-center gap-2 text-xs font-medium text-ink-muted hover:text-ink">
              <MiniNotebook cover={g.cover} size={12} />
              {g.name}
            </Link>
            <ul className="flex flex-col">
              {g.items.map((it) => {
                const ticked = done.has(it.id);
                return (
                  <li key={it.id} className="flex items-center gap-2.5 rounded-md py-1 pr-1" style={{ paddingLeft: 4 + it.depth * 22 }}>
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={ticked}
                      aria-label={it.text}
                      onClick={() => {
                        setDone((d) => {
                          const n = new Set(d);
                          if (ticked) n.delete(it.id);
                          else n.add(it.id);
                          return n;
                        });
                        start(() => toggleNotebookTodo(g.sectionId, it.blockId, it.id, !ticked));
                      }}
                      className={`grid size-4 shrink-0 place-items-center rounded-[4px] border-[1.5px] text-[10px] text-white ${ticked ? "border-accent bg-accent" : "border-[#c7c6c2] hover:border-accent"}`}
                    >
                      {ticked && "✓"}
                    </button>
                    <span className={`text-sm ${ticked ? "text-ink-faint line-through" : "text-ink"}`}>{it.text}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
