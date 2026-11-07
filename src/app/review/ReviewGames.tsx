"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { reviewFlashcard } from "../pursuits/[id]/actions";
import { reviewConcept } from "../pursuits/[id]/learn/actions";
import { CheckIcon, XIcon } from "@/app/icons";
import { Folder } from "@/app/Covers";
import type { FolderCover } from "@/lib/covers";
import { qualityFor, type LearnItem } from "@/lib/learn";

type FolderInfo = { id: string; title: string; cover: FolderCover };

// Sessions are shuffled randomly, so they render in the browser only
// (a server render would never match).
const noop = () => () => {};
const useMounted = () => useSyncExternalStore(noop, () => true, () => false);

// The game's own palette: four vibrant tiles on a dark board.
const VIB = ["#ff6b57", "#8b5cf6", "#14b8a6", "#f5b82e"];
const SECONDS = 20;

export function ReviewGames({ backHref, items, folders }: { backHref: string; items: LearnItem[]; folders: FolderInfo[] }) {
  const mounted = useMounted();
  const shell = { backHref };
  if (!mounted) return <Stage {...shell} total={0} done={0} />;
  return <Game items={items} shell={shell} folders={folders} />;
}

type Shell = { backHref: string };

// The dark board the game plays on: ✕, progress, streak.
function Stage({
  backHref,
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
