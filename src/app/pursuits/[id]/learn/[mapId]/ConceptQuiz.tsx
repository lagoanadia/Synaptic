"use client";

import { useEffect, useState } from "react";
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
}: {
  conceptId: string;
  startRef: React.RefObject<HTMLButtonElement | null>;
  onStatus: (s: Status) => void;
  onDontKnow: () => void;
}) {
  const [questions, setQuestions] = useState<QuizQuestion[] | null>(null);
  const [i, setI] = useState(0);
  const [answer, setAnswer] = useState<QuizAnswer>(null);
  const [checked, setChecked] = useState(false);
  const [results, setResults] = useState<boolean[]>([]);
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
  }

  const q = questions?.[i];
  const done = !!questions && results.length === questions.length && !checked;

  function check() {
    if (!q || answer === null || answer === "") return;
    setChecked(true);
    setResults((r) => [...r, isCorrect(q, answer)]);
  }

  function next() {
    if (!questions) return;
    setChecked(false);
    setAnswer(null);
    if (i + 1 < questions.length) setI(i + 1);
    else {
      const correct = results.filter(Boolean).length;
      recordConceptQuiz(conceptId, correct, questions.length).then((r) => r.error === null && onStatus(r.status));
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

  const card = "flex flex-col gap-4 rounded-3xl bg-white p-6 shadow-[0_1px_2px_rgba(13,13,13,0.06)]";

  if (!questions) {
    return (
      <section className={card} aria-label="Quiz">
        <div className="flex flex-wrap gap-2">
          <button
            ref={startRef}
            type="button"
            onClick={start}
            disabled={loading}
            className="rounded-full bg-tile-sky px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
          >
            {loading ? "Writing your quiz…" : "Quiz me"} <kbd className="ml-1 text-xs opacity-70">q</kbd>
          </button>
          <button type="button" onClick={onDontKnow} className="rounded-full px-4 py-2.5 text-sm text-ink-muted hover:bg-chip">
            Don&apos;t know
          </button>
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
      </section>
    );
  }

  if (done) {
    const correct = results.filter(Boolean).length;
    const pct = correct / questions.length;
    return (
      <section className={card} aria-label="Quiz result">
        <div className="flex items-baseline gap-3">
          <span className={`text-4xl font-extrabold ${pct >= 0.8 ? "text-mint" : pct >= 0.5 ? "text-amber" : "text-crimson"}`}>
            {correct}/{questions.length}
          </span>
          <span className="text-sm font-semibold text-ink-muted">
            {pct >= 0.8 ? "Understood" : pct >= 0.5 ? "Almost" : "Reread it"}
          </span>
        </div>
        <ol className="flex flex-col gap-1.5 text-sm">
          {questions.map((x, k) => (
            <li key={k} className="flex items-start gap-2">
              <span className={results[k] ? "text-mint" : "text-crimson"}>{results[k] ? <CheckIcon size={16} /> : <XIcon size={16} />}</span>
              <span className={results[k] ? "text-ink-muted" : ""}>
                {x.prompt}
                {!results[k] && x.why && <span className="block text-xs text-ink-muted">{x.why}</span>}
              </span>
            </li>
          ))}
        </ol>
        <button type="button" onClick={start} disabled={loading} className="self-start rounded-full bg-chip px-5 py-2.5 text-sm font-semibold disabled:opacity-50">
          {loading ? "Writing…" : "New quiz"}
        </button>
      </section>
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
    <section className={card} aria-label="Quiz">
      <div className="flex gap-1" aria-label={`Question ${i + 1} of ${questions.length}`}>
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
              {v ? "True" : "False"}
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
            placeholder="Your answer"
            aria-label="Your answer"
            className={`rounded-2xl border-2 px-4 py-3 text-sm ${checked ? (right ? "border-mint bg-mint/10" : "border-crimson bg-crimson-soft") : "border-border-subtle"}`}
          />
          {checked && !right && <span className="text-sm font-semibold">{q.accepted[0]}</span>}
        </form>
      )}

      {q?.kind === "match" && (
        <Match key={i} pairs={q.pairs} seed={q.prompt} checked={checked} value={(answer as Record<number, number>) ?? {}} onChange={setAnswer} />
      )}

      {checked && q?.why && <p className="text-sm leading-relaxed text-ink-muted">{q.why}</p>}

      <button
        type="button"
        onClick={checked ? next : check}
        disabled={!checked && (answer === null || answer === "" || (q?.kind === "match" && Object.keys(answer as object).length < q.pairs.length))}
        className={`self-end rounded-full px-6 py-2.5 text-sm font-bold text-white disabled:opacity-40 ${
          checked ? (right ? "bg-mint" : "bg-crimson") : "bg-ink"
        }`}
      >
        {checked ? (i + 1 < questions.length ? "Next" : "See result") : "Check"}
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
