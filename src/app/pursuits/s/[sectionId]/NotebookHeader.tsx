"use client";

import { ask } from "@/app/ui/PopupHost";
import { useT } from "@/app/LangProvider";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MiniNotebook, Notebook } from "@/app/Covers";
import { NOTEBOOK_COVERS, type NotebookCover } from "@/lib/covers";
import { deleteSection, setNotebook } from "../../actions";
import { EditMenu, menuAt, type EditTarget } from "../../EditMenu";
import { TemplatePick } from "../../TemplatePick";
import { setNotebookEditing, useNotebookEditing } from "./editMode";

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
  const [editing, setEditing] = useState<EditTarget | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();
  const router = useRouter();
  const blocksEditing = useNotebookEditing();

  const update = (data: Parameters<typeof setNotebook>[1]) =>
    start(async () => {
      const r = await setNotebook(id, data);
      setError(r.error);
      router.refresh();
    });

  return (
    <header className="flex flex-wrap items-center gap-4">
      {/* Right-click the cover to change it (or rename). */}
      <span
        onContextMenu={(e) => {
          if (!editable) return;
          e.preventDefault();
          setEditing({ kind: "notebook", id, name, cover, ...menuAt(e) });
        }}
      >
        <Notebook cover={cover} width={52} label={false} />
      </span>
      {editing && <EditMenu target={editing} onClose={() => setEditing(null)} />}
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
          <Link href="/review/tests" title={t("Mis tests")} aria-label={t("Mis tests")} className="grid size-8 place-items-center rounded-md bg-accent text-white hover:brightness-95">
            {/* A test sheet with ticks */}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="5" y="3.5" width="14" height="17" rx="2.5" />
              <path d="m8.5 9 1.5 1.5L12.5 8M8.5 15l1.5 1.5 2.5-2.5M14.5 9.5H16M14.5 15.5H16" />
            </svg>
          </Link>
        )}
        {editable && (
          <button
            type="button"
            onClick={() => setNotebookEditing(!blocksEditing)}
            aria-pressed={blocksEditing}
            aria-label={blocksEditing ? t("Listo") : t("Editar bloques")}
            title={blocksEditing ? t("Listo") : t("Editar bloques")}
            className={`grid size-8 place-items-center rounded-md ${blocksEditing ? "bg-ink text-white" : "text-ink-faint hover:bg-chip hover:text-ink"}`}
          >
            {blocksEditing ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M5 12.5l4.5 4.5L19 7.5" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M4 20h4L19 9l-4-4L4 16z" />
                <path d="M13.5 6.5l4 4" />
              </svg>
            )}
          </button>
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
              <TemplatePick value={kind ?? (study ? "study" : "projects")} onChange={(t) => update({ kind: t })} hint={false} />
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
              onClick={async () => {
                if (await ask.confirm(t("¿Eliminar la libreta \"{0}\"? Sus carpetas pasan a Sin clasificar; no se borra nada de dentro.", { 0: initialName }), { danger: true }))
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
