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
        <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-2 self-start rounded-full bg-[#e5484d] px-4 py-2 text-sm font-semibold text-white transition-transform hover:-translate-y-px hover:bg-[#d93f44] active:translate-y-0">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
          </svg>
          {t("Eliminar cuenta")}
        </button>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => setError((await deleteAccount(text)).error));
          }}
          className="flex max-w-md flex-col gap-2 rounded-xl border border-[#e5484d]/40 bg-[#e5484d]/10 p-4"
        >
          <b className="text-[#e5484d]">{t("Eliminar cuenta")}</b>
          <span className="text-ink-muted">{t("Se borran tu cuenta, tus libretas, carpetas, páginas y tarjetas. No se puede deshacer.")}</span>
          <span className="text-ink-muted">{ask}</span>
          <input autoFocus value={text} onChange={(e) => setText(e.target.value)} aria-label={ask} className="rounded-md border border-[#e5484d]/40 bg-transparent px-2 py-1" />
          {error && <span className="text-red-600">{t(error)}</span>}
          <span className="flex gap-2">
            <button type="submit" disabled={pending || text.trim().toUpperCase() !== word} className="rounded-full bg-[#e5484d] px-4 py-1.5 font-semibold text-white disabled:opacity-40">
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
