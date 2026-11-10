"use client";

import Link from "next/link";
import { useState } from "react";
import { Folder } from "../Covers";
import type { FolderItem } from "@/lib/blockData";
import { EditMenu, menuAt, type EditTarget } from "./EditMenu";

// The folders in a row; right-click one to rename it or change its cover.
export function FolderTiles({ items }: { items: FolderItem[] }) {
  const [editing, setEditing] = useState<EditTarget | null>(null);
  return (
    <>
      {items.map((f) => (
        <Link
          key={f.id}
          href={f.href}
          onContextMenu={(e) => {
            e.preventDefault();
            setEditing({ kind: "folder", id: f.id, name: f.title, cover: f.cover, ...menuAt(e) });
          }}
          className="group flex min-w-0 flex-col gap-2 sm:w-28"
        >
          <Folder cover={f.cover} sheets={f.sheets} reserveSheets className="transition-transform group-hover:-translate-y-0.5" />
          <span className="truncate text-sm font-medium">{f.title}</span>
        </Link>
      ))}
      {editing && <EditMenu target={editing} onClose={() => setEditing(null)} />}
    </>
  );
}
