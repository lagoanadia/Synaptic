"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { LANGS, type Lang } from "@/lib/i18n";
import { useLang } from "./LangProvider";
import { setLang } from "./actions";

// ES · EN · DE: the app's language.
export function LangPicker({ className = "" }: { className?: string }) {
  const lang = useLang();
  const router = useRouter();
  const [pending, start] = useTransition();
  const pick = (l: Lang) =>
    start(async () => {
      await setLang(l);
      router.refresh();
    });
  return (
    <span className={`flex rounded-md bg-black/5 p-0.5 text-[11px] font-semibold ${pending ? "opacity-60" : ""} ${className}`} role="radiogroup" aria-label="Idioma / Language / Sprache">
      {LANGS.map((l) => (
        <button
          key={l}
          type="button"
          role="radio"
          aria-checked={lang === l}
          onClick={() => lang !== l && pick(l)}
          className={`rounded px-1.5 py-0.5 uppercase ${lang === l ? "bg-white text-ink shadow-sm" : "text-ink-faint hover:text-ink"}`}
        >
          {l}
        </button>
      ))}
    </span>
  );
}
