"use client";

import { useT } from "@/app/LangProvider";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MiniNotebook, Notebook } from "@/app/Covers";
import { NOTEBOOK_COVERS, type NotebookCover } from "@/lib/covers";
import { deleteSection, setNotebook } from "../../actions";
import { TemplatePick } from "../../TemplatePick";

// A notebook's header: its cover, name (click to rename), "Repasar" for
// study notebooks, and ⚙ for its template (estudios / proyectos), cover, delete.
export function NotebookHeader({
  id,
  name: initialName,
  cover,
  study,
  kind = null,
  editable,
}: {
  id: string;
  name: string;
  cover: NotebookCover;
  study: boolean;
  kind?: "study" | "projects" | "general" | null;
  editable: boolean;
}) {
  const t = useT();
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
          aria-label={t("Nombre de la libreta")}
          className="min-w-0 flex-1 rounded-md text-[2.1rem] leading-tight font-bold tracking-tight outline-none"
        />
      ) : (
        <h1
          onClick={() => editable && setRenaming(true)}
          title={editable ? t("Renombrar") : undefined}
          className={`min-w-0 flex-1 text-[2.1rem] leading-tight font-bold tracking-tight ${editable ? "cursor-text" : ""}`}
        >
          {name}
        </h1>
      )}
      <span className="relative flex items-center gap-2">
        {study && (
          <Link href={`/review?section=${id}`} className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white">
            {t("▶ Repasar")}
          </Link>
        )}
        {editable && (
          <button type="button" onClick={() => setMenu((m) => !m)} aria-label={t("Ajustes de la libreta")} title={t("Ajustes")} className="rounded-md px-2 py-1.5 text-ink-faint hover:bg-chip hover:text-ink">
            ⚙
          </button>
        )}
        {menu && (
          <div className="absolute top-full right-0 z-20 mt-2 flex w-72 flex-col gap-4 rounded-xl bg-white p-4 text-sm shadow-[0_0_0_1px_rgba(15,15,15,.05),0_12px_32px_rgba(15,15,15,.18)]">
            <div className="flex flex-col gap-2">
              <span className="text-xs text-ink-faint">{t("Plantilla")}</span>
              <TemplatePick value={kind ?? (study ? "study" : "projects")} onChange={(t) => update({ kind: t })} />
              <span className="text-[11px] text-ink-faint">{t("Cambiarla no borra nada: solo cambia lo que ves.")}</span>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-xs text-ink-faint">{t("Tapa")}</span>
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
              {t("Eliminar libreta")}
            </button>
            {error && <span className="text-xs text-red-500">{error}</span>}
          </div>
        )}
      </span>
    </header>
  );
}
