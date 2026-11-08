"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Folder } from "@/app/Covers";
import { FOLDER_GROUPS, type FolderCover } from "@/lib/covers";
import { setFolderCover, setGroupLabel } from "./actions";

// Shown in "Editar": the folder's look (cover pattern), what its groups
// are called, and the rest of its settings (passed in as children).
export function FolderSettings({
  pursuitId,
  cover,
  groupLabel,
  children,
}: {
  pursuitId: string;
  cover: FolderCover;
  groupLabel: string | null;
  children: React.ReactNode;
}) {
  const [label, setLabel] = useState(groupLabel ?? "");
  const [, start] = useTransition();
  const router = useRouter();

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border-subtle bg-[#fbfbfa] p-4 text-sm" aria-label="Ajustes de la carpeta">
      <div className="flex flex-wrap items-start gap-3">
        <span className="w-28 pt-1 text-ink-faint">Tapa</span>
        <div className="flex flex-1 flex-col gap-3">
          {FOLDER_GROUPS.map((g) => (
            <div key={g.name}>
              <div className="mb-1.5 text-[11px] font-semibold tracking-wide text-ink-faint uppercase">{g.name}</div>
              <div className="flex flex-wrap gap-3">
                {g.covers.map((c: FolderCover) => (
                  <button
                    key={c}
                    type="button"
                    title={c}
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
    </section>
  );
}
