"use client";

import { useT } from "@/app/LangProvider";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { cardsForNextNotes } from "../actions";

// "✦ Crear tests de todos mis apuntes": goes through every note without
// cards, a few at a time, showing how far it's got.
export function MakeAllCards({ pending }: { pending: number }) {
  const t = useT();
  const router = useRouter();
  const [state, setState] = useState<{ running: boolean; done: number; made: number; total: number; error: string | null; finished: boolean }>({ running: false, done: 0, made: 0, total: pending, error: null, finished: false });

  async function run() {
    let skip: string[] = [];
    let made = 0;
    setState({ running: true, done: 0, made: 0, total: pending, error: null, finished: false });
    for (let guard = 0; guard < 200; guard++) {
      const r = await cardsForNextNotes(skip).catch(() => ({ error: t("Algo ha fallado. Vuelve a intentarlo."), made: 0, done: [] as string[], left: 0 }));
      skip = [...skip, ...r.done];
      made += r.made;
      setState((s) => ({ ...s, done: skip.length, made, total: skip.length + r.left, error: r.error }));
      if (r.error || r.left === 0 || r.done.length === 0) break;
    }
    setState((s) => ({ ...s, running: false, finished: true }));
    router.refresh();
  }

  if (pending === 0 && !state.finished) return <p className="text-[13px] text-ink-faint">{t("Todos tus apuntes ya tienen preguntas ✓")}</p>;
  const pct = state.total ? Math.round((state.done / state.total) * 100) : 100;
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-accent-soft px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="min-w-0 flex-1 text-sm">
          {state.finished
            ? t("Listo: {0} preguntas nuevas de {1} apuntes.", { 0: state.made, 1: state.done })
            : state.running
              ? t("Leyendo tus apuntes… {0} de {1}", { 0: state.done, 1: state.total })
              : (
                <>
                  <b className="font-semibold">{t("{0} apuntes todavía no tienen preguntas.", { 0: pending })}</b>{" "}
                  <span className="text-ink-muted">{t("La IA puede crearlas para que los tests los cubran todos.")}</span>
                </>
              )}
        </span>
        {!state.running && !state.finished && (
          <button type="button" onClick={run} className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:brightness-95">
            ✦ {t("Crear tests de todos mis apuntes")}
          </button>
        )}
      </div>
      {(state.running || state.finished) && (
        <div className="h-1.5 overflow-hidden rounded-full bg-chip">
          <div className="h-full rounded-full bg-ink transition-[width] duration-500" style={{ width: `${pct}%` }} />
        </div>
      )}
      {state.error && <p className="text-xs text-red-600">{state.error}</p>}
    </div>
  );
}
