"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MiniNotebook, Notebook } from "@/app/Covers";
import { NOTEBOOK_COVERS, type NotebookCover } from "@/lib/covers";
import { deleteSection, setNotebook } from "../../actions";

// A notebook's header: its cover, name (click to rename), "Repaso de hoy"
// when it has study tools, and ⚙ for study tools on/off, cover, delete.
export function NotebookHeader({
  id,
  name: initialName,
  cover,
  study,
  editable,
}: {
  id: string;
  name: string;
  cover: NotebookCover;
  study: boolean;
  editable: boolean;
}) {
  const [name, setName] = useState(initialName);
  const [renaming, setRenaming] = useState(false);
  const [menu, setMenu] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();
  const router = useRouter();

  const update = (data: Parameters<typeof setNotebook>[1]) =>
    start(async () => {
      const r = await setNotebook(id, data);
      setError(r.error);
      router.refresh();
    });

  return (
    <header className="flex flex-wrap items-center gap-4">
      <Notebook cover={cover} width={52} label={false} />
      {renaming ? (
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => {
            setRenaming(false);
            if (name.trim() && name !== initialName) update({ name });
            else setName(initialName);
          }}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          aria-label="Nombre de la libreta"
          className="min-w-0 flex-1 rounded-md text-[2.1rem] leading-tight font-bold tracking-tight outline-none"
        />
      ) : (
        <h1
          onClick={() => editable && setRenaming(true)}
          title={editable ? "Renombrar" : undefined}
          className={`min-w-0 flex-1 text-[2.1rem] leading-tight font-bold tracking-tight ${editable ? "cursor-text" : ""}`}
        >
          {name}
        </h1>
      )}
      <span className="relative flex items-center gap-2">
        {study && (
          <Link href={`/review?mode=flash&section=${id}`} className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white">
            Repaso de hoy
          </Link>
        )}
        {editable && (
          <button type="button" onClick={() => setMenu((m) => !m)} aria-label="Ajustes de la libreta" title="Ajustes" className="rounded-md px-2 py-1.5 text-ink-faint hover:bg-chip hover:text-ink">
            ⚙
          </button>
        )}
        {menu && (
          <div className="absolute top-full right-0 z-20 mt-2 flex w-72 flex-col gap-4 rounded-xl bg-white p-4 text-sm shadow-[0_0_0_1px_rgba(15,15,15,.05),0_12px_32px_rgba(15,15,15,.18)]">
            <label className="flex items-center justify-between gap-3">
              <span>
                Herramientas de estudio
                <span className="block text-xs text-ink-faint">Tarjetas, mapa, repaso y retos</span>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={study}
                onClick={() => update({ study: !study })}
                className={`relative h-[22px] w-[38px] shrink-0 rounded-full transition-colors ${study ? "bg-accent" : "bg-[#e3e2de]"}`}
              >
                <span className={`absolute top-[3px] size-4 rounded-full bg-white shadow transition-all ${study ? "left-[19px]" : "left-[3px]"}`} />
              </button>
            </label>
            <div className="flex flex-col gap-2">
              <span className="text-xs text-ink-faint">Tapa</span>
              <div className="flex flex-wrap gap-2">
                {NOTEBOOK_COVERS.map((c) => (
                  <button key={c} type="button" title={c} onClick={() => update({ cover: c })} className={`rounded-sm ${c === cover ? "ring-2 ring-ink ring-offset-2" : ""}`}>
                    <MiniNotebook cover={c} size={30} />
                  </button>
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                if (window.confirm(`¿Eliminar la libreta "${initialName}"? Sus carpetas pasan a Sin clasificar; no se borra nada de dentro.`))
                  start(() => deleteSection(id));
              }}
              className="self-start text-xs text-ink-faint hover:text-red-600"
            >
              Eliminar libreta
            </button>
            {error && <span className="text-xs text-red-500">{error}</span>}
          </div>
        )}
      </span>
    </header>
  );
}
