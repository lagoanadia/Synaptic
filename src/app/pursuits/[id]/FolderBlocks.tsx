"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, CheckIcon, KanbanIcon, MenuIcon, XIcon } from "@/app/icons";
import { FOLDER_BLOCK_TYPES, newBlock, type FolderBlock } from "@/lib/blocks";
import { saveFolderBlocks, setGroupLabel } from "./actions";

const LABEL = Object.fromEntries(FOLDER_BLOCK_TYPES.map((t) => [t.type, t.label]));
const SUGGESTED = ["Tema", "Unidad", "Bloque", "Parcial", "Semana"];

// A folder's page: blocks (Páginas, Mapa, Repaso…) you arrange in
// "Editar" mode. Content is rendered on the server per block id; any
// change saves and refreshes it.
export function FolderBlocks({
  pursuitId,
  blocks: initial,
  study,
  grouped,
  content,
  summaries = {},
  editing,
}: {
  pursuitId: string;
  blocks: FolderBlock[];
  study: boolean;
  // Does it have groups (units/themes)? Board view needs them.
  grouped: boolean;
  content: Record<string, React.ReactNode>;
  // A short line next to a block's title ("1 de 4 hechas").
  summaries?: Record<string, string>;
  editing: boolean;
}) {
  const [blocks, setBlocks] = useState(initial);
  const [adding, setAdding] = useState(false);
  const [grouping, setGrouping] = useState(false);
  const [label, setLabel] = useState("Tema");
  const [, start] = useTransition();
  const router = useRouter();
  const available = FOLDER_BLOCK_TYPES.filter((t) => study || !t.study);

  function save(next: FolderBlock[]) {
    setBlocks(next);
    start(async () => {
      await saveFolderBlocks(pursuitId, next);
      router.refresh();
    });
  }
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= blocks.length) return;
    const next = [...blocks];
    [next[i], next[j]] = [next[j], next[i]];
    save(next);
  };

  return (
    <div className="flex flex-col gap-10">
      {blocks.map((b, i) => {
        const view = b.view ?? (grouped ? "board" : "list");
        // A project's tasks sit in their own card, so they stand apart from the rest.
        const card = b.type === "project";
        const outline = editing ? "outline-[1.5px] outline-offset-4 outline-[#d3d1cb] outline-dashed" : "";
        return (
          <section
            key={b.id}
            className={
              card
                ? `relative rounded-xl border border-border-subtle bg-white shadow-[0_1px_2px_rgba(0,0,0,.04)] ${outline}`
                : `relative flex flex-col gap-3 ${editing ? `rounded-lg p-3 ${outline}` : ""}`
            }
          >
            <header className={card ? "flex items-center gap-3 rounded-t-xl border-b border-border-subtle bg-callout px-5 py-3" : "flex items-center gap-2 border-b border-border-subtle pb-2"}>
              {card && (
                <span className="grid size-8 place-items-center rounded-lg bg-white text-ink shadow-[0_0_0_1px_rgba(55,53,47,.09)]">
                  <CheckIcon size={15} />
                </span>
              )}
              <h2 className={card ? "text-[17px] font-semibold" : "flex-1 text-sm font-semibold"}>{LABEL[b.type]}</h2>
              {card && <span className="flex-1 text-sm text-ink-faint">{summaries[b.id]}</span>}
              {card && !editing && (
                <span className="flex rounded-md bg-white p-0.5 shadow-[0_0_0_1px_rgba(55,53,47,.09)]" role="group" aria-label="Vista">
                  {(
                    [
                      ["board", "Tablero", KanbanIcon],
                      ["list", "Lista", MenuIcon],
                    ] as const
                  ).map(([v, label, Icon]) => {
                    const on = (b.view ?? "board") === v;
                    return (
                      <button
                        key={v}
                        type="button"
                        title={label}
                        aria-label={label}
                        aria-pressed={on}
                        onClick={() => !on && save(blocks.map((x) => (x.id === b.id ? { ...x, view: v } : x)))}
                        className={`grid size-7 place-items-center rounded ${on ? "bg-chip text-ink" : "text-ink-faint hover:text-ink"}`}
                      >
                        <Icon size={15} />
                      </button>
                    );
                  })}
                </span>
              )}
              {b.type === "pages" && !editing && (
                <span className="relative flex items-center gap-2">
                  {!grouped && (
                    <button type="button" onClick={() => setGrouping((g) => !g)} className="rounded-md bg-chip px-2 py-1 text-xs text-ink-muted hover:text-ink">
                      ⊞ Agrupar…
                    </button>
                  )}
                  {grouped && (
                    <span className="flex rounded-md bg-chip p-0.5 text-xs" role="group" aria-label="Vista">
                      {(["list", "board"] as const).map((v) => (
                        <button
                          key={v}
                          type="button"
                          aria-pressed={view === v}
                          onClick={() => view !== v && save(blocks.map((x) => (x.id === b.id ? { ...x, view: v } : x)))}
                          className={`rounded px-2.5 py-0.5 ${view === v ? "bg-white font-medium text-ink shadow-sm" : "text-ink-muted"}`}
                        >
                          {v === "list" ? "Lista" : "Tablero"}
                        </button>
                      ))}
                    </span>
                  )}
                  {grouping && (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        start(async () => {
                          const r = await setGroupLabel(pursuitId, label);
                          if (!r.error) {
                            setGrouping(false);
                            save(blocks.map((x) => (x.id === b.id ? { ...x, view: "board" } : x)));
                          }
                        });
                      }}
                      className="absolute top-full right-0 z-10 mt-2 flex w-72 flex-col gap-3 rounded-xl bg-white p-4 text-sm shadow-[0_0_0_1px_rgba(15,15,15,.05),0_10px_30px_rgba(15,15,15,.15)]"
                    >
                      <b className="font-semibold">Agrupar páginas por…</b>
                      <span className="flex flex-wrap gap-1.5">
                        {SUGGESTED.map((s) => (
                          <button key={s} type="button" onClick={() => setLabel(s)} className={`rounded-full px-2.5 py-0.5 text-xs ${label === s ? "bg-ink text-white" : "bg-chip"}`}>
                            {s}
                          </button>
                        ))}
                      </span>
                      <input value={label} onChange={(e) => setLabel(e.target.value)} aria-label="Nombre del grupo" className="rounded-md border border-border-subtle px-2.5 py-1.5" />
                      <button type="submit" className="rounded-md bg-accent px-3 py-1.5 font-medium text-white">
                        Agrupar
                      </button>
                    </form>
                  )}
                </span>
              )}
              {editing && (
                <span className="flex items-center gap-1">
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} title="Subir" className="rounded p-1 text-ink-faint hover:bg-chip disabled:opacity-30">
                    <ArrowDown size={14} className="block rotate-180" />
                  </button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === blocks.length - 1} title="Bajar" className="rounded p-1 text-ink-faint hover:bg-chip disabled:opacity-30">
                    <ArrowDown size={14} className="block" />
                  </button>
                  <button type="button" onClick={() => save(blocks.filter((x) => x.id !== b.id))} title="Quitar" className="rounded p-1 text-ink-faint hover:bg-chip hover:text-red-600">
                    <XIcon size={14} className="block" />
                  </button>
                </span>
              )}
            </header>
            {card ? <div className="p-5">{content[b.id]}</div> : (content[b.id] ?? <div className="h-24 animate-pulse rounded-lg bg-chip" />)}
          </section>
        );
      })}

      {editing && (
        <div className="relative self-start">
          <button type="button" onClick={() => setAdding((a) => !a)} className="rounded-md border border-dashed border-[#d3d1cb] px-3 py-1.5 text-sm text-ink-muted hover:bg-chip">
            + Añadir bloque
          </button>
          {adding && (
            <div className="absolute top-full left-0 z-10 mt-1 w-80 rounded-xl bg-white p-1.5 shadow-[0_0_0_1px_rgba(15,15,15,.05),0_12px_32px_rgba(15,15,15,.18)]">
              {available.map((t) => (
                <button
                  key={t.type}
                  type="button"
                  onClick={() => {
                    setAdding(false);
                    save([...blocks, newBlock(t.type)]);
                  }}
                  className="flex w-full flex-col rounded-md px-2.5 py-1.5 text-left hover:bg-chip"
                >
                  <span className="text-sm font-medium">{t.label}</span>
                  <span className="text-xs text-ink-faint">{t.hint}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
