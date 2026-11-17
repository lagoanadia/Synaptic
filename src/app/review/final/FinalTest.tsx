"use client";

import { useT } from "@/app/LangProvider";
import { ask } from "@/app/ui/PopupHost";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Stage } from "../ReviewGames";
import { gradeAnswer, recordTestScore, saveTest, type Grade } from "../actions";

export type FinalQuestion = { id: string; prompt: string; reference: string; subject: string };

const VERDICT: { score: 0 | 1 | 2; label: string; tone: string }[] = [
  { score: 2, label: "✓ Bien", tone: "bg-[#22c55e] text-white" },
  { score: 1, label: "◐ A medias", tone: "bg-[#f5b82e] text-[#1a1a1d]" },
  { score: 0, label: "✗ Mal", tone: "bg-[#e5484d] text-white" },
];

// One question at a time: write your answer, "Corregir", and the AI says how
// it went and what was missing next to your notes' answer. Its mark can be
// changed if it got it wrong. At the end: the score, and save it to retake.
export function FinalTest({ questions, testId, saveAs }: { questions: FinalQuestion[]; testId: string | null; saveAs: { title: string; pursuitId: string | null; unitId: string | null } | null }) {
  const t = useT();
  const [i, setI] = useState(0);
  const [written, setWritten] = useState<string[]>(() => questions.map(() => ""));
  const [grades, setGrades] = useState<(Grade | null)[]>(() => questions.map(() => null));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<"no" | "busy" | "yes">(testId ? "yes" : "no");
  const graded = useRef(0);
  const shell = { backHref: "/review/tests" };
  const done = i >= questions.length;
  const score = grades.reduce((n, g) => n + (g?.score ?? 0), 0);
  const max = questions.length * 2;

  const recorded = useRef(false);
  useEffect(() => {
    if (!done || !testId || recorded.current) return;
    recorded.current = true;
    void recordTestScore(testId, score);
  }, [done, testId, score]);

  if (questions.length === 0)
    return (
      <Stage {...shell} total={1} done={0}>
        <p className="text-xl font-semibold">{t("Aún no hay preguntas")}</p>
        <p className="max-w-sm text-center text-white/60">{t("Escribe y organiza apuntes en esta asignatura para tener tarjetas y conceptos.")}</p>
      </Stage>
    );

  if (done) {
    const pct = max ? (score / max) * 100 : 0;
    return (
      <Stage {...shell} total={questions.length} done={questions.length}>
        <div className="grid size-44 place-items-center rounded-full" style={{ background: `conic-gradient(#22c55e 0 ${pct}%, rgba(255,255,255,.1) ${pct}% 100%)` }}>
          <div className="grid size-[148px] place-items-center rounded-full bg-[#18181b]">
            <b className="text-4xl tabular-nums">{Math.round(pct)}%</b>
          </div>
        </div>
        <div className="flex w-full max-w-[680px] flex-col gap-2">
          {questions.map((q, n) => {
            const g = grades[n];
            const v = VERDICT.find((x) => x.score === (g?.score ?? 0))!;
            return (
              <div key={q.id + n} className="flex items-start gap-3 rounded-xl bg-white px-4 py-3 text-[#18181b]">
                <span className={`mt-0.5 shrink-0 rounded-md px-2 py-0.5 text-xs font-bold ${v.tone}`}>{t(v.label)}</span>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <b className="text-sm leading-snug">{q.prompt}</b>
                  {g?.missing && <span className="text-[13px] text-[#57534e]">{g.missing}</span>}
                </span>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-3">
          {!testId && saveAs && (
            <button
              type="button"
              disabled={saved !== "no"}
              onClick={async () => {
                const title = await ask.prompt(t("Nombre del test"), saveAs.title);
                if (title === null) return;
                setSaved("busy");
                const id = await saveTest({ title, kind: "final", pursuitId: saveAs.pursuitId, unitId: saveAs.unitId, items: questions, score });
                setSaved(id ? "yes" : "no");
              }}
              className="h-12 rounded-xl bg-[#2383e2] px-4 text-sm font-semibold shadow-[inset_0_-4px_0_rgba(0,0,0,.2)] disabled:opacity-80"
            >
              {saved === "yes" ? `✓ ${t("Guardado")}` : saved === "busy" ? "…" : t("Guardar test")}
            </button>
          )}
          <Link href="/review/tests" className="h-12 rounded-xl bg-[#22c55e] px-5 pt-3.5 text-sm font-semibold shadow-[inset_0_-4px_0_rgba(0,0,0,.2)]">
            {t("Terminar")}
          </Link>
        </div>
      </Stage>
    );
  }

  const q = questions[i];
  const g = grades[i];
  async function correct() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const r = await gradeAnswer({ prompt: q.prompt, reference: q.reference, written: written[i], first: graded.current === 0 });
    setBusy(false);
    if (r.error || !r.grade) return setError(r.error ?? t("No he podido corregirla ahora. Inténtalo otra vez."));
    graded.current += 1;
    setGrades((gs) => gs.map((x, n) => (n === i ? r.grade! : x)));
  }
  const setScore = (s: 0 | 1 | 2) => setGrades((gs) => gs.map((x, n) => (n === i && x ? { ...x, score: s } : x)));

  return (
    <Stage {...shell} total={questions.length} done={i}>
      <div className="flex w-full max-w-[760px] flex-col gap-4">
        <div className="rounded-2xl bg-white px-6 py-5 text-[#18181b]">
          <span className="text-xs text-[#78716c]">
            {q.subject} · {t("Pregunta {0} de {1}", { 0: i + 1, 1: questions.length })}
          </span>
          <p className="mt-1 text-xl leading-snug font-bold">{q.prompt}</p>
        </div>
        <textarea
          autoFocus
          value={written[i]}
          disabled={!!g}
          onChange={(e) => setWritten((w) => w.map((x, n) => (n === i ? e.target.value : x)))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              if (g) setI(i + 1);
              else correct();
            }
          }}
          placeholder={t("Escribe tu respuesta con tus palabras…")}
          rows={5}
          className="w-full resize-y rounded-2xl bg-white/95 px-5 py-4 text-[15px] leading-relaxed text-[#18181b] outline-none placeholder:text-[#a8a29e] disabled:bg-white/80"
        />
        {error && <p className="text-sm text-[#ff9b94]">{error}</p>}
        {g && (
          <div className="flex flex-col gap-3 rounded-2xl bg-white/8 px-5 py-4">
            <div className="flex flex-wrap items-center gap-2">
              {VERDICT.map((v) => (
                <button
                  key={v.score}
                  type="button"
                  onClick={() => setScore(v.score)}
                  title={t("Cambiar la nota si la IA se ha equivocado")}
                  className={`rounded-lg px-3 py-1 text-sm font-bold transition-opacity ${v.tone} ${g.score === v.score ? "" : "opacity-30 hover:opacity-70"}`}
                >
                  {t(v.label)}
                </button>
              ))}
            </div>
            {g.feedback && <p className="text-[15px] text-white/90">{g.feedback}</p>}
            {g.missing && (
              <p className="text-sm text-white/70">
                <b className="text-white/90">{t("Te faltó")}:</b> {g.missing}
              </p>
            )}
            <details className="text-sm text-white/70">
              <summary className="cursor-pointer text-white/80">{t("Según tus apuntes")}</summary>
              <p className="mt-1 whitespace-pre-line">{q.reference}</p>
            </details>
          </div>
        )}
        <div className="flex justify-end gap-2">
          {!g ? (
            <button type="button" onClick={correct} disabled={busy} className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-[#1a1a1d] disabled:opacity-60">
              {busy ? t("Corrigiendo…") : t("Corregir")} <span className="text-xs text-[#a8a29e]">⌘↵</span>
            </button>
          ) : (
            <button type="button" onClick={() => setI(i + 1)} className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-[#1a1a1d]">
              {i + 1 < questions.length ? t("Siguiente") : t("Ver resultado")} <span className="text-xs text-[#a8a29e]">⌘↵</span>
            </button>
          )}
        </div>
      </div>
    </Stage>
  );
}
