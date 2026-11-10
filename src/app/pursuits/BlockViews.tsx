import { getLang, getT } from "@/lib/i18n/server";
import { LOCALE, type T } from "@/lib/i18n";
import Link from "next/link";
import { FolderTiles } from "./FolderTiles";
import type { FolderItem, RecentPage } from "@/lib/blockData";

// Subjects as folders; the sheets peeking out are what's left.
export async function FolderRow({ items, empty, after }: { items: FolderItem[]; empty?: React.ReactNode; after?: React.ReactNode }) {
  const t = await getT();
  if (items.length === 0 && !after) return <p className="py-6 text-sm text-ink-faint">{empty ?? t("Aún no hay carpetas.")}</p>;
  return (
    <div className="grid grid-cols-3 items-start gap-x-4 gap-y-5 pt-2 sm:flex sm:flex-wrap sm:gap-x-6">
      <FolderTiles items={items} />
      {after && (
        // The same room above as a folder (sheets + tab), so "+" lines up with the covers.
        <div className="flex flex-col sm:w-28">
          <div className="pt-[12%]" />
          <div className="pt-[min(max(1.5px,5.5%),15px)]" />
          {after}
        </div>
      )}
    </div>
  );
}

const ago = (d: Date, t: T, locale: string) => {
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  return days <= 0 ? t("hoy") : days === 1 ? t("ayer") : days < 7 ? t("hace {0} días", { 0: days }) : d.toLocaleDateString(locale, { day: "numeric", month: "short" });
};

export async function RecentList({ pages }: { pages: RecentPage[] }) {
  const t = await getT();
  const locale = LOCALE[await getLang()];
  if (pages.length === 0) return <p className="py-6 text-sm text-ink-faint">{t("Aún no hay páginas.")}</p>;
  return (
    <ul className="flex flex-col">
      {pages.map((p) => (
        <li key={p.id}>
          <Link href={p.href} className="flex items-center gap-3 rounded-md border-b border-[#f1f1ef] px-1 py-2 text-sm hover:bg-[#fbfbfa]">
            <span aria-hidden>📄</span>
            <span className="min-w-0 flex-1 truncate font-medium">{p.title}</span>
            <span className="hidden text-xs text-ink-faint sm:inline">{p.where}</span>
            <span className="w-20 text-right text-xs text-ink-faint">{ago(p.at, t, locale)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
