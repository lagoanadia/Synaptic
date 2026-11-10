"use client";

import { useT } from "@/app/LangProvider";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MiniNotebook } from "../Covers";
import { ArrowDown, XIcon } from "../icons";
import { HOME_BLOCK_TYPES, newBlock, type HomeBlock, type HomeBlockType } from "@/lib/blocks";
import type { NotebookCover } from "@/lib/covers";
import { saveHomeBlocks } from "./actions";

type Notebook = { id: string; name: string; cover: NotebookCover };
type Project = { id: string; title: string; cover: string };

const TITLE: Record<HomeBlockType, string> = { week: "Esta semana", today: "Para hoy", project: "Proyecto", folders: "Carpetas de", map: "Mapa de", recent: "Recientes de" };

// The home page's blocks. Normally just the content; "Editar" lets you
// pick each block's notebook, reorder, remove and add blocks. Changes
// save right away and the page reloads its data.
export function HomeBlocks({
  blocks: initial,
  notebooks,
  projects = [],
  content,
}: {
  blocks: HomeBlock[];
  notebooks: Notebook[];
  projects?: Project[];
  // Server-rendered content per block id (missing for a just-added block
  // until the refresh lands).
  content: Record<string, React.ReactNode>;
}) {
  const t = useT();
  const [blocks, setBlocks] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [, start] = useTransition();
  const router = useRouter();
  const byId = new Map(notebooks.map((n) => [n.id, n]));

  function save(next: HomeBlock[]) {
    setBlocks(next);
    start(async () => {
      await saveHomeBlocks(next);
      router.refresh();
    });
  }
  const move = (i: number, d: -1 | 1) => {
    const next = [...blocks];
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    save(next);
  };

  return (
    <div className="flex flex-col gap-10">
      {blocks.map((b, i) => {
        const nb = b.sectionId ? byId.get(b.sectionId) : undefined;
        return (
          <section key={b.id} className={`relative flex flex-col gap-3 ${editing ? "rounded-lg p-3 outline-[1.5px] outline-offset-4 outline-[#d3d1cb] outline-dashed" : ""}`}>
            <header className="flex items-center gap-2 border-b border-border-subtle pb-2">
              <h2 className="flex min-w-0 flex-1 items-center gap-2 text-sm font-semibold">
                {editing ? (
                  <>
                    {TITLE[b.type]}
                    {b.type === "project" && (
                      <select
                        value={b.pursuitId ?? ""}
                        onChange={(e) => save(blocks.map((x) => (x.id === b.id ? { ...x, pursuitId: e.target.value || null } : x)))}
                        aria-label={t("Proyecto")}
                        className="rounded-md bg-chip px-2 py-0.5 text-sm font-medium"
                      >
                        {projects.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.title}
                          </option>
                        ))}
                      </select>
                    )}
                    {b.type !== "week" && b.type !== "today" && b.type !== "project" && (
                    <select
                      value={b.sectionId ?? ""}
                      onChange={(e) => save(blocks.map((x) => (x.id === b.id ? { ...x, sectionId: e.target.value || null } : x)))}
                      aria-label={t("Libreta")}
                      className="rounded-md bg-chip px-2 py-0.5 text-sm font-medium"
                    >
                      {notebooks.map((n) => (
                        <option key={n.id} value={n.id}>
                          {n.name}
                        </option>
                      ))}
                    </select>
                    )}
                  </>
                ) : (
                  <>
                    {nb && !["week", "today", "project"].includes(b.type) && <MiniNotebook cover={nb.cover} size={14} />}
                    {b.type === "week" ? t("Esta semana") : b.type === "today" ? t("Para hoy") : b.type === "project" ? t("Proyecto") : b.type === "map" ? t("Tu mapa") : b.type === "recent" ? t("Recientes") : nb?.name}
                  </>
                )}
              </h2>
              {!editing && b.type === "week" && (
                <Link href="/calendar" className="text-sm text-ink-faint hover:text-ink">
                  {t("Calendario ↗")}
                </Link>
              )}
              {editing && (
                <span className="flex items-center gap-1">
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} title={t("Subir")} className="rounded p-1 text-ink-faint hover:bg-chip disabled:opacity-30">
                    <ArrowDown size={14} className="block rotate-180" />
                  </button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === blocks.length - 1} title={t("Bajar")} className="rounded p-1 text-ink-faint hover:bg-chip disabled:opacity-30">
                    <ArrowDown size={14} className="block" />
                  </button>
                  <button type="button" onClick={() => save(blocks.filter((x) => x.id !== b.id))} title={t("Quitar")} className="rounded p-1 text-ink-faint hover:bg-chip hover:text-red-600">
                    <XIcon size={14} className="block" />
                  </button>
                </span>
              )}
            </header>
            {content[b.id] ?? <div className="h-24 animate-pulse rounded-lg bg-chip" />}
          </section>
        );
      })}

      <div className="flex items-center gap-3">
        {editing && (
          <div className="relative">
            <button type="button" onClick={() => setAdding((a) => !a)} className="rounded-md border border-dashed border-[#d3d1cb] px-3 py-1.5 text-sm text-ink-muted hover:bg-chip">
              {t("+ Añadir bloque")}
            </button>
            {adding && (
              <div className="absolute top-full left-0 z-10 mt-1 w-48 rounded-lg bg-white p-1 shadow-[0_0_0_1px_rgba(15,15,15,.05),0_10px_26px_rgba(15,15,15,.16)]">
                {HOME_BLOCK_TYPES.map((item) => (
                  <button
                    key={item.type}
                    type="button"
                    onClick={() => {
                      setAdding(false);
                      save([...blocks, { ...newBlock(item.type), sectionId: notebooks[0]?.id ?? null, ...(item.type === "project" ? { pursuitId: projects[0]?.id ?? null } : {}) }]);
                    }}
                    className="block w-full rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-chip"
                  >
                    {t(item.label)}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <button
          type="button"
          onClick={() => {
            setEditing((e) => !e);
            setAdding(false);
          }}
          className={`ml-auto rounded-md px-3 py-1.5 text-sm ${editing ? "bg-ink font-medium text-white" : "text-ink-faint hover:bg-chip hover:text-ink"}`}
        >
          {editing ? t("Listo") : t("Editar inicio")}
        </button>
      </div>
    </div>
  );
}
