"use client";

import { useT } from "@/app/LangProvider";
import { ask } from "@/app/ui/PopupHost";
import { useTransition } from "react";
import { deleteTest, renameTest } from "../actions";

// Rename or delete a saved test.
export function TestRowMenu({ id, title }: { id: string; title: string }) {
  const t = useT();
  const [pending, start] = useTransition();
  return (
    <span className="flex shrink-0 items-center">
      <button
        type="button"
        disabled={pending}
        onClick={async () => {
          const name = await ask.prompt(t("Nombre del test"), title);
          if (name && name.trim() !== title) start(() => renameTest(id, name));
        }}
        title={t("Renombrar")}
        aria-label={t("Renombrar")}
        className="rounded p-1 text-ink-faint hover:bg-chip hover:text-ink"
      >
        ✎
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={async () => {
          if (await ask.confirm(t("¿Borrar \"{0}\"?", { 0: title }), { danger: true })) start(() => deleteTest(id));
        }}
        title={t("Borrar")}
        aria-label={t("Borrar")}
        className="rounded p-1 text-ink-faint hover:bg-chip hover:text-red-600"
      >
        ×
      </button>
    </span>
  );
}
