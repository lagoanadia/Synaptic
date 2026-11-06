import Link from "next/link";
import { Folder } from "../Covers";
import type { FolderItem, RecentPage } from "@/lib/blockData";

// Subjects as folders; the sheets peeking out are what's left.
export function FolderRow({ items, empty, after }: { items: FolderItem[]; empty?: React.ReactNode; after?: React.ReactNode }) {
  if (items.length === 0 && !after) return <p className="py-6 text-sm text-ink-faint">{empty ?? "Aún no hay carpetas."}</p>;
  return (
    <div className="grid grid-cols-3 items-end gap-x-4 gap-y-5 pt-2 sm:flex sm:flex-wrap sm:gap-x-6">
      {items.map((f) => (
        <Link key={f.id} href={f.href} className="group flex min-w-0 flex-col gap-2 sm:w-28">
          <Folder cover={f.cover} sheets={f.sheets} className="transition-transform group-hover:-translate-y-0.5" />
          <span className="truncate text-sm font-medium">{f.title}</span>
        </Link>
      ))}
      {after}
    </div>
  );
}

const ago = (d: Date) => {
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  return days <= 0 ? "hoy" : days === 1 ? "ayer" : days < 7 ? `hace ${days} días` : d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
};

export function RecentList({ pages }: { pages: RecentPage[] }) {
  if (pages.length === 0) return <p className="py-6 text-sm text-ink-faint">Aún no hay páginas.</p>;
  return (
    <ul className="flex flex-col">
      {pages.map((p) => (
        <li key={p.id}>
          <Link href={p.href} className="flex items-center gap-3 rounded-md border-b border-[#f1f1ef] px-1 py-2 text-sm hover:bg-[#fbfbfa]">
            <span aria-hidden>📄</span>
            <span className="min-w-0 flex-1 truncate font-medium">{p.title}</span>
            <span className="hidden text-xs text-ink-faint sm:inline">{p.where}</span>
            <span className="w-20 text-right text-xs text-ink-faint">{ago(p.at)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
