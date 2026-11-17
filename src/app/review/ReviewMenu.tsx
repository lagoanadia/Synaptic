"use client";

import Link from "next/link";
import { useState } from "react";
import { useT } from "@/app/LangProvider";
import { FOLDER_COVERS, type FolderCover } from "@/lib/covers";

export type MenuFolder = { id: string; title: string; cover: FolderCover; units: { id: string; name: string }[] };

// A short label for a unit's circle: "UD2", "Tema 3" → "T3", else its initials.
const short = (name: string) => {
  const n = name.trim();
  if (n.length <= 4) return n;
  const num = /\d+/.exec(n)?.[0];
  return num ? `${n[0].toUpperCase()}${num}` : n.split(/\s+/).map((w) => w[0]).join("").slice(0, 3).toUpperCase();
};

// What to review, as a slim bar of circles on the right: a round button
// opens it; each folder is a circle in its colour; inside one, the folder
// sits on top (tap it to go back) and its units are circles below.
export function ReviewMenu({ folders, pursuitId, unitId }: { folders: MenuFolder[]; pursuitId: string | null; unitId: string | null }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [inside, setInside] = useState<string | null>(pursuitId);
  const folder = folders.find((f) => f.id === inside) ?? null;
  const color = (f: MenuFolder) => FOLDER_COVERS[f.cover] ?? "#8a8986";
  const dot = "relative grid size-9 shrink-0 place-items-center rounded-full text-[10px] font-bold text-white shadow-[inset_0_-2px_0_rgba(0,0,0,.18)] transition-transform hover:scale-110";
  const ring = (on: boolean) => (on ? "ring-2 ring-white ring-offset-2 ring-offset-[#26262a]" : "");

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={t("Qué repasar")}
        title={t("Qué repasar")}
        className="grid size-9 place-items-center rounded-full bg-white text-ink shadow-lg hover:scale-105"
      >
        {folder && !open ? <span className="size-4 rounded-full" style={{ background: color(folder) }} /> : <span className="size-3 rounded-full bg-ink/80" />}
      </button>
      {open && (
        <nav aria-label={t("Qué repasar")} className="flex max-h-[70vh] w-[52px] flex-col items-center gap-2.5 overflow-y-auto rounded-full bg-[#26262a] px-1.5 py-2.5 shadow-2xl ring-1 ring-white/10">
          {folder ? (
            <>
              <button type="button" onClick={() => setInside(null)} title={`‹ ${folder.title}`} aria-label={t("Volver a las carpetas")} className="flex h-6 w-10 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: color(folder) }}>
                ‹
              </button>
              <Link href={`/review?pursuit=${folder.id}`} title={t("Toda la asignatura")} aria-label={t("Toda la asignatura")} className={`${dot} ${ring(pursuitId === folder.id && !unitId)}`} style={{ background: color(folder) }}>
                ∗
              </Link>
              {folder.units.map((u) => (
                <Link key={u.id} href={`/review?pursuit=${folder.id}&unit=${u.id}`} title={u.name} aria-label={u.name} className={`${dot} bg-[#2383e2] ${ring(unitId === u.id)}`}>
                  {short(u.name)}
                </Link>
              ))}
            </>
          ) : (
            <>
              <Link href="/review" title={t("Todo")} aria-label={t("Todo")} className={`${dot} bg-white/15 ${ring(!pursuitId)}`}>
                ∗
              </Link>
              {folders.map((f) => (
                <button key={f.id} type="button" onClick={() => setInside(f.id)} title={f.title} aria-label={f.title} className={`${dot} ${ring(pursuitId === f.id)}`} style={{ background: color(f) }}>
                  {f.title.slice(0, 2).toUpperCase()}
                </button>
              ))}
            </>
          )}
        </nav>
      )}
    </div>
  );
}
