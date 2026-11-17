"use client";

import { useT } from "@/app/LangProvider";
import { ask } from "@/app/ui/PopupHost";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { FolderItem } from "@/lib/blockData";
import { FolderTiles } from "../../FolderTiles";
import { addNotebookGroup, renameNotebookGroup, setFolderGroup } from "../../actions";
import { NewFolder } from "./NewFolder";

// A study notebook's subjects with tabs to sort them: Todas · Teoría ·
// Prácticas · +. Drag a folder onto a tab (or right-click it) to move it;
// right-click a tab to rename or delete it. A new folder goes in the open tab.
export function NotebookFolders({
  sectionId,
  sectionName,
  title,
  groups,
  items,
  newLabel,
}: {
  sectionId: string;
  sectionName: string;
  title: string;
  groups: string[];
  items: FolderItem[];
  newLabel: string;
}) {
  const t = useT();
  const router = useRouter();
  const [tab, setTab] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [over, setOver] = useState<string | null | undefined>(undefined);
  const [, start] = useTransition();
  const active = tab !== null && groups.includes(tab) ? tab : null;
  const shown = active === null ? items : items.filter((f) => f.group === active);

  const add = (name: string) =>
    start(async () => {
      const r = await addNotebookGroup(sectionId, name);
      if (r.error) return void ask.alert(r.error);
      setAdding(false);
      setTab(name.trim());
      router.refresh();
    });

  const edit = async (g: string) => {
    // Rename it; leave the name empty to delete it.
    const typed = await ask.prompt(t("Nombre de la sección (vacío para borrarla)"), g);
    if (typed === null || typed.trim() === g) return;
    const name = typed.trim() || null;
    if (name === null && !(await ask.confirm(t("¿Borrar la sección \"{0}\"? Sus carpetas no se borran.", { 0: g }), { danger: true }))) return;
    start(async () => {
      const r = await renameNotebookGroup(sectionId, g, name);
      if (r.error) return void ask.alert(r.error);
      setTab(name);
      router.refresh();
    });
  };

  const drop = (g: string | null) => (e: React.DragEvent) => {
    const id = e.dataTransfer.getData("synaptic/folder");
    setOver(undefined);
    if (!id) return;
    e.preventDefault();
    start(async () => {
      await setFolderGroup(id, g);
      router.refresh();
    });
  };

  const tabClass = (on: boolean, hot: boolean) =>
    `flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] whitespace-nowrap transition-colors ${
      on ? "bg-white font-semibold text-ink shadow-[0_1px_3px_rgba(0,0,0,.08)]" : "text-ink-muted hover:text-ink"
    } ${hot ? "ring-2 ring-[#2383e2]" : ""}`;
  const count = (n: number) => <span className="rounded-full bg-black/[.06] px-1.5 text-[11px] font-normal text-ink-faint">{n}</span>;
  const target = (g: string | null) => ({
    onDragOver: (e: React.DragEvent) => {
      if (!e.dataTransfer.types.includes("synaptic/folder")) return;
      e.preventDefault();
      setOver(g);
    },
    onDragLeave: () => setOver(undefined),
    onDrop: drop(g),
  });

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border-subtle pb-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        <div className="flex max-w-full items-center gap-0.5 overflow-x-auto rounded-full bg-chip p-[3px]" role="tablist" aria-label={t("Secciones")}>
          <button type="button" role="tab" aria-selected={active === null} onClick={() => setTab(null)} className={tabClass(active === null, over === null)} {...target(null)}>
            {t("Todas")} {count(items.length)}
          </button>
          {groups.map((g) => (
            <button
              key={g}
              type="button"
              role="tab"
              aria-selected={active === g}
              title={t("Clic derecho para renombrar")}
              onClick={() => setTab(g)}
              onContextMenu={(e) => {
                e.preventDefault();
                edit(g);
              }}
              className={tabClass(active === g, over === g)}
              {...target(g)}
            >
              {g} {count(items.filter((f) => f.group === g).length)}
            </button>
          ))}
          {adding ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const name = String(new FormData(e.currentTarget).get("name") ?? "");
                if (name.trim()) add(name);
              }}
            >
              <input
                autoFocus
                name="name"
                maxLength={30}
                placeholder={t("Teoría, Prácticas…")}
                aria-label={t("Nueva sección")}
                onBlur={(e) => (e.currentTarget.value.trim() ? e.currentTarget.form?.requestSubmit() : setAdding(false))}
                onKeyDown={(e) => e.key === "Escape" && setAdding(false)}
                className="w-32 rounded-full bg-white px-3 py-1 text-[13px] outline-none"
              />
            </form>
          ) : (
            <button type="button" onClick={() => setAdding(true)} aria-label={t("Nueva sección")} title={t("Nueva sección")} className="grid size-7 place-items-center rounded-full text-ink-faint hover:bg-white hover:text-ink">
              +
            </button>
          )}
        </div>
      </div>
      <div className="grid grid-cols-3 items-start gap-x-4 gap-y-5 pt-2 sm:flex sm:flex-wrap sm:gap-x-6">
        <FolderTiles items={shown} groups={groups.length ? groups : undefined} />
        {/* The same room above as a folder (sheets + tab), so "+" lines up with the covers. */}
        <div className="flex flex-col sm:w-28">
          <div className="pt-[12%]" />
          <div className="pt-[min(max(1.5px,5.5%),15px)]" />
          <NewFolder key={active ?? ""} sectionName={sectionName} label={newLabel} group={active} />
        </div>
      </div>
    </section>
  );
}
