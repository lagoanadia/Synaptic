"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { reviewFlashcard } from "../pursuits/[id]/actions";
import { reviewConcept } from "../pursuits/[id]/learn/actions";
import { CardsIcon, CheckIcon, QuestionIcon, XIcon } from "@/app/icons";
import { Folder } from "@/app/Covers";
import type { FolderCover } from "@/lib/covers";
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
type FolderInfo = { id: string; title: string; cover: FolderCover };

// Sessions are shuffled randomly, so they render in the browser only
// (a server render would never match).
const noop = () => () => {};
const useMounted = () => useSyncExternalStore(noop, () => true, () => false);

// The game's own palette: four vibrant tiles on a dark board.
const VIB = ["#ff6b57", "#8b5cf6", "#14b8a6", "#f5b82e"];
const SECONDS = 20;

const MatchIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" aria-hidden>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
    <path d="M10 6.5h4.5a2 2 0 0 1 2 2V14" />
  </svg>
);

const MODES: { mode: Mode; label: string; icon: React.ReactNode }[] = [
  { mode: "flash", label: "Tarjetas", icon: <CardsIcon size={16} className="block" /> },
  { mode: "learn", label: "Aprender", icon: <QuestionIcon size={16} className="block" /> },
  { mode: "match", label: "Unir", icon: <MatchIcon /> },
];

export function ReviewGames({
  mode,
  scopeQuery,
  scopeKey,
  backHref,
  items,
  matchItems,
  folders,
}: {
  mode: Mode;
  scopeQuery: string;
  scopeKey: string;
  backHref: string;
  items: LearnItem[];
  matchItems: LearnItem[];
  folders: FolderInfo[];
}) {
  const mounted = useMounted();
  const href = (m: Mode) => `/review?mode=${m}${scopeQuery ? `&${scopeQuery}` : ""}`;
  const shell = { backHref, mode, href };
  if (!mounted) return <Stage {...shell} total={0} done={0} />;
  if (mode === "match") return <Match items={matchItems} scopeKey={scopeKey} shell={shell} folders={folders} />;
  if (mode === "learn") return <Learn items={items} shell={shell} folders={folders} />;
  return <Game items={items} shell={shell} folders={folders} />;
}

type Shell = { backHref: string; mode: Mode; href: (m: Mode) => string };

