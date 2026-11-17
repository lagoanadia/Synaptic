"use client";

import { useT } from "@/app/LangProvider";
import { ask } from "@/app/ui/PopupHost";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { FolderItem } from "@/lib/blockData";
import { FolderTiles } from "../../FolderTiles";
import { addNotebookGroup, renameNotebookGroup, reorderNotebookTabs, setFolderGroup } from "../../actions";
import { ALL, realGroups, tabOrder, useOpenTab } from "./tabs";
import { NewFolder } from "./NewFolder";

// A study notebook's subjects with tabs to sort them: Todas · Teoría ·
// Prácticas · +. Drag a folder onto a tab (or right-click it) to move it;
// right-click a tab to rename or delete it; drag tabs to reorder them (the
// first opens by default). A new folder goes in the open tab.
export function NotebookFolders({
  sectionId,
  sectionName,
  title,
  groups: stored,
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
  // Dragged into a new order but not yet back from the server.
  const [localOrder, setLocalOrder] = useState<string[] | null>(null);
  const order = localOrder ?? tabOrder(stored);
  const groups = realGroups(order);
  // The open tab lives in the URL (?s=Teoría), so the map below follows it.
  const active = useOpenTab(order);
  const setTab = (g: string | null) => {
    const q = new URLSearchParams(window.location.search);
    const v = g ?? ALL;
    if (v === order[0]) q.delete("s");
    else q.set("s", v);
    window.history.replaceState(null, "", `${window.location.pathname}${q.size ? `?${q}` : ""}`);
  };
  const [dragTab, setDragTab] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [over, setOver] = useState<string | null | undefined>(undefined);
  const [dragging, setDragging] = useState<string | null>(null);
  // Moved here but not yet back from the server: shown in place right away.
  const [moved, setMoved] = useState<Record<string, string | null>>({});
  const [toast, setToast] = useState<{ n: number; text: string } | null>(null);
  const [popped, setPopped] = useState<{ n: number; tab: string | null } | null>(null);
  const [, start] = useTransition();
  const all = items.map((f) => (f.id in moved ? { ...f, group: moved[f.id] } : f));
  const shown = active === null ? all : all.filter((f) => f.group === active);

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
    setDragging(null);
    if (!id) return;
    e.preventDefault();
    const name = items.find((f) => f.id === id)?.title ?? "";
    const n = Date.now();
    setMoved((m) => ({ ...m, [id]: g }));
    setPopped({ n, tab: g });
    setToast({ n, text: g ? `${name} → ${g}` : t("{0} ya no está en ninguna sección", { 0: name }) });
    setTimeout(() => setToast((x) => (x?.n === n ? null : x)), 1800);
    start(async () => {
      await setFolderGroup(id, g);
      router.refresh();
      // The server's copy has it now; drop the stand-in.
      setMoved((m) => Object.fromEntries(Object.entries(m).filter(([k]) => k !== id)));
    });
  };

  // While a folder is dragged every tab shows it's a place to drop it; the
  // one under the pointer turns blue and grows.
  const tabClass = (on: boolean, g: string | null) => {
    const hot = dragging !== null && over === g;
    const base = "flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] whitespace-nowrap transition-all duration-150";
    const look = hot
      ? "scale-110 bg-[#2383e2] font-semibold text-white shadow-[0_6px_16px_rgba(35,131,226,.35)]"
      : dragging
        ? "bg-white/70 text-ink outline-dashed outline-[1.5px] -outline-offset-2 outline-[#2383e2]/60"
        : on
          ? "bg-white font-semibold text-ink shadow-[0_1px_3px_rgba(0,0,0,.08)]"
          : "text-ink-muted hover:text-ink";
    const pop = popped && popped.tab === g ? "animate-[tab-pop_.45s_cubic-bezier(.34,1.56,.64,1)]" : "";
    return `${base} ${look} ${pop}`;
  };
  const count = (n: number) => <span className="rounded-full bg-current/10 px-1.5 text-[11px] font-normal opacity-70">{n}</span>;
  // Drop a tab on another: it goes in that one's place.
  const dropTab = (onto: string) => {
    if (!dragTab || dragTab === onto) return setDragTab(null);
    const next = order.filter((x) => x !== dragTab);
    next.splice(next.indexOf(onto), 0, dragTab);
    setLocalOrder(next);
    setDragTab(null);
    start(async () => {
      await reorderNotebookTabs(sectionId, next);
      router.refresh();
      setLocalOrder(null);
    });
  };
  const target = (g: string | null) => ({
    draggable: true,
    onDragStart: (e: React.DragEvent) => {
      e.dataTransfer.setData("synaptic/tab", g ?? ALL);
      e.dataTransfer.effectAllowed = "move";
      setDragTab(g ?? ALL);
    },
    onDragEnd: () => setDragTab(null),
    onDragOver: (e: React.DragEvent) => {
      if (e.dataTransfer.types.includes("synaptic/tab")) return e.preventDefault();
      if (!e.dataTransfer.types.includes("synaptic/folder")) return;
      e.preventDefault();
      setOver(g);
    },
    onDragLeave: () => setOver(undefined),
    onDrop: (e: React.DragEvent) => {
      if (e.dataTransfer.types.includes("synaptic/tab")) {
        e.preventDefault();
        return dropTab(g ?? ALL);
      }
      drop(g)(e);
    },
  });

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border-subtle pb-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        <div className="flex max-w-full items-center gap-0.5 overflow-x-auto rounded-full bg-chip p-[3px]" role="tablist" aria-label={t("Secciones")}>
          {order.map((key) => {
            const g = key === ALL ? null : key;
            return (
              <button
                key={popped?.tab === g ? `${key}-${popped.n}` : key}
                type="button"
                role="tab"
                aria-selected={active === g}
                title={g ? t("Arrastra para ordenar · clic derecho para renombrar") : t("Arrastra para ordenar")}
                onClick={() => setTab(g)}
                onContextMenu={(e) => {
                  if (!g) return;
                  e.preventDefault();
                  edit(g);
                }}
                className={`${tabClass(active === g, g)} ${dragTab === key ? "opacity-40" : ""}`}
                {...target(g)}
              >
                {g ?? t("Todas")} {count(g ? all.filter((f) => f.group === g).length : all.length)}
              </button>
            );
          })}
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
        {toast && (
          <span key={toast.n} role="status" className="animate-[fade-in_.2s_ease-out] rounded-full bg-ink px-3 py-1 text-xs font-medium text-white">
            ✓ {toast.text}
          </span>
        )}
      </div>
      <div className="grid grid-cols-3 items-start gap-x-4 gap-y-5 pt-2 sm:flex sm:flex-wrap sm:gap-x-6">
        <FolderTiles items={shown} groups={groups.length ? groups : undefined} dragging={dragging} onDrag={(id) => { setDragging(id); if (!id) setOver(undefined); }} />
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
