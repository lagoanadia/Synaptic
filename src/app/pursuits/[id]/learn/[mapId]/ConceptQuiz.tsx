"use client";

import { useT } from "@/app/LangProvider";
import { useEffect, useRef, useState } from "react";
import { CheckIcon, XIcon } from "@/app/icons";
import { isCorrect, shuffledOrder, type QuizAnswer, type QuizQuestion } from "@/lib/conceptQuiz";
import type { Status } from "@/lib/internalize";
import { makeConceptQuiz, recordConceptQuiz } from "../actions";

// A short mixed exam on the concept: one question at a time, instant
// feedback, score at the end (which moves the concept's status).
export function ConceptQuiz({
  conceptId,
  startRef,
  onStatus,
  onDontKnow,
  auto = false,
  onFinish,
}: {
  conceptId: string;
  startRef: React.RefObject<HTMLButtonElement | null>;
  onStatus: (s: Status) => void;
  onDontKnow: () => void;
  // Aprender's ✓: start right away, and hand the result back instead of
  // showing a score screen.
  auto?: boolean;
  onFinish?: (passed: boolean, status: Status | null) => void;
}) {
  const t = useT();
  const [questions, setQuestions] = useState<QuizQuestion[] | null>(null);
  const [i, setI] = useState(0);
  const [answer, setAnswer] = useState<QuizAnswer>(null);
  const [checked, setChecked] = useState(false);
  const [results, setResults] = useState<boolean[]>([]);
  // What was answered to each question, for the results screen.
  const [given, setGiven] = useState<QuizAnswer[]>([]);
  // Set once the last answer is in and the score is saved.
  const [final, setFinal] = useState<{ status: Status | null } | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setLoading(true);
    setError(null);
    const r = await makeConceptQuiz(conceptId);
    setLoading(false);
    if (r.error !== null) return setError(r.error);
    setQuestions(r.questions);
    setI(0);
    setAnswer(null);
    setChecked(false);
    setResults([]);
    setGiven([]);
    setFinal(null);
  }

  // Mount-time start for Aprender's ✓ (data fetch, not derived state).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (auto) start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const q = questions?.[i];
  const done = !!final;

  function check() {
    if (!q || answer === null || answer === "") return;
    setChecked(true);
    setResults((r) => [...r, isCorrect(q, answer)]);
    setGiven((g) => [...g, answer]);
  }

  function next() {
    if (!questions) return;
    setChecked(false);
    setAnswer(null);
    if (i + 1 < questions.length) setI(i + 1);
    else {
      const correct = results.filter(Boolean).length;
      setSaving(true);
      recordConceptQuiz(conceptId, correct, questions.length).then((r) => {
        setSaving(false);
        if (r.error === null) onStatus(r.status);
        setFinal({ status: r.error === null ? r.status : null });
      });
    }
  }

  // Enter checks / continues; number keys pick an option.
  useEffect(() => {
    if (!q || done) return;
    function onKey(e: KeyboardEvent) {
      const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      if (e.key === "Enter" && !(typing && !checked && q!.kind === "blank")) {
        e.preventDefault();
        if (checked) next();
        else check();
        return;
      }
      if (typing || checked) return;
      const n = Number(e.key) - 1;
      if (q!.kind === "choice" && n >= 0 && n < q!.options.length) setAnswer(n);
      if (q!.kind === "truefalse" && (n === 0 || n === 1)) setAnswer(n === 0);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const card = "flex flex-col gap-4 rounded-lg border border-border-subtle bg-white p-5";

  if (!questions && auto) {
    return (
      <section className={card} aria-label={t("Comprobar")}>
        {error ? (
          <p className="flex items-center gap-3 text-sm text-red-500">
            <span className="flex-1">{error}</span>
            <button type="button" onClick={start} disabled={loading} aria-label={t("Reintentar")} title={t("Reintentar")} className="rounded-md px-2 py-1 text-lg text-ink-muted hover:bg-chip hover:text-ink disabled:opacity-40">
              ↻
            </button>
          </p>
        ) : <span className="h-1 w-24 animate-pulse rounded-full bg-chip" aria-label={t("Preparando preguntas")} />}
      </section>
    );
  }

  if (!questions) {
    return (
      <section className={card} aria-label={t("Examen")}>
        <div className="flex flex-wrap gap-2">
          <button
            ref={startRef}
            type="button"
            onClick={start}
            disabled={loading}
            className="rounded-full bg-tile-sky px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
          >
            {loading ? t("Escribiendo tu examen…") : t("Ponme un examen")} <kbd className="ml-1 text-xs opacity-70">q</kbd>
          </button>
          <button type="button" onClick={onDontKnow} className="rounded-full px-4 py-2.5 text-sm text-ink-muted hover:bg-chip">
            {t("No lo sé")}
          </button>
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
      </section>
    );
  }

  if (done) {
    const correct = results.filter(Boolean).length;
    const passed = correct / questions.length >= 0.8;
    return (
      <Results
        questions={questions}
        results={results}
        given={given}
        loading={loading}
        onRetry={start}
        onNext={onFinish && passed ? () => onFinish(true, final.status) : undefined}
        onExplain={onFinish && !passed ? () => onFinish(false, final.status) : undefined}
      />
    );
  }

  const right = checked && q ? isCorrect(q, answer) : null;
  const opt = (selected: boolean, isAnswer: boolean) =>
    `rounded-2xl border-2 px-4 py-3 text-left text-sm font-semibold ${
      checked
        ? isAnswer
          ? "border-mint bg-mint/10"
          : selected
            ? "border-crimson bg-crimson-soft"
            : "border-transparent bg-chip text-ink-muted"
        : selected
          ? "border-tile-sky bg-accent-soft"
          : "border-transparent bg-chip hover:border-border-subtle"
    }`;

  return (
    <section className={card} aria-label={t("Examen")}>
      <div className="flex gap-1" aria-label={t("Pregunta {0} de {1}", { 0: i + 1, 1: questions.length })}>
        {questions.map((_, k) => (
          <span
            key={k}
            className={`h-1.5 flex-1 rounded-full ${k < results.length ? (results[k] ? "bg-mint" : "bg-crimson") : k === i ? "bg-tile-sky" : "bg-chip"}`}
          />
        ))}
      </div>

      {q && <p className="text-lg leading-snug font-bold">{q.kind === "blank" ? q.prompt.replace(/_{3,}/g, "____") : q.prompt}</p>}

      {q?.kind === "choice" && (
        <div className="grid gap-2 sm:grid-cols-2">
          {q.options.map((o, k) => (
            <button key={k} type="button" disabled={checked} onClick={() => setAnswer(k)} className={opt(answer === k, checked && k === q.answer)}>
              <kbd className="mr-2 text-xs opacity-50">{k + 1}</kbd>
              {o}
            </button>
          ))}
        </div>
      )}

      {q?.kind === "truefalse" && (
        <div className="grid grid-cols-2 gap-2">
          {[true, false].map((v, k) => (
            <button key={k} type="button" disabled={checked} onClick={() => setAnswer(v)} className={opt(answer === v, checked && v === q.answer)}>
              <kbd className="mr-2 text-xs opacity-50">{k + 1}</kbd>
              {v ? t("Verdadero") : t("Falso")}
            </button>
          ))}
        </div>
      )}

      {q?.kind === "blank" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            check();
          }}
          className="flex flex-col gap-2"
        >
          <input
            key={i}
            autoFocus
            disabled={checked}
            value={typeof answer === "string" ? answer : ""}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder={t("Tu respuesta")}
            aria-label={t("Tu respuesta")}
            className={`rounded-2xl border-2 px-4 py-3 text-sm ${checked ? (right ? "border-mint bg-mint/10" : "border-crimson bg-crimson-soft") : "border-border-subtle"}`}
          />
        </form>
      )}

      {q?.kind === "match" && (
        <Match key={i} pairs={q.pairs} seed={q.prompt} checked={checked} value={(answer as Record<number, number>) ?? {}} onChange={setAnswer} />
      )}

      {checked && q && (
        <div
          key={`fb-${i}`}
          role="status"
          className={`flex items-start gap-3 rounded-2xl px-4 py-3 ${right ? "bg-mint/10" : "bg-crimson-soft"}`}
          style={{ animation: right ? "pop-in .25s ease-out" : "shake .35s" }}
        >
          <span className={`grid size-8 shrink-0 place-items-center rounded-full text-white ${right ? "bg-mint" : "bg-crimson"}`}>
            {right ? <CheckIcon size={16} /> : <XIcon size={16} />}
          </span>
          <span className="flex min-w-0 flex-col gap-0.5 text-sm">
            <span className={`font-bold ${right ? "text-mint" : "text-crimson"}`}>{right ? t("¡Correcto!") : t("No era esa")}</span>
            {!right && q.kind !== "match" && (
              <span>
                <span className="text-ink-muted">{t("Respuesta correcta")}: </span>
                <span className="font-semibold">{solution(q, t)}</span>
              </span>
            )}
            {q.why && <span className="leading-relaxed text-ink-muted">{q.why}</span>}
          </span>
        </div>
      )}

      <button
        type="button"
        onClick={checked ? next : check}
        disabled={saving || (!checked && (answer === null || answer === "" || (q?.kind === "match" && Object.keys(answer as object).length < q.pairs.length)))}
        className={`self-end rounded-full px-6 py-2.5 text-sm font-bold text-white disabled:opacity-40 ${
          checked ? (right ? "bg-mint" : "bg-crimson") : "bg-ink"
        }`}
      >
        {checked ? (i + 1 < questions.length ? t("Siguiente") : saving ? t("Guardando…") : t("Ver resultado")) : t("Comprobar")}
      </button>
    </section>
  );
}

