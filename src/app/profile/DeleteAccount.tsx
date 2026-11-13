"use client";

import { useState, useTransition } from "react";
import { useT } from "@/app/LangProvider";
import { deleteAccount } from "./actions";

// In settings: delete the account, after typing the confirm word.
export function DeleteAccount() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  // The word to type, in your language (ELIMINAR / DELETE / LÖSCHEN).
  const word = t("ELIMINAR");
  const ask = t("Escribe {word} para confirmar", { word });
  return (
    <section className="mt-6 flex flex-col gap-3 border-t border-border-subtle pt-6 text-sm">
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="self-start text-ink-faint hover:text-red-600">
          {t("Eliminar cuenta")}
        </button>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => setError((await deleteAccount(text)).error));
          }}
          className="flex max-w-md flex-col gap-2 rounded-lg border border-red-200 bg-red-50 p-4"
        >
          <b className="text-red-700">{t("Eliminar cuenta")}</b>
          <span className="text-ink-muted">{t("Se borran tu cuenta, tus libretas, carpetas, páginas y tarjetas. No se puede deshacer.")}</span>
          <span className="text-ink-muted">{ask}</span>
          <input autoFocus value={text} onChange={(e) => setText(e.target.value)} aria-label={ask} className="rounded-md border border-red-200 bg-white px-2 py-1" />
          {error && <span className="text-red-600">{t(error)}</span>}
          <span className="flex gap-2">
            <button type="submit" disabled={pending || text.trim().toUpperCase() !== word} className="rounded-md bg-red-600 px-3 py-1.5 font-medium text-white disabled:opacity-40">
              {pending ? t("Eliminando…") : t("Eliminar para siempre")}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="px-2 text-ink-faint hover:text-ink">
              {t("Cancelar")}
            </button>
          </span>
        </form>
      )}
    </section>
  );
}
