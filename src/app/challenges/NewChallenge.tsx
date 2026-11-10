"use client";

import { useT } from "@/app/LangProvider";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { draftChallenge } from "./actions";
import { checkAndSave } from "./checkAndSave";
import { LANGUAGE_INFO, LANGUAGES, type Language } from "@/lib/challenge";
import { DIFFICULTIES } from "./look";
import { Badge, Bars } from "./ChallengeList";

// "Dame 3": language, difficulty, which folder's notes. The AI maps the
// skills in that material and writes one challenge per skill.
export function NewChallenge({ subjects, defaultSubject }: { subjects: { id: string; title: string }[]; defaultSubject: string | null }) {
  const t = useT();
  const router = useRouter();
  const [language, setLanguage] = useState<Language>("javascript");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("easy");
  const [subject, setSubject] = useState(defaultSubject ?? subjects[0]?.id ?? "");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function create() {
    setError(null);
    start(async () => {
      setStatus("Buscando qué practicar…");
      const r = await draftChallenge({ language, difficulty, pursuitId: subject || null, topic: "" });
      if (r.error || !r.drafts) {
        setStatus(null);
        return setError(r.error ?? "Inténtalo de nuevo");
      }
      setStatus(language === "javascript" ? "Comprobando…" : `Comprobando (cargando ${LANGUAGE_INFO[language].label})…`);
      const saved = (await checkAndSave(language, r.drafts, 3)).length;
      setStatus(null);
      if (saved === 0) return setError("No han pasado la comprobación — inténtalo de nuevo");
      router.refresh();
    });
  }

  const tile = (on: boolean) => `grid place-items-center rounded-lg py-2.5 transition-colors ${on ? "bg-white ring-[1.5px] ring-ink" : "bg-chip hover:bg-[#ebebea]"}`;

  return (
    <aside className="flex flex-col gap-3 rounded-xl border border-border-subtle p-4 lg:sticky lg:top-6">
      <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label={t("Lenguaje")}>
        {LANGUAGES.map((l) => (
          <button key={l} type="button" role="radio" aria-checked={language === l} title={t(LANGUAGE_INFO[l].label)} onClick={() => setLanguage(l)} className={tile(language === l)}>
            <Badge language={l} />
          </button>
        ))}
      </div>
      <p className="-mt-1 text-xs leading-snug text-ink-faint">
        <span className="font-medium text-ink-muted">{t(LANGUAGE_INFO[language].label)}:</span> {t(LANGUAGE_INFO[language].hint)}
      </p>
      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={t("Dificultad")}>
        {DIFFICULTIES.map((d, n) => (
          <button key={d.key} type="button" role="radio" aria-checked={difficulty === d.key} title={t(d.label)} onClick={() => setDifficulty(d.key)} className={`${tile(difficulty === d.key)} py-3.5`}>
            <Bars n={n} color={d.bar} />
          </button>
        ))}
      </div>
      {subjects.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1" role="radiogroup" aria-label={t("De qué carpeta")}>
          {[...subjects.slice(0, 6), { id: "", title: "Todo" }].map((s) => (
            <button
              key={s.id || "all"}
              type="button"
              role="radio"
              aria-checked={subject === s.id}
              onClick={() => setSubject(s.id)}
              className={`max-w-full truncate rounded-full px-2.5 py-1 text-xs transition-colors ${subject === s.id ? "bg-accent text-white" : "bg-chip text-ink-muted hover:text-ink"}`}
            >
              {s.title}
            </button>
          ))}
        </div>
      )}
      <button type="button" onClick={create} disabled={pending} className="mt-2 flex items-center justify-center gap-2.5 rounded-lg bg-accent py-3 text-sm font-semibold text-white disabled:opacity-60">
        {pending ? (
          (status ?? t("Trabajando…"))
        ) : (
          <>
            <span className="flex gap-1" aria-hidden>
              {[0, 1, 2].map((k) => (
                <span key={k} className="size-2.5 rounded-[3px] border-[1.5px] border-white/90" />
              ))}
            </span>
            {t("Dame 3")}
          </>
        )}
      </button>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </aside>
  );
}