// Click a term, then its match. Pairs get the same number.
function Match({
  pairs,
  seed,
  checked,
  value,
  onChange,
}: {
  pairs: { left: string; right: string }[];
  seed: string;
  checked: boolean;
  value: Record<number, number>;
  onChange: (v: Record<number, number>) => void;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const order = shuffledOrder(pairs.length, seed);
  const leftFor = (r: number) => Object.entries(value).find(([, v]) => v === r)?.[0];

  function pickRight(r: number) {
    if (checked || picked === null) return;
    const next = Object.fromEntries(Object.entries(value).filter(([l, v]) => Number(l) !== picked && v !== r));
    onChange({ ...next, [picked]: r });
    const free = pairs.findIndex((_, l) => l !== picked && !(l in next));
    setPicked(free === -1 ? null : free);
  }

  const state = (l: number) => (checked ? (value[l] === l ? "border-mint bg-mint/10" : "border-crimson bg-crimson-soft") : "");

  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
      <div className="flex flex-col gap-2">
        {pairs.map((p, l) => (
          <button
            key={l}
            type="button"
            disabled={checked}
            onClick={() => setPicked(l)}
            className={`flex items-center gap-2 rounded-2xl border-2 px-3 py-2.5 text-left text-sm font-semibold ${
              state(l) || (picked === l ? "border-tile-sky bg-accent-soft" : "border-transparent bg-chip")
            }`}
          >
            <span className={`grid size-5 shrink-0 place-items-center rounded-full text-[11px] ${l in value ? "bg-ink text-white" : "bg-white"}`}>{l + 1}</span>
            {p.left}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        {order.map((r) => {
          const l = leftFor(r);
          return (
            <button
              key={r}
              type="button"
              disabled={checked}
              onClick={() => pickRight(r)}
              className={`flex items-center gap-2 rounded-2xl border-2 px-3 py-2.5 text-left text-sm ${
                checked ? (l !== undefined && Number(l) === r ? "border-mint bg-mint/10" : "border-crimson bg-crimson-soft") : "border-transparent bg-chip hover:border-border-subtle"
              }`}
            >
              <span className={`grid size-5 shrink-0 place-items-center rounded-full text-[11px] ${l !== undefined ? "bg-ink text-white" : "bg-white"}`}>
                {l !== undefined ? Number(l) + 1 : ""}
              </span>
              <span className="min-w-0 flex-1">
                {pairs[r].right}
                {checked && (l === undefined || Number(l) !== r) && <span className="block text-xs text-ink-muted">→ {pairs[r].left}</span>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

type T = ReturnType<typeof useT>;

// The right answer, as text.
function solution(q: QuizQuestion, t: T): string {
  switch (q.kind) {
    case "choice":
      return q.options[q.answer];
    case "truefalse":
      return q.answer ? t("Verdadero") : t("Falso");
    case "blank":
      return q.accepted[0];
    case "match":
      return q.pairs.map((p) => `${p.left} → ${p.right}`).join(" · ");
  }
}

// What the student answered, as text.
function said(q: QuizQuestion, a: QuizAnswer, t: T): string {
  if (a === null || a === "") return "—";
  switch (q.kind) {
    case "choice":
      return typeof a === "number" ? (q.options[a] ?? "—") : "—";
    case "truefalse":
      return a === true ? t("Verdadero") : a === false ? t("Falso") : "—";
    case "blank":
      return typeof a === "string" ? a : "—";
    case "match": {
      const m = (a ?? {}) as Record<number, number>;
      return q.pairs.map((p, l) => `${p.left} → ${q.pairs[m[l]]?.right ?? "—"}`).join(" · ");
    }
  }
}

// The end of the exam: the score fills a ring and counts up, then every
// question drops in, ticked or crossed. Missed ones open to show what you
// answered next to the right answer and why; right ones stay compact.
function Results({
  questions,
  results,
  given,
  loading,
  onRetry,
  onNext,
  onExplain,
}: {
  questions: QuizQuestion[];
  results: boolean[];
  given: QuizAnswer[];
  loading: boolean;
  onRetry: () => void;
  onNext?: () => void;
  onExplain?: () => void;
}) {
  const t = useT();
  const total = questions.length;
  const correct = results.filter(Boolean).length;
  const pct = total ? correct / total : 0;
  const tone = pct >= 0.8 ? "mint" : pct >= 0.5 ? "amber" : "crimson";
  const color = { mint: "var(--color-mint)", amber: "var(--color-amber)", crimson: "var(--color-crimson)" }[tone];
  const [shown, setShown] = useState(0);
  const [filled, setFilled] = useState(false);
  const [open, setOpen] = useState<Set<number>>(() => new Set(results.flatMap((r, k) => (r ? [] : [k]))));
  const nextBtn = useRef<HTMLButtonElement>(null);

  // Count up and fill the ring (one animation frame at a time).
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / 900);
      setFilled(true);
      setShown(Math.round(correct * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    nextBtn.current?.focus({ preventScroll: true });
    return () => cancelAnimationFrame(raf);
  }, [correct]);

  const R = 34;
  const C = 2 * Math.PI * R;
  const headline = pct === 1 ? t("¡Perfecto!") : pct >= 0.8 ? t("¡Lo tienes!") : pct >= 0.5 ? t("Casi") : t("Repásalo");
  const sub =
    pct >= 0.8
      ? t("Has acertado {0} de {1}. Sigue con el siguiente concepto.", { 0: correct, 1: total })
      : t("Has acertado {0} de {1}. Mira en qué fallaste antes de seguir.", { 0: correct, 1: total });

  return (
    <section className="flex flex-col gap-5 rounded-lg border border-border-subtle bg-white p-5" aria-label={t("Resultado del examen")} style={{ animation: "pop-in .3s ease-out" }}>
      <div className="flex items-center gap-5">
        <div className="relative grid size-[88px] shrink-0 place-items-center">
          <svg width="88" height="88" viewBox="0 0 88 88" className="absolute inset-0 -rotate-90" aria-hidden>
            <circle cx="44" cy="44" r={R} fill="none" stroke="var(--color-chip)" strokeWidth="8" />
            <circle
              cx="44"
              cy="44"
              r={R}
              fill="none"
              stroke={color}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={filled ? C * (1 - pct) : C}
              style={{ transition: "stroke-dashoffset .9s cubic-bezier(.2,.8,.2,1)" }}
            />
          </svg>
          <span className="relative text-2xl font-extrabold tabular-nums" style={{ color }}>
            {shown}
            <span className="text-base text-ink-faint">/{total}</span>
          </span>
          {pct >= 0.8 &&
            Array.from({ length: 12 }, (_, k) => (
              <span
                key={k}
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-1/2 size-1.5 rounded-full"
                style={
                  {
                    "--a": `${k * 30}deg`,
                    "--d": `${52 + (k % 3) * 12}px`,
                    background: ["var(--color-mint)", "var(--color-accent)", "var(--color-amber)", "#e255a1"][k % 4],
                    animation: "spark .8s ease-out .5s both",
                  } as React.CSSProperties
                }
              />
            ))}
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-2xl font-extrabold tracking-tight" style={{ color }}>
            {headline}
          </span>
          <span className="text-sm text-ink-muted">{sub}</span>
          <span className="mt-1 flex gap-1" aria-hidden>
            {results.map((r, k) => (
              <span key={k} className={`h-1.5 w-6 rounded-full ${r ? "bg-mint" : "bg-crimson"}`} style={{ animation: `pop-in .25s ease-out ${0.15 + k * 0.08}s both` }} />
            ))}
          </span>
        </div>
      </div>

      <ol className="flex flex-col gap-2">
        {questions.map((q, k) => {
          const ok = results[k];
          const isOpen = open.has(k);
          return (
            <li key={k} style={{ animation: `pop-in .3s ease-out ${0.35 + k * 0.09}s both` }}>
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() =>
                  setOpen((o) => {
                    const n = new Set(o);
                    if (n.has(k)) n.delete(k);
                    else n.add(k);
                    return n;
                  })
                }
                className={`flex w-full flex-col gap-2 rounded-2xl border-2 px-4 py-3 text-left transition-colors ${ok ? "border-mint/30 bg-mint/5 hover:bg-mint/10" : "border-crimson/30 bg-crimson-soft/60 hover:bg-crimson-soft"}`}
              >
                <span className="flex items-start gap-3">
                  <span className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-white ${ok ? "bg-mint" : "bg-crimson"}`}>
                    {ok ? <CheckIcon size={13} /> : <XIcon size={13} />}
                  </span>
                  <span className={`min-w-0 flex-1 text-sm font-semibold ${ok ? "text-ink-muted" : "text-ink"}`}>
                    {q.kind === "blank" ? q.prompt.replace(/_{3,}/g, "____") : q.prompt}
                  </span>
                  <span className={`mt-1 shrink-0 text-ink-faint transition-transform ${isOpen ? "rotate-180" : ""}`} aria-hidden>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </span>
                </span>
                {isOpen && (
                  <span className="flex flex-col gap-1.5 pl-9 text-[13px] leading-relaxed" style={{ animation: "fade-in .2s ease-out" }}>
                    {!ok && (
                      <span className="flex flex-wrap items-baseline gap-x-2">
                        <span className="text-[11px] font-bold tracking-wide text-crimson uppercase">{t("Tu respuesta")}</span>
                        <span className="text-ink-muted line-through decoration-crimson/60">{said(q, given[k], t)}</span>
                      </span>
                    )}
                    <span className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-[11px] font-bold tracking-wide text-mint uppercase">{t("Correcta")}</span>
                      <span className="font-semibold text-ink">{solution(q, t)}</span>
                    </span>
                    {q.why && <span className="text-ink-muted">{q.why}</span>}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ol>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <button type="button" onClick={onRetry} disabled={loading} className="rounded-full px-4 py-2.5 text-sm font-semibold text-ink-muted hover:bg-chip hover:text-ink disabled:opacity-50">
          {loading ? t("Escribiendo…") : t("Otro examen")}
        </button>
        {onExplain && (
          <button ref={nextBtn} type="button" onClick={onExplain} className="rounded-full bg-ink px-5 py-2.5 text-sm font-bold text-white">
            {t("Explícamelo de otra forma")}
          </button>
        )}
        {onNext && (
          <button ref={nextBtn} type="button" onClick={onNext} className="rounded-full bg-mint px-5 py-2.5 text-sm font-bold text-white">
            {t("Siguiente concepto")} →
          </button>
        )}
      </div>
    </section>
  );
}
