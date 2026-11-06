"use client";

import { ArrowRight } from "@/app/icons";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { draftChallenge, saveChallenge } from "./actions";
import { runInSandbox } from "./sandbox";
import { LANGUAGE_INFO, LANGUAGES, type Language } from "@/lib/challenge";
import { DIFFICULTIES, LANGUAGE_STYLE } from "./look";

export function NewChallenge({
  subjects,
  defaultSubject,
}: {
  subjects: { id: string; title: string }[];
  defaultSubject: string | null;
}) {
  const router = useRouter();
  const [language, setLanguage] = useState<Language>("javascript");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("easy");
  const [subject, setSubject] = useState(defaultSubject ?? "");
  const [topic, setTopic] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function create() {
    setError(null);
    startTransition(async () => {
      setStatus("Escribiendo retos…");
      const r = await draftChallenge({ language, difficulty, pursuitId: subject || null, topic });
      if (r.error || !r.drafts) {
        setStatus(null);
        return setError(r.error ?? "Reintentar");
      }
      // Check each answer key in the sandbox; keep only tests its reference
      // solution actually passes, and only challenges with 2+ of them.
      setStatus(language === "javascript" ? "Comprobando…" : `Comprobando (cargando ${LANGUAGE_INFO[language].label})…`);
      let saved = 0;
      for (const draft of r.drafts) {
        const check = await runInSandbox(language, draft.solution, draft.entry, draft.tests);
        const passing = check.error ? [] : draft.tests.filter((_, i) => check.results[i]?.ok);
        if (passing.length < 2) continue;
        if (!(await saveChallenge(draft, passing)).error) saved++;
      }
      setStatus(null);
      if (saved === 0) return setError("No han pasado la comprobación — inténtalo de nuevo");
      router.refresh();
    });
  }


  const topics = TOPICS[language];

  return (
    <div className="flex flex-col gap-5 rounded-3xl bg-white p-5 shadow-[0_1px_2px_rgba(13,13,13,0.06)]">
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Lenguaje">
        {LANGUAGES.map((l) => (
          <button
            key={l}
            type="button"
            role="radio"
            aria-checked={language === l}
            onClick={() => setLanguage(l)}
            className={`flex items-center gap-3 rounded-2xl border-2 p-2.5 text-left transition-colors ${
              language === l ? "border-ink bg-white" : "border-transparent bg-chip hover:border-border-subtle"
            }`}
          >
            <span className={`grid size-10 shrink-0 place-items-center rounded-xl font-mono text-sm font-extrabold ${LANGUAGE_STYLE[l].badge}`}>
              {LANGUAGE_INFO[l].short}
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="text-sm font-bold">{LANGUAGE_INFO[l].label}</span>
              <span className="truncate text-xs text-ink-muted">{LANGUAGE_STYLE[l].what}</span>
            </span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Dificultad">
        {DIFFICULTIES.map((d, n) => (
          <button
            key={d.key}
            type="button"
            role="radio"
            aria-checked={difficulty === d.key}
            onClick={() => setDifficulty(d.key)}
            className={`flex flex-col items-center gap-2 rounded-2xl border-2 px-2 py-3 transition-colors ${
              difficulty === d.key ? "border-ink bg-white" : "border-transparent bg-chip hover:border-border-subtle"
            }`}
          >
            <span className="flex h-5 items-end gap-1" aria-hidden>
              {[0, 1, 2].map((b) => (
                <span key={b} className={`w-1.5 rounded-full ${b <= n ? d.bar : "bg-ink-faint/30"}`} style={{ height: `${(b + 1) * 6 + 2}px` }} />
              ))}
            </span>
            <span className="text-xs font-bold capitalize">{d.label}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-bold text-ink-muted">De mis notas</span>
        <div className="flex flex-wrap gap-1.5">
          {[{ id: "", title: "Todo" }, ...subjects].map((s) => (
            <button
              key={s.id}
              type="button"
              aria-pressed={subject === s.id}
              onClick={() => setSubject(s.id)}
              className={`max-w-full truncate rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                subject === s.id ? "bg-tile-sky text-white" : "bg-chip text-ink-muted hover:text-ink"
              }`}
            >
              {s.title}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-1.5">
          {topics.map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={topic === t}
              onClick={() => setTopic(topic === t ? "" : t)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                topic === t ? "border-ink bg-ink text-white" : "border-border-subtle text-ink-muted hover:text-ink"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="…o cualquier tema"
          aria-label="Tema"
          className="rounded-2xl border border-border-subtle px-4 py-2.5 text-sm"
        />
      </div>

      <button
        type="button"
        onClick={create}
        disabled={isPending}
        className="flex items-center justify-center gap-3 rounded-2xl bg-mint px-6 py-3.5 text-sm font-bold text-white disabled:opacity-60"
      >
        {isPending ? (
          (status ?? "Trabajando…")
        ) : (
          <>
            <span className="flex gap-1" aria-hidden>
              {[0, 1, 2].map((k) => (
                <span key={k} className="size-2 rounded-sm bg-white/80" />
              ))}
            </span>
            Dame 3 <ArrowRight />
          </>
        )}
      </button>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}




const TOPICS: Record<Language, string[]> = {
  javascript: ["arrays", "strings", "objetos", "recursividad"],
  typescript: ["tipos", "interfaces", "genéricos", "arrays"],
  python: ["listas", "diccionarios", "strings", "recursividad"],
  react: ["props", "listas", "renderizado condicional", "estado"],
};
