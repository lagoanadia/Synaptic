"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Folder } from "@/app/Covers";
import { FOLDER_GROUPS, type FolderCover } from "@/lib/covers";
import { setFolderCover, setGroupLabel } from "./actions";
import { deletePursuit, saveFolderTemplate } from "../actions";

// Shown in "Editar": the folder's look (cover pattern), what its groups
// are called, and the rest of its settings (passed in as children).
export function FolderSettings({
  pursuitId,
  cover,
  groupLabel,
  title,
  canDelete,
  children,
}: {
  pursuitId: string;
  cover: FolderCover;
  groupLabel: string | null;
  title: string;
  canDelete: boolean;
  children: React.ReactNode;
}) {
  const [label, setLabel] = useState(groupLabel ?? "");
  const [, start] = useTransition();
  const router = useRouter();

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border-subtle bg-[#fbfbfa] p-4 text-sm" aria-label="Ajustes de la carpeta">
      {/* Covers: one column per colour family, so they use the width. */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-5">
        {FOLDER_GROUPS.map((g) => (
          <div key={g.name} className="flex flex-col gap-2">
            <span className="text-[11px] font-semibold tracking-wide text-ink-faint uppercase">{g.name}</span>
            <div className="grid w-fit grid-cols-3 gap-2">
              {g.covers.map((c: FolderCover) => (
                <button
                  key={c}
                  type="button"
                  title={c}
                  aria-pressed={c === cover}
                  onClick={() => start(async () => { await setFolderCover(pursuitId, c); router.refresh(); })}
                  className={`rounded p-0.5 ${c === cover ? "ring-2 ring-ink ring-offset-2" : ""}`}
                >
                  <Folder cover={c} width={34} />
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      {groupLabel !== null && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => { await setGroupLabel(pursuitId, label); router.refresh(); });
          }}
          className="flex flex-wrap items-center gap-3"
        >
          <span className="w-28 text-ink-faint">Agrupado por</span>
          <input value={label} onChange={(e) => setLabel(e.target.value)} aria-label="Nombre del grupo" className="w-40 rounded-md border border-border-subtle bg-white px-2 py-1" />
          {label.trim() && label !== groupLabel && (
            <button type="submit" className="rounded-md bg-ink px-2.5 py-1 text-xs font-medium text-white">
              Guardar
            </button>
          )}
        </form>
      )}
      {children}
      <SaveAsTemplate pursuitId={pursuitId} title={title} />
      {canDelete && (
        <button
          type="button"
          onClick={() => {
            if (window.confirm(`¿Eliminar la carpeta "${title}"? Se borra todo lo de dentro (notas, tarjetas, tareas, mapas) y no se puede deshacer.`))
              start(() => deletePursuit(pursuitId));
          }}
          className="flex items-center gap-1.5 self-start border-t border-border-subtle pt-3 text-xs text-ink-faint hover:text-red-600"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v6M14 11v6" />
          </svg>
          Eliminar carpeta
        </button>
      )}
    </section>
  );
}

// "Guardar como plantilla": this folder's blocks, to start new folders from.
function SaveAsTemplate({ pursuitId, title }: { pursuitId: string; title: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(title);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!open)
    return (
      <button type="button" onClick={() => { setOpen(true); setMsg(null); }} className="flex items-center gap-1.5 self-start rounded-md border border-border-subtle bg-white px-3 py-1.5 text-sm text-ink-muted hover:border-ink-faint hover:text-ink">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <path d="M17.5 14v7M14 17.5h7" />
        </svg>
        {msg ?? "Guardar como plantilla"}
      </button>
    );
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await saveFolderTemplate(pursuitId, name);
          if (r.error) setMsg(r.error);
          else {
            setOpen(false);
            setMsg(`✓ Guardada: «${name.trim()}»`);
          }
        });
      }}
      className="flex flex-wrap items-center gap-2"
    >
      <input autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={30} aria-label="Nombre de la plantilla" className="w-48 rounded-md border border-border-subtle bg-white px-2 py-1" />
      <button type="submit" disabled={pending} className="rounded-md bg-ink px-3 py-1 text-xs font-medium text-white disabled:opacity-60">
        Guardar
      </button>
      <button type="button" onClick={() => setOpen(false)} className="text-xs text-ink-faint hover:text-ink">
        Cancelar
      </button>
      {msg && <span className="text-xs text-red-600">{msg}</span>}
      <span className="w-full text-xs text-ink-faint">Guarda los bloques y sus columnas, no el contenido.</span>
    </form>
  );
}
