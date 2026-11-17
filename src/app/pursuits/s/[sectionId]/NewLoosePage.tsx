"use client";

import { useLocale, useT } from "@/app/LangProvider";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type { LoosePage } from "@/lib/blockData";
import { newLoosePage } from "../../actions";
import { useOpenTab } from "./tabs";

// "Páginas +": pages right in the notebook, no folder needed. They belong
// to the section tab they were made on, and the list shows the open tab's.
export function LoosePages({ sectionId, groups, pages }: { sectionId: string; groups: string[]; pages: LoosePage[] }) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const tab = useOpenTab(groups);
  const [pending, start] = useTransition();
  const shown = tab ? pages.filter((p) => p.group === tab) : pages;
  return (
    <section className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5 border-b border-border-subtle pb-1">
        <h2 className="text-sm font-semibold">{t("Páginas")}</h2>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const href = await newLoosePage(sectionId, tab);
              if (href) router.push(href);
            })
          }
          aria-label={t("Nueva página")}
          title={t("Nueva página")}
          className="grid size-6 place-items-center rounded-md text-ink-faint hover:bg-chip hover:text-ink disabled:opacity-50"
        >
          {pending ? "…" : "+"}
        </button>
      </div>
      {shown.length === 0 ? (
        <p className="py-2 text-[13px] text-ink-faint">{t("Escribe una página aquí sin meterla en ninguna carpeta.")}</p>
      ) : (
        <ul className="flex flex-col">
          {shown.map((p) => (
            <li key={p.id}>
              <Link href={p.href} className="flex items-center gap-3 rounded-md border-b border-[#f1f1ef] px-1 py-2 text-sm hover:bg-[#fbfbfa]">
                <span aria-hidden>📄</span>
                <span className="min-w-0 flex-1 truncate font-medium">{p.title}</span>
                <span className="w-20 text-right text-xs text-ink-faint">{new Date(p.at).toLocaleDateString(locale, { day: "numeric", month: "short" })}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