// The dark board every mode plays on: ✕, progress, streak, mode switch.
function Stage({
  backHref,
  mode,
  href,
  total,
  done,
  streak,
  children,
}: Shell & { total: number; done: number; streak?: number; children?: React.ReactNode }) {
  return (
    <div
      className="fixed inset-x-0 top-0 bottom-16 z-40 flex flex-col overflow-y-auto bg-[#18181b] text-white lg:bottom-0 lg:z-50"
      style={{ backgroundImage: "radial-gradient(rgba(255,255,255,.07) 1px, transparent 1.3px)", backgroundSize: "22px 22px" }}
    >
      <header className="flex items-center gap-4 px-4 py-4 sm:gap-7 sm:px-10 sm:py-5">
        <Link href={backHref} aria-label="Cerrar" title="Cerrar" className="rounded-md p-1 text-white/50 hover:text-white">
          <XIcon size={20} className="block" />
        </Link>
        <div className="mx-auto flex max-w-[520px] flex-1 gap-1.5" aria-hidden>
          {[...Array(Math.max(total, 1))].map((_, i) => (
            <i key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i < done ? "bg-white" : "bg-white/12"}`} />
          ))}
        </div>
        {streak !== undefined && <Streak n={streak} className="hidden sm:flex" />}
        <nav className="hidden gap-0.5 rounded-lg bg-white/8 p-0.5 sm:flex" aria-label="Modo">
          {MODES.map((m) => (
            <Link
              key={m.mode}
              href={href(m.mode)}
              title={m.label}
              aria-label={m.label}
              aria-current={m.mode === mode ? "page" : undefined}
              className={`rounded-md p-1.5 ${m.mode === mode ? "bg-white/15 text-white" : "text-white/40 hover:text-white"}`}
            >
              {m.icon}
            </Link>
          ))}
        </nav>
      </header>
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 pb-10 sm:gap-7">{children}</main>
    </div>
  );
}

const Streak = ({ n, className = "" }: { n: number; className?: string }) => (
  <div className={`gap-1 ${className}`} aria-label={`Racha de ${n}`}>
    {[...Array(5)].map((_, i) => (
      <i key={i} className={`w-3.5 text-center text-[15px] not-italic ${i < n ? "text-[#f5b82e]" : "text-white/25"}`}>
        {i < n ? "✦" : "·"}
      </i>
    ))}
  </div>
);

// White card with the question, and the timer draining underneath.
function QuestionCard({ item, timer, onTimeout, children }: { item: LearnItem; timer?: boolean; onTimeout?: () => void; children?: React.ReactNode }) {
  return (
    <div className="flex w-full max-w-[900px] flex-col gap-2 overflow-hidden rounded-[14px] bg-white px-5 pt-5 text-center text-[#18181b] shadow-[0_20px_50px_rgba(0,0,0,.4)] sm:rounded-[18px] sm:px-10 sm:pt-7">
      <span className="text-[13px] text-[#9b9a97]">
        {item.pursuitTitle}
        {item.context && ` · ${item.context}`}
      </span>
      <p className="pb-4 text-[19px] leading-tight font-bold text-balance sm:pb-6 sm:text-[30px]">{item.prompt}</p>
      {children}
      <div className="-mx-5 h-1.5 bg-[#ededeb] sm:-mx-10">
        {timer && (
          <i
            className="block h-full bg-linear-to-r from-[#ff6b57] to-[#f5b82e]"
            style={{ animation: `drain ${SECONDS}s linear forwards`, animationPlayState: onTimeout ? "running" : "paused" }}
            onAnimationEnd={onTimeout}
          />
        )}
      </div>
    </div>
  );
}

type TileState = "idle" | "right" | "wrong" | "out";

function Tile({ i, label, keycap, state, onClick }: { i: number; label: string; keycap: string; state: TileState; onClick: () => void }) {
  const c = VIB[i % 4];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={state !== "idle"}
      style={{ "--c": c, animation: state === "wrong" ? "shake .35s" : undefined } as React.CSSProperties}
      className={`relative flex items-center gap-3 rounded-xl px-3.5 py-3.5 text-left text-[15px] font-semibold transition-all duration-200 sm:min-h-[108px] sm:gap-[18px] sm:rounded-2xl sm:px-6 sm:py-5 sm:text-[19px] ${
        state === "right"
          ? "scale-[1.04] bg-white text-[#18181b] shadow-[0_0_0_4px_var(--c),0_20px_40px_rgba(0,0,0,.4)]"
          : state === "out"
            ? "scale-[.94] bg-(--c) opacity-25 saturate-[.3]"
            : state === "wrong"
              ? "bg-(--c) opacity-60 shadow-[inset_0_-6px_0_rgba(0,0,0,.18)]"
              : "bg-(--c) text-white shadow-[inset_0_-6px_0_rgba(0,0,0,.18)] hover:brightness-105 active:translate-y-0.5"
      }`}
    >
      <span className="grid size-[30px] shrink-0 place-items-center rounded-[9px] bg-white/95 text-sm font-extrabold text-(--c) shadow-[0_3px_0_rgba(0,0,0,.2)] sm:size-10 sm:text-lg">
        {keycap}
      </span>
      <span className="min-w-0 flex-1">{label}</span>
      {state === "right" && (
        <>
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#22c55e] text-white sm:size-11">
            <CheckIcon size={20} className="block" />
          </span>
          {[...Array(9)].map((_, k) => (
            <i
              key={k}
              aria-hidden
              className="absolute top-1/2 right-[30px] size-2 rounded-[2px] sm:right-11"
              style={{ "--a": `${k * 40}deg`, "--d": `${44 + (k % 3) * 16}px`, background: VIB[k % 4], animation: "spark .7s ease-out forwards" } as React.CSSProperties}
            />
          ))}
        </>
      )}
    </button>
  );
}

const Grid = ({ children }: { children: React.ReactNode }) => <div className="grid w-full max-w-[900px] gap-2.5 sm:grid-cols-2 sm:gap-4">{children}</div>;

const Continue = ({ onClick }: { onClick: () => void }) => (
  <button type="button" autoFocus onClick={onClick} aria-label="Continuar" title="Continuar (Enter)" className="grid size-12 place-items-center rounded-full bg-white text-xl text-[#18181b] shadow-lg">
    →
  </button>
);

function shuffled<T>(xs: T[]): T[] {
  const out = [...xs];
  for (let n = out.length - 1; n > 0; n--) {
    const j = Math.floor(Math.random() * (n + 1));
    [out[n], out[j]] = [out[j], out[n]];
  }
  return out;
}

// Each item goes to spaced repetition once, when the session ends.
function report(items: LearnItem[], misses: Record<string, number>) {
  for (const item of items) {
    const m = misses[item.id] ?? 0;
    if (item.kind === "card") reviewFlashcard(item.pursuitId, item.id, qualityFor(m)).catch(() => {});
    else reviewConcept(item.id, m === 0).catch(() => {});
  }
}

// ─── Tarjetas: today's cards as a quick game ───
// Four options, 1-4 on the keyboard, a timer, a streak. Misses come back
// at the end of the round.

function Game({ items, shell, folders }: { items: LearnItem[]; shell: Shell; folders: FolderInfo[] }) {
  const [queue, setQueue] = useState(() => items.map((i) => i.id));
  const [pos, setPos] = useState(0);
  const [misses, setMisses] = useState<Record<string, number>>({});
  const [cleared, setCleared] = useState<Set<string>>(new Set());
  const [streak, setStreak] = useState(0);
  const [result, setResult] = useState<{ picked: string | null; correct: boolean } | null>(null);
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const item = byId.get(queue[pos] ?? "");
  // Fixed per step, so the order doesn't change on re-render.
  const options = useMemo(() => (item ? shuffled([item.answer, ...item.distractors.slice(0, 3)]) : []), [item, pos]); // eslint-disable-line react-hooks/exhaustive-deps
  const finished = items.length > 0 && !item;
  const reported = useRef(false);

  useEffect(() => {
    if (!finished || reported.current) return;
    reported.current = true;
    report(items, misses);
  }, [finished, items, misses]);

  function pick(opt: string | null) {
    if (!item || result) return;
    const correct = opt === item.answer;
    setResult({ picked: opt, correct });
    if (correct) {
      setStreak((s) => s + 1);
      setCleared((c) => new Set(c).add(item.id));
      window.setTimeout(next, 900);
    } else {
      setStreak(0);
      setMisses((m) => ({ ...m, [item.id]: (m[item.id] ?? 0) + 1 }));
      setQueue((q) => [...q, item.id]);
    }
  }

  function next() {
    setResult(null);
    setPos((p) => p + 1);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!item) return;
      if (result && !result.correct && e.key === "Enter") return next();
      const n = Number(e.key) - 1;
      if (!result && n >= 0 && n < options.length) pick(options[n]);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (items.length === 0 || finished) return <Done shell={shell} folders={finished ? folders.filter((f) => items.some((i) => i.pursuitId === f.id)) : []} />;
  if (!item) return null;

  const state = (opt: string): TileState =>
    !result ? "idle" : opt === item.answer ? "right" : opt === result.picked ? "wrong" : "out";

  return (
    <Stage {...shell} total={items.length} done={cleared.size} streak={streak}>
      <QuestionCard key={`${item.id}-${pos}`} item={item} timer onTimeout={result ? undefined : () => pick(null)} />
      <Grid>
        {options.map((opt, i) => (
          <Tile key={opt} i={i} label={opt} keycap={String(i + 1)} state={state(opt)} onClick={() => pick(opt)} />
        ))}
      </Grid>
      <Streak n={streak} className="flex sm:hidden" />
      {result && !result.correct && <Continue onClick={next} />}
    </Stage>
  );
}

// ─── Hecho por hoy ───

function Done({ shell, folders, again }: { shell: Shell; folders: FolderInfo[]; again?: () => void }) {
  return (
    <Stage {...shell} total={1} done={1}>
      {folders.length > 0 && (
        <div className="flex flex-wrap justify-center gap-6">
          {folders.slice(0, 4).map((f) => (
            <div key={f.id} className="flex w-24 flex-col items-center gap-2 sm:w-30">
              <Folder cover={f.cover} />
              <span className="max-w-full truncate text-sm text-white/70">{f.title}</span>
            </div>
          ))}
        </div>
      )}
      <span className="grid size-16 place-items-center rounded-full bg-[#22c55e] text-white shadow-[0_10px_30px_rgba(34,197,94,.35)]">
        <CheckIcon size={26} className="block" />
      </span>
      <p className="text-white/60">Hasta mañana</p>
      {again && (
        <button type="button" onClick={again} aria-label="Otra vez" title="Otra vez" className="rounded-full px-3 py-1 text-lg text-white/40 hover:text-white">
          ↻
        </button>
      )}
    </Stage>
  );
}

// ─── Aprender ───
// Recognise (multiple choice / true-false), then produce (type it).
// Misses come back; keys 1-4, V/F, Enter.

function Learn({ items, shell, folders }: { items: LearnItem[]; shell: Shell; folders: FolderInfo[] }) {
  const [state, setState] = useState<LearnState>(() => startLearn(items));
  const question = useMemo(() => currentQuestion(state), [state]);
  const [result, setResult] = useState<{ correct: boolean; picked?: string } | null>(null);
  const [typed, setTyped] = useState("");
  const [revealed, setRevealed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const reported = useRef(false);
  const finished = isFinished(state);
  const mastered = Object.values(state.stage).filter((s) => s === 2).length;

  useEffect(() => {
    if (!finished || reported.current) return;
    reported.current = true;
    report(items, state.misses);
  }, [finished, items, state.misses]);

  function next(correct: boolean) {
    setState((s) => answerLearn(s, correct));
    setResult(null);
    setTyped("");
    setRevealed(false);
  }

  function submit(correct: boolean, picked?: string) {
    if (result) return;
    setResult({ correct, picked });
    if (correct) window.setTimeout(() => next(true), 800);
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
      if (question.type === "truefalse" && (e.key === "v" || e.key === "f")) {
        submit((e.key === "v") === question.truth, e.key === "v" ? "true" : "false");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (items.length === 0 || finished || !question) {
    const missed = items.filter((i) => state.misses[i.id] > 0);
    return <Done shell={shell} folders={items.length ? folders : []} again={missed.length ? () => setState(startLearn(missed)) : undefined} />;
  }

  const { item } = question;
  return (
    <Stage {...shell} total={items.length} done={mastered}>
      <QuestionCard key={`${item.id}-${state.misses[item.id] ?? 0}-${question.type}`} item={item}>
        {question.type === "truefalse" && <p className="-mt-2 pb-5 text-lg text-[#55534e]">{question.shown}</p>}
      </QuestionCard>
      <LearnBody question={question} result={result} typed={typed} setTyped={setTyped} revealed={revealed} setRevealed={setRevealed} inputRef={inputRef} submit={submit} />
      {result && !result.correct && (
        <div className="flex flex-col items-center gap-3">
          {question.type !== "choice" && question.type !== "truefalse" && <p className="rounded-xl bg-white/10 px-4 py-2 text-center">{item.answer}</p>}
          <div className="flex items-center gap-3">
            <Continue onClick={() => next(false)} />
            {question.type === "written" && (
              <button type="button" onClick={() => next(true)} className="rounded-full px-3 py-2 text-sm text-white/50 hover:text-white">
                Tenía razón
              </button>
            )}
          </div>
        </div>
      )}
    </Stage>
  );
}

function LearnBody({
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
  const tile = (isRight: boolean, isPicked: boolean): TileState => (!result ? "idle" : isRight ? "right" : isPicked ? "wrong" : "out");
  const field = "w-full max-w-[600px] rounded-xl border-2 bg-white/8 px-4 py-3 text-base text-white outline-none placeholder:text-white/35";

  if (question.type === "choice") {
    return (
      <Grid>
        {question.options!.map((opt, i) => (
          <Tile key={opt} i={i} label={opt} keycap={String(i + 1)} state={tile(opt === item.answer, result?.picked === opt)} onClick={() => submit(opt === item.answer, opt)} />
        ))}
      </Grid>
    );
  }

  if (question.type === "truefalse") {
    return (
      <Grid>
        {([true, false] as const).map((v, i) => (
          <Tile
            key={String(v)}
            i={i + 2}
            label={v ? "Verdadero" : "Falso"}
            keycap={v ? "V" : "F"}
            state={tile(v === question.truth, result?.picked === String(v))}
            onClick={() => submit(v === question.truth, String(v))}
          />
        ))}
      </Grid>
    );
  }

  if (question.type === "written") {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!result && typed.trim()) submit(isCloseEnough(typed, item.answer));
        }}
        className="flex w-full max-w-[600px] items-center gap-2"
      >
        <input
          ref={inputRef}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          disabled={!!result}
          placeholder="Escribe la respuesta"
          aria-label="Tu respuesta"
          className={`${field} ${result ? (result.correct ? "border-[#22c55e]" : "border-[#ff6b57]") : "border-white/15 focus:border-white/40"}`}
        />
        {!result && (
          <button type="submit" disabled={!typed.trim()} aria-label="Comprobar" className="grid size-12 shrink-0 place-items-center rounded-full bg-white text-xl text-[#18181b] disabled:opacity-30">
            →
          </button>
        )}
      </form>
    );
  }

  // Long answers: write it, compare, judge yourself.
  return (
    <div className="flex w-full max-w-[600px] flex-col items-center gap-3">
      <input
        ref={inputRef}
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && setRevealed(true)}
        placeholder="Con tus palabras"
        aria-label="Tu respuesta"
        className={`${field} border-white/15 focus:border-white/40`}
      />
      {!revealed ? (
        <button type="button" onClick={() => setRevealed(true)} aria-label="Comprobar" className="grid size-12 place-items-center rounded-full bg-white text-xl text-[#18181b]">
          →
        </button>
      ) : (
        !result && (
          <>
            <p className="w-full rounded-xl bg-white px-4 py-3 text-[#18181b]">{item.answer}</p>
            <div className="flex gap-3">
              <button type="button" onClick={() => submit(true)} aria-label="Me la sé" title="Me la sé" className="grid size-12 place-items-center rounded-full bg-[#22c55e] text-white">
                <CheckIcon size={20} className="block" />
              </button>
              <button type="button" onClick={() => submit(false)} aria-label="Fallada" title="Fallada" className="grid size-12 place-items-center rounded-full bg-[#ff6b57] text-white">
                <XIcon size={20} className="block" />
              </button>
            </div>
          </>
        )
      )}
    </div>
  );
}

// ─── Unir ───
// Tap a term, then its definition. Wrong pairs cost a second.

type Pair = { key: string; itemId: string; text: string };

// Only called from click handlers.
const clock = () => Date.now();

function readBest(key: string) {
  try {
    return Number(window.localStorage.getItem(key)) || 0;
  } catch {
    return 0;
  }
}

function Match({ items, scopeKey, shell, folders }: { items: LearnItem[]; scopeKey: string; shell: Shell; folders: FolderInfo[] }) {
  const router = useRouter();
  const storageKey = `synaptic.match.best.${scopeKey}`;
  const [tiles] = useState<Pair[]>(() =>
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
  const [selected, setSelected] = useState<Pair | null>(null);
  const [wrong, setWrong] = useState<string[]>([]);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<{ time: number; best: number } | null>(null);

  useEffect(() => {
    if (started === null || result) return;
    const id = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(id);
  }, [started, result]);

  if (items.length < 3) return <Done shell={shell} folders={[]} />;

  const elapsed = started === null ? 0 : (now - started) / 1000 + penalty;

  function tap(tile: Pair) {
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
      <Stage {...shell} total={items.length} done={items.length}>
        <div className="flex flex-wrap justify-center gap-6">
          {folders
            .filter((f) => items.some((i) => i.pursuitId === f.id))
            .slice(0, 4)
            .map((f) => (
              <div key={f.id} className="flex w-24 flex-col items-center gap-2 sm:w-30">
                <Folder cover={f.cover} />
                <span className="max-w-full truncate text-sm text-white/70">{f.title}</span>
              </div>
            ))}
        </div>
        <p className="text-5xl font-extrabold tabular-nums">{result.time.toFixed(1)}s</p>
        {result.best === result.time ? <Streak n={5} className="flex" /> : <p className="text-sm text-white/45 tabular-nums">✦ {result.best.toFixed(1)}s</p>}
        <button type="button" onClick={() => router.refresh()} aria-label="Otra vez" title="Otra vez" className="rounded-full px-3 py-1 text-lg text-white/40 hover:text-white">
          ↻
        </button>
      </Stage>
    );
  }

  return (
    <Stage {...shell} total={items.length} done={done.size}>
      <span className="text-sm text-white/45 tabular-nums">{elapsed.toFixed(1)}s</span>
      <div className="grid w-full max-w-[860px] grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3.5 lg:grid-cols-4">
        {tiles.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => tap(t)}
            disabled={done.has(t.itemId)}
            style={wrong.includes(t.key) ? { animation: "shake .35s" } : undefined}
            className={`grid min-h-24 place-items-center rounded-xl border-2 p-3 text-center text-sm transition-all sm:min-h-[120px] sm:rounded-2xl ${
              done.has(t.itemId)
                ? "invisible"
                : wrong.includes(t.key)
                  ? "border-[#ff6b57] bg-[#ff6b57]/20"
                  : selected?.key === t.key
                    ? "border-[#8b5cf6] bg-white text-[#18181b]"
                    : "border-transparent bg-white/8 hover:bg-white/14"
            }`}
          >
            {t.text}
          </button>
        ))}
      </div>
    </Stage>
  );
}
