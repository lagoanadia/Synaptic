"use client";

import { useT } from "@/app/LangProvider";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { newLoosePage } from "../../actions";

// "+ Página": a page right in the notebook, no folder needed.
export function NewLoosePage({ sectionId }: { sectionId: string }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const href = await newLoosePage(sectionId);
          if (href) router.push(href);
        })
      }
      className="rounded-md px-2 py-1 text-[13px] text-ink-muted hover:bg-chip hover:text-ink disabled:opacity-50"
    >
      {pending ? t("Creando…") : t("+ Página")}
    </button>
  );
}
