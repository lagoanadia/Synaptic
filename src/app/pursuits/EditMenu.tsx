"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Folder, MiniNotebook } from "../Covers";
import { FOLDER_GROUPS, NOTEBOOK_COVERS, type FolderCover, type NotebookCover } from "@/lib/covers";
import { setNotebook } from "./actions";
import { renamePursuit, setFolderCover } from "./[id]/actions";

export type EditTarget =
  | { kind: "notebook"; id: string; name: string; cover: NotebookCover; x: number; y: number }
  | { kind: "folder"; id: string; name: string; cover: FolderCover; x: number; y: number };

// Where a right-click (or long press) should open the menu.
export const menuAt = (e: React.MouseEvent) => ({ x: Math.max(8, Math.min(e.clientX, window.innerWidth - 288)), y: Math.max(8, Math.min(e.clientY, window.innerHeight - 300)) });

// Right-click on a notebook or folder: rename it and pick its cover, right
// where you clicked. Enter or clicking away saves the name.
export function EditMenu({ target, onClose }: { target: EditTarget; onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState(target.name);
  const [cover, setCover] = useState<string>(target.cover);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    input.current?.select();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  function saveName(then?: () => void) {
    const trimmed = name.trim();
    if (!trimmed || trimmed === target.name) return then?.();
    start(async () => {
      try {
        if (target.kind === "notebook") {
          const r = await setNotebook(target.id, { name: trimmed });
          if (r.error) return setError(r.error);
        } else await renamePursuit(target.id, trimmed);
        router.refresh();
        then?.();
      } catch {
        setError("No se ha podido cambiar el nombre");
      }
    });
  }

  function pick(c: string) {
    setCover(c);
    start(async () => {
      if (target.kind === "notebook") await setNotebook(target.id, { cover: c });
      else await setFolderCover(target.id, c);
      router.refresh();
    });
  }

  const groups: { name: string | null; covers: string[] }[] = target.kind === "notebook" ? [{ name: null, covers: [...NOTEBOOK_COVERS] }] : FOLDER_GROUPS;

  return (
    <>
      <button type="button" aria-label="Cerrar" className="fixed inset-0 z-[55] cursor-default" onClick={() => saveName(onClose)} onContextMenu={(e) => { e.preventDefault(); saveName(onClose); }} />
      <div
        role="dialog"
        aria-label={target.kind === "notebook" ? "Editar libreta" : "Editar carpeta"}
        className="fixed z-[56] flex w-[280px] flex-col gap-3 rounded-xl bg-white p-3 shadow-[0_0_0_1px_rgba(15,15,15,.05),0_14px_36px_rgba(15,15,15,.18)]"
        style={{ left: target.x, top: target.y }}
      >
        <input
          ref={input}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && saveName(onClose)}
          aria-label="Nombre"
          className="rounded-md border border-border-subtle px-2 py-1.5 text-sm font-medium outline-none focus:border-ink-faint"
        />
        <div className="flex max-h-[60vh] flex-col gap-2.5 overflow-y-auto">
          {groups.map((g) => (
            <div key={g.name ?? "all"}>
              {g.name && <div className="mb-1 text-[10px] font-semibold tracking-wide text-ink-faint uppercase">{g.name}</div>}
              <div className={`grid gap-1.5 ${target.kind === "notebook" ? "grid-cols-9" : "grid-cols-6"}`}>
                {g.covers.map((c) => (
                  <button
                    key={c}
                    type="button"
                    title={c}
                    aria-label={c}
                    aria-pressed={cover === c}
                    onClick={() => pick(c)}
                    className={`grid place-items-center rounded-sm p-0.5 ${cover === c ? "ring-2 ring-ink ring-offset-1" : "hover:bg-chip"}`}
                  >
                    {target.kind === "notebook" ? <MiniNotebook cover={c as NotebookCover} size={24} /> : <Folder cover={c as FolderCover} width={34} />}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    </>
  );
}
