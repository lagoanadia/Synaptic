"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { reviewFlashcard } from "../pursuits/[id]/actions";
import { FlashcardReview } from "../pursuits/[id]/FlashcardReview";
import { ChevronRight } from "@/app/icons";
import { reviewConcept } from "../pursuits/[id]/learn/actions";
import type { ReviewCard } from "@/lib/review";
import {
  answer as answerLearn,
  currentQuestion,
  isCloseEnough,
  isFinished,
  qualityFor,
  startLearn,
  type LearnItem,
  type LearnState,
  type Question,
} from "@/lib/learn";

export type Mode = "learn" | "match" | "flash";

// Sessions are shuffled randomly, so they render in the browser only
// (a server render would never match).
const noop = () => () => {};
const useMounted = () => useSyncExternalStore(noop, () => true, () => false);

const MODE_LABEL: Record<Mode, string> = { learn: "Learn", match: "Match", flash: "Flashcards" };

export function ReviewGames({
  mode,
  scopeQuery,
  scopeKey,
  items,
  matchItems,
  flash,
}: {
  mode: Mode;
  scopeQuery: string;
  scopeKey: string;
  items: LearnItem[];
  matchItems: LearnItem[];
  flash: ReviewCard[];
}) {
  const href = (m: Mode) => `/review?mode=${m}${scopeQuery ? `&${scopeQuery}` : ""}`;
  const mounted = useMounted();
  return (
    <div className="flex flex-col gap-6">
      <nav className="flex gap-1 self-start rounded-full bg-chip p-1" aria-label="Mode">
        {(Object.keys(MODE_LABEL) as Mode[]).map((m) => (
          <Link
            key={m}
            href={href(m)}
            aria-current={m === mode ? "page" : undefined}
            className={`rounded-full px-5 py-2 text-sm font-semibold transition-colors ${
              m === mode ? "bg-white text-ink shadow-sm" : "text-ink-muted hover:text-ink"
            }`}
          >
            {MODE_LABEL[m]}
          </Link>
        ))}
      </nav>
      {!mounted && <div className="h-80 rounded-3xl bg-white" aria-busy="true" />}
      {mounted && mode === "learn" && <Learn items={items} />}
      {mounted && mode === "match" && <Match items={matchItems} scopeKey={scopeKey} />}
      {mode === "flash" && (
        <FlashcardReview
          dueCards={flash.map((c) => ({ id: c.id, question: c.question, answer: c.answer, pursuitId: c.pursuitId, pursuitTitle: c.pursuitTitle }))}
          upcomingCount={0}
          learnHref={href("learn")}
        />
      )}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-3xl bg-white px-6 py-12 text-center text-sm text-ink-muted">{children}</p>;
}

const Panel = ({ children }: { children: React.ReactNode }) => (
  <div className="flex flex-col gap-5 rounded-3xl bg-white p-6 shadow-[0_1px_2px_rgba(13,13,13,0.06)] sm:p-8">{children}</div>
);

// ─── Learn ───
// Recognise (multiple choice / true-false), then produce (type it).
// Misses come back; keys 1-4, T/F, Enter.

function Learn({ items }: { items: LearnItem[] }) {
  const [state, setState] = useState<LearnState>(() => startLearn(items));
  // Fixed per step, so its random type/options don't change on re-render.
  const question = useMemo(() => currentQuestion(state), [state]);
  const [result, setResult] = useState<{ correct: boolean; picked?: string } | null>(null);
  const [typed, setTyped] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [reported, setReported] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const finished = isFinished(state);
  const counts = useMemo(() => {
    const v = Object.values(state.stage);
    return { learning: v.filter((s) => s === 1).length, mastered: v.filter((s) => s === 2).length };
  }, [state]);

  // Each item goes to spaced repetition once, when the session ends.
  useEffect(() => {
    if (!finished || reported) return;
    for (const item of items) {
      const misses = state.misses[item.id];
      if (item.kind === "card") reviewFlashcard(item.pursuitId, item.id, qualityFor(misses)).catch(() => {});
      else reviewConcept(item.id, misses === 0).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReported(true);
  }, [finished, reported, items, state.misses]);

  function next(correct: boolean) {
    setState((s) => answerLearn(s, correct));
    setResult(null);
    setTyped("");
    setRevealed(false);
  }

  function submit(correct: boolean, picked?: string) {
    if (result) return;
    setResult({ correct, picked });
    if (correct) window.setTimeout(() => next(true), 700);
  }

  useEffect(() => {
    if (question?.type === "written" || question?.type === "selfcheck") inputRef.current?.focus();
  }, [question]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!question) return;
      if (result && !result.correct && e.key === "Enter") return next(false);
      if ((e.target as HTMLElement).closest("input, textarea") || result) return;
      if (question.type === "choice" && ["1", "2", "3", "4"].includes(e.key)) {
        const opt = question.options![Number(e.key) - 1];
        if (opt) submit(opt === question.item.answer, opt);
      }
      if (question.type === "truefalse" && (e.key === "t" || e.key === "f")) {
        submit((e.key === "t") === question.truth, e.key === "t" ? "true" : "false");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (items.length === 0) return <Empty>No flashcards or concepts here yet.</Empty>;

  const total = items.length;
  const bar = (
    <div className="flex h-2.5 overflow-hidden rounded-full bg-chip" aria-label={`${counts.mastered} of ${total} mastered`}>
      <span className="bg-mint transition-all" style={{ width: `${(counts.mastered / total) * 100}%` }} />
      <span className="bg-tile-sky transition-all" style={{ width: `${(counts.learning / total) * 100}%` }} />
    </div>
  );

  if (finished || !question) {
    const missed = items.filter((i) => state.misses[i.id] > 0);
    return (
      <Panel>
        {bar}
        <p className="text-4xl font-extrabold">
          {total - missed.length}/{total} <span className="text-lg font-semibold text-ink-muted">first try</span>
        </p>
        {missed.length > 0 && (
          <div className="flex flex-col gap-2">
            {missed.map((i) => (
              <div key={i.id} className="grid gap-1 rounded-2xl bg-chip px-4 py-3 text-sm sm:grid-cols-2 sm:gap-4">
                <span className="text-ink-muted">{i.prompt}</span>
                <span className="font-semibold">{i.answer}</span>
              </div>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {missed.length > 0 && (
            <button type="button" onClick={() => setState(startLearn(missed))} className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white">
              Practice mistakes
            </button>
          )}
          <button type="button" onClick={() => setState(startLearn(items))} className="rounded-full bg-chip px-5 py-2.5 text-sm font-semibold">
            Restart
          </button>
        </div>
      </Panel>
    );
  }

  const { item } = question;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="flex-1">{bar}</div>
        <span className="text-xs font-semibold text-ink-muted tabular-nums">
          {counts.mastered}/{total}
        </span>
      </div>
      <Panel>
        <span className="text-xs font-semibold text-ink-muted">
          {item.pursuitTitle}
          {item.context && <span className="text-ink-faint"> · {item.context}</span>}
        </span>
        <p className="text-2xl leading-snug font-bold text-balance">{item.prompt}</p>
        {(item.hint || item.context) && !result && (
          <details key={item.id} className="group self-start text-sm">
            <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-full bg-chip px-3 py-1 text-xs font-semibold text-ink-muted select-none hover:text-ink [&::-webkit-details-marker]:hidden">
              <ChevronRight size={12} className="inline-block transition-transform group-open:rotate-90" /> Hint
            </summary>
            <div className="mt-2 flex max-w-xl flex-col gap-1 rounded-2xl bg-callout px-4 py-3">
              {item.hint && <p>{item.hint}</p>}
              {item.context && <p className="text-xs text-ink-muted">From your note “{item.context}”</p>}
            </div>
          </details>
        )}
        <QuestionBody
          question={question}
          result={result}
          typed={typed}
          setTyped={setTyped}
          revealed={revealed}
          setRevealed={setRevealed}
          inputRef={inputRef}
          submit={submit}
        />
        {result && !result.correct && (
          <div className="flex flex-col gap-3 rounded-2xl bg-crimson-soft px-4 py-3">
            <span className="text-xs font-bold text-crimson">Answer</span>
            <span className="text-base font-semibold">{item.answer}</span>
            <div className="flex flex-wrap gap-2">
              <button type="button" autoFocus onClick={() => next(false)} className="rounded-full bg-ink px-5 py-2 text-sm font-semibold text-white">
                Continue <kbd className="ml-1 text-xs opacity-60">Enter</kbd>
              </button>
              {question.type === "written" && (
                <button type="button" onClick={() => next(true)} className="rounded-full px-4 py-2 text-sm text-ink-muted hover:bg-white">
                  I was right
                </button>
              )}
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}

function QuestionBody({
  question,
  result,
  typed,
  setTyped,
  revealed,
  setRevealed,
  inputRef,
  submit,
}: {
  question: Question;
  result: { correct: boolean; picked?: string } | null;
  typed: string;
  setTyped: (s: string) => void;
  revealed: boolean;
  setRevealed: (b: boolean) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  submit: (correct: boolean, picked?: string) => void;
}) {
  const { item } = question;
  const tone = (isRight: boolean, isPicked: boolean) =>
    !result
      ? "border-border-subtle hover:border-tile-sky"
      : isRight
        ? "border-mint bg-mint/10"
        : isPicked
          ? "border-crimson bg-crimson-soft"
          : "border-border-subtle opacity-50";

  if (question.type === "choice") {
    return (
      <div className="grid gap-2.5 sm:grid-cols-2">
        {question.options!.map((opt, i) => (
          <button
            key={opt}
            type="button"
            disabled={!!result}
            onClick={() => submit(opt === item.answer, opt)}
            className={`flex items-start gap-3 rounded-2xl border-2 px-4 py-3.5 text-left text-sm transition-colors ${tone(opt === item.answer, result?.picked === opt)}`}
          >
            <kbd className="mt-0.5 text-xs text-ink-faint">{i + 1}</kbd>
            <span>{opt}</span>
          </button>
        ))}
      </div>
    );
  }

  if (question.type === "truefalse") {
    return (
      <div className="flex flex-col gap-3">
        <p className="rounded-2xl bg-chip px-4 py-3 text-base">{question.shown}</p>
        <div className="grid grid-cols-2 gap-2.5">
          {([true, false] as const).map((v) => (
            <button
              key={String(v)}
              type="button"
              disabled={!!result}
              onClick={() => submit(v === question.truth, String(v))}
              className={`rounded-2xl border-2 py-3.5 text-sm font-bold ${tone(v === question.truth, result?.picked === String(v))}`}
            >
              {v ? "True" : "False"} <kbd className="ml-1 text-xs font-normal text-ink-faint">{v ? "T" : "F"}</kbd>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (question.type === "written") {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!result && typed.trim()) submit(isCloseEnough(typed, item.answer));
        }}
        className="flex gap-2"
      >
        <input
          ref={inputRef}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          disabled={!!result}
          placeholder="Answer"
          aria-label="Your answer"
          className={`flex-1 rounded-2xl border-2 px-4 py-3 text-base ${result ? (result.correct ? "border-mint" : "border-crimson") : "border-border-subtle"}`}
        />
        {!result && (
          <>
            <button type="submit" className="rounded-full bg-ink px-5 text-sm font-semibold text-white">Check</button>
            <button type="button" onClick={() => submit(false)} className="rounded-full px-3 text-sm text-ink-muted hover:bg-chip">Skip</button>
          </>
        )}
      </form>
    );
  }

  // Long answers: write it, compare, judge yourself.
  return (
    <div className="flex flex-col gap-3">
      <input
        ref={inputRef}
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && setRevealed(true)}
        placeholder="Your own words"
        aria-label="Your answer"
        className="rounded-2xl border-2 border-border-subtle px-4 py-3 text-base"
      />
      {!revealed ? (
        <button type="button" onClick={() => setRevealed(true)} className="self-start rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white">
          Check
        </button>
      ) : (
        !result && (
          <>
            <p className="rounded-2xl bg-tile-blue px-4 py-3 text-base text-white">{item.answer}</p>
            <div className="grid grid-cols-2 gap-2.5">
              <button type="button" onClick={() => submit(true)} className="rounded-2xl border-2 border-mint py-3 text-sm font-bold hover:bg-mint/10">
                Got it
              </button>
              <button type="button" onClick={() => submit(false)} className="rounded-2xl border-2 border-crimson py-3 text-sm font-bold hover:bg-crimson-soft">
                Missed
              </button>
            </div>
          </>
        )
      )}
    </div>
  );
}

// ─── Match ───
// Tap a term, then its definition. Wrong pairs cost a second.

type Tile = { key: string; itemId: string; text: string };

// Only called from click handlers.
const clock = () => Date.now();

function readBest(key: string) {
  try {
    return Number(window.localStorage.getItem(key)) || 0;
  } catch {
    return 0;
  }
}

function shuffled<T>(xs: T[]): T[] {
  const out = [...xs];
  for (let n = out.length - 1; n > 0; n--) {
    const j = Math.floor(Math.random() * (n + 1));
    [out[n], out[j]] = [out[j], out[n]];
  }
  return out;
}

function Match({ items, scopeKey }: { items: LearnItem[]; scopeKey: string }) {
  const router = useRouter();
  const storageKey = `synaptic.match.best.${scopeKey}`;
  const [tiles] = useState<Tile[]>(() =>
    shuffled(
      items.flatMap((i) => [
        { key: `${i.id}-q`, itemId: i.id, text: i.prompt },
        { key: `${i.id}-a`, itemId: i.id, text: i.answer },
      ]),
    ),
  );
  const [started, setStarted] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [penalty, setPenalty] = useState(0);
  const [selected, setSelected] = useState<Tile | null>(null);
  const [wrong, setWrong] = useState<string[]>([]);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<{ time: number; best: number } | null>(null);

  useEffect(() => {
    if (started === null || result) return;
    const id = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(id);
  }, [started, result]);

  if (items.length < 3) return <Empty>Match needs at least 3 short cards.</Empty>;

  const elapsed = started === null ? 0 : (now - started) / 1000 + penalty;

  function tap(tile: Tile) {
    if (done.has(tile.itemId) || result) return;
    const t0 = started ?? clock();
    if (started === null) {
      setStarted(t0);
      setNow(t0);
    }
    if (!selected) return setSelected(tile);
    if (selected.key === tile.key) return setSelected(null);
    if (selected.itemId === tile.itemId) {
      const nextDone = new Set(done).add(tile.itemId);
      setDone(nextDone);
      setSelected(null);
      if (nextDone.size === items.length) {
        const time = Math.round(((clock() - t0) / 1000 + penalty) * 10) / 10;
        const prev = readBest(storageKey);
        const best = prev && prev < time ? prev : time;
        try {
          window.localStorage.setItem(storageKey, String(best));
        } catch {}
        setResult({ time, best });
      }
    } else {
      setWrong([selected.key, tile.key]);
      setPenalty((p) => p + 1);
      setSelected(null);
      window.setTimeout(() => setWrong([]), 400);
    }
  }

  if (result) {
    return (
      <Panel>
        <p className="text-4xl font-extrabold">{result.time.toFixed(1)}s</p>
        <p className="text-sm text-ink-muted">{result.best === result.time ? "New best" : `Best ${result.best.toFixed(1)}s`}</p>
        <button type="button" onClick={() => router.refresh()} className="self-start rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white">
          Again
        </button>
      </Panel>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <span className="text-3xl font-extrabold tabular-nums">{elapsed.toFixed(1)}s</span>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => tap(t)}
            disabled={done.has(t.itemId)}
            className={`min-h-28 rounded-2xl border-2 p-4 text-left text-sm transition-all ${
              done.has(t.itemId)
                ? "invisible"
                : wrong.includes(t.key)
                  ? "border-crimson bg-crimson-soft"
                  : selected?.key === t.key
                    ? "border-tile-sky bg-accent-soft"
                    : "border-transparent bg-white shadow-[0_1px_2px_rgba(13,13,13,0.06)] hover:border-tile-sky"
            }`}
          >
            {t.text}
          </button>
        ))}
      </div>
    </div>
  );
}
