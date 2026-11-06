"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, XIcon } from "@/app/icons";
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
  editing,
}: {
  pursuitId: string;
  blocks: FolderBlock[];
  study: boolean;
  // Does it have groups (units/themes)? Board view needs them.
  grouped: boolean;
  content: Record<string, React.ReactNode>;
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
        return (
          <section key={b.id} className={`relative flex flex-col gap-3 ${editing ? "rounded-lg p-3 outline-[1.5px] outline-offset-4 outline-[#d3d1cb] outline-dashed" : ""}`}>
            <header className="flex items-center gap-2 border-b border-border-subtle pb-2">
              <h2 className="flex-1 text-sm font-semibold">{LABEL[b.type]}</h2>
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
            {content[b.id] ?? <div className="h-24 animate-pulse rounded-lg bg-chip" />}
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
