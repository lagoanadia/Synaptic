"use client";

import Link from "next/link";
import { useState } from "react";
import { useT } from "@/app/LangProvider";
import { Folder } from "@/app/Covers";
import type { FolderCover } from "@/lib/covers";

export type MenuFolder = { id: string; title: string; cover: FolderCover; units: { id: string; name: string }[] };

// What to review, one level at a time: all your folders, then (inside one)
// the whole folder or just one of its units, with ‹ to go back.
export function ReviewMenu({ folders, pursuitId, unitId }: { folders: MenuFolder[]; pursuitId: string | null; unitId: string | null }) {
  const t = useT();
  const [open, setOpen] = useState<string | null>(pursuitId);
  const folder = folders.find((f) => f.id === open) ?? null;
  const item = (on: boolean) => `flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm ${on ? "bg-white/12 text-white" : "text-white/70 hover:bg-white/6 hover:text-white"}`;

  if (folder)
    return (
      <nav className="flex flex-col gap-1" aria-label={t("Qué repasar")}>
        <button type="button" onClick={() => setOpen(null)} className="mb-1 flex items-center gap-1.5 px-1 text-xs text-white/50 hover:text-white">
          ‹ {t("Carpetas")}
        </button>
        <span className="flex items-center gap-2 px-2.5 pb-2 text-[15px] font-semibold text-white">
          <Folder cover={folder.cover} width={26} />
          <span className="truncate">{folder.title}</span>
        </span>
        <Link href={`/review?pursuit=${folder.id}`} className={item(pursuitId === folder.id && !unitId)}>
          {t("Toda la asignatura")}
        </Link>
        {folder.units.map((u) => (
          <Link key={u.id} href={`/review?pursuit=${folder.id}&unit=${u.id}`} className={item(unitId === u.id)}>
            <span className="size-1.5 shrink-0 rounded-full bg-white/40" />
            <span className="truncate">{u.name}</span>
          </Link>
        ))}
        {folder.units.length === 0 && <p className="px-2.5 py-2 text-xs text-white/40">{t("Esta carpeta no tiene unidades")}</p>}
      </nav>
    );

  return (
    <nav className="flex flex-col gap-1" aria-label={t("Qué repasar")}>
      <span className="px-2.5 pb-2 text-xs font-semibold tracking-wide text-white/40 uppercase">{t("Repasar")}</span>
      <Link href="/review" className={item(!pursuitId)}>
        {t("Todo")}
      </Link>
      {folders.map((f) => (
        <button key={f.id} type="button" onClick={() => setOpen(f.id)} className={`${item(pursuitId === f.id)} w-full text-left`}>
          <Folder cover={f.cover} width={22} />
          <span className="min-w-0 flex-1 truncate">{f.title}</span>
          <span className="text-white/30">›</span>
        </button>
      ))}
    </nav>
  );
}
