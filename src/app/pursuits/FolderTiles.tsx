"use client";

import Link from "next/link";
import { useState } from "react";
import { Folder } from "../Covers";
import type { FolderItem } from "@/lib/blockData";
import { EditMenu, menuAt, type EditTarget } from "./EditMenu";

// The folders in a row; right-click one to rename it or change its cover.
// groups: its notebook's tabs — then a folder can be dragged onto one,
// or moved from the right-click menu.
export function FolderTiles({ items, groups, dragging, onDrag }: { items: FolderItem[]; groups?: string[]; dragging?: string | null; onDrag?: (id: string | null) => void }) {
  const [editing, setEditing] = useState<EditTarget | null>(null);
  return (
    <>
      {items.map((f) => (
        <Link
          key={f.id}
          href={f.href}
          draggable={!!groups}
          onDragStart={(e) => {
            e.dataTransfer.setData("synaptic/folder", f.id);
            e.dataTransfer.effectAllowed = "move";
            onDrag?.(f.id);
          }}
          onDragEnd={() => onDrag?.(null)}
          onContextMenu={(e) => {
            e.preventDefault();
            setEditing({ kind: "folder", id: f.id, name: f.title, cover: f.cover, groups, group: f.group ?? null, ...menuAt(e) });
          }}
          className={`group flex min-w-0 flex-col gap-2 transition-[opacity,transform] duration-200 sm:w-28 ${dragging === f.id ? "scale-90 opacity-30" : ""}`}
        >
          <Folder cover={f.cover} sheets={f.sheets} reserveSheets className="transition-transform group-hover:-translate-y-0.5" />
          <span className="truncate text-sm font-medium">{f.title}</span>
        </Link>
      ))}
      {editing && <EditMenu target={editing} onClose={() => setEditing(null)} />}
    </>
  );
}
