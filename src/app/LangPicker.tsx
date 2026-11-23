"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { LANGS, type Lang } from "@/lib/i18n";
import { useLang } from "./LangProvider";
import { setLang } from "./actions";

// Round flags drawn here (Windows shows emoji flags as letters).
function Flag({ l }: { l: Lang }) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden className="shrink-0 rounded-full shadow-[0_0_0_1px_rgba(0,0,0,.12)]">
      <defs>
        <clipPath id={`f-${l}`}>
          <circle cx="9" cy="9" r="9" />
        </clipPath>
      </defs>
      <g clipPath={`url(#f-${l})`}>
        {l === "es" && (
          <>
            <rect width="18" height="18" fill="#c60b1e" />
            <rect y="4.5" width="18" height="9" fill="#ffc400" />
          </>
        )}
        {l === "de" && (
          <>
            <rect width="18" height="6" fill="#000" />
            <rect y="6" width="18" height="6" fill="#dd0000" />
            <rect y="12" width="18" height="6" fill="#ffce00" />
          </>
        )}
        {l === "en" && (
          <>
            <rect width="18" height="18" fill="#012169" />
            <path d="M0 0 18 18M18 0 0 18" stroke="#fff" strokeWidth="3.6" />
            <path d="M0 0 18 18M18 0 0 18" stroke="#c8102e" strokeWidth="1.4" />
            <path d="M9 0v18M0 9h18" stroke="#fff" strokeWidth="5" />
            <path d="M9 0v18M0 9h18" stroke="#c8102e" strokeWidth="2.8" />
          </>
        )}
      </g>
    </svg>
  );
}

// ES · EN · DE as flags; the chosen one opens up to show its code.
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
    <span className={`flex items-center gap-0.5 rounded-full bg-chip p-1 ${pending ? "opacity-60" : ""} ${className}`} role="radiogroup" aria-label="Idioma / Language / Sprache">
      {LANGS.map((l) => (
        <button
          key={l}
          type="button"
          role="radio"
          aria-checked={lang === l}
          title={l.toUpperCase()}
          onClick={() => lang !== l && pick(l)}
          className={`flex items-center gap-1.5 rounded-full py-1 text-xs font-semibold uppercase transition-all duration-200 ${lang === l ? "bg-white px-2.5 text-ink shadow-sm" : "px-1 opacity-60 grayscale-[40%] hover:opacity-100"}`}
        >
          <Flag l={l} />
          {lang === l && l}
        </button>
      ))}
    </span>
  );
}
