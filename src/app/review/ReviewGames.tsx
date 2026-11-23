"use client";

import { STARS_EVENT, Wardrobe } from "./Wardrobe";
import { earnStars } from "./wardrobe";
import { useT } from "@/app/LangProvider";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { reviewFlashcard } from "../pursuits/[id]/actions";
import { reviewConcept } from "../pursuits/[id]/learn/actions";
import { recordTestScore, saveTest } from "./actions";
import { ask } from "@/app/ui/PopupHost";
import { CheckIcon, XIcon } from "@/app/icons";
import { qualityFor, type LearnItem } from "@/lib/learn";

// Sessions are shuffled randomly, so they render in the browser only
// (a server render would never match).
const noop = () => () => {};
const useMounted = () => useSyncExternalStore(noop, () => true, () => false);

// The game's own palette: four vibrant tiles on a dark board.
const VIB = ["#ff6b57", "#8b5cf6", "#14b8a6", "#f5b82e"];
const SECONDS = 20;

// testId: taking a saved test again (its score is recorded). saveAs: what a
// new test would be saved as (name and folder/unit) from the summary.
export function ReviewGames({
  backHref,
  items,
  menu,
  practiceHref = null,
  testId = null,
  saveAs = null,
}: {
  backHref: string;
  items: LearnItem[];
  menu?: React.ReactNode;
  practiceHref?: string | null;
  testId?: string | null;
  saveAs?: { title: string; pursuitId: string | null; unitId: string | null } | null;
}) {
  const mounted = useMounted();
  const shell = { backHref, menu, practiceHref, testId, saveAs };
  // "Repetir los fallos" starts a new round with just those.
  const [round, setRound] = useState({ n: 0, items });
  if (!mounted) return <Stage {...shell} total={0} done={0} />;
  return <Game key={round.n} items={round.items} shell={shell} onAgain={(missed) => setRound((r) => ({ n: r.n + 1, items: missed }))} />;
}

// practiceHref: a quiz on everything in scope even if nothing is due.
export type Shell = {
  backHref: string;
  menu?: React.ReactNode;
  practiceHref?: string | null;
  testId?: string | null;
  saveAs?: { title: string; pursuitId: string | null; unitId: string | null } | null;
};

// The dark board the game plays on: ✕, progress, streak.
export function Stage({
  backHref,
  menu,
  total,
  done,
  streak,
  children,
}: Shell & { total: number; done: number; streak?: number; children?: React.ReactNode }) {
  const t = useT();
  return (
    <div
      className="fixed inset-x-0 top-0 bottom-16 z-40 flex bg-[#18181b] text-white select-none caret-transparent lg:bottom-0 lg:z-50 [&_input]:select-text [&_input]:caret-auto [&_textarea]:select-text [&_textarea]:caret-auto"
      style={{ backgroundImage: "radial-gradient(rgba(255,255,255,.07) 1px, transparent 1.3px)", backgroundSize: "22px 22px" }}
    >
      {menu && <div className="absolute top-14 right-4 z-10 sm:top-16 sm:right-8">{menu}</div>}
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
      <header className="flex items-center gap-4 px-4 py-4 sm:gap-7 sm:px-10 sm:py-5">
        <Link href={backHref} aria-label={t("Cerrar")} title={t("Cerrar")} className="rounded-md p-1 text-white/50 hover:text-white">
          <XIcon size={20} className="block" />
        </Link>
        <Link href="/review/tests" className="rounded-md px-2 py-1 text-xs font-semibold text-white/50 hover:bg-white/10 hover:text-white">
          {t("Mis tests")}
        </Link>
        <div className="mx-auto flex max-w-[520px] flex-1 gap-1.5" aria-hidden>
          {[...Array(Math.max(total, 1))].map((_, i) => (
            <i key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i < done ? "bg-white" : "bg-white/12"}`} />
          ))}
        </div>
        {streak !== undefined && <Streak n={streak} className="hidden sm:flex" />}
        <Wardrobe />
      </header>
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 pb-10 sm:gap-7">{children}</main>
      </div>
    </div>
  );
}

const Streak = ({ n, className = "" }: { n: number; className?: string }) => {
  const t = useT();
  return ((
  <div className={`gap-1 ${className}`} aria-label={t("Racha de {0}", { 0: n })}>
    {[...Array(5)].map((_, i) => (
      <i key={i} className={`w-3.5 text-center text-[15px] not-italic ${i < n ? "text-[#f5b82e]" : "text-white/25"}`}>
        {i < n ? "✦" : "·"}
      </i>
    ))}
  </div>
));
};

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

const Continue = ({ onClick }: { onClick: () => void }) => {
  const t = useT();
  return ((
  <button type="button" autoFocus onClick={onClick} aria-label={t("Continuar")} title={t("Continuar (Enter)")} className="grid size-12 place-items-center rounded-full bg-white text-xl text-[#18181b] shadow-lg">
    →
  </button>
));
};

const TRUE = "Verdadero";
const FALSE = "Falso";

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
  // ✦ for the avatar's costumes: by how many were right first time.
  earnStars(items.filter((i) => !misses[i.id]).length, items.length)
    .then((stars) => stars !== null && window.dispatchEvent(new CustomEvent(STARS_EVENT, { detail: stars })))
    .catch(() => {});
  for (const item of items) {
    const m = misses[item.id] ?? 0;
    if (item.kind === "card") reviewFlashcard(item.pursuitId, item.id, qualityFor(m)).catch(() => {});
    else reviewConcept(item.id, m === 0).catch(() => {});
  }
}

// ─── Tarjetas: today's cards as a quick game ───
// Four options, 1-4 on the keyboard, a timer, a streak. Misses come back
// at the end of the round.

function Game({ items, shell, onAgain }: { items: LearnItem[]; shell: Shell; onAgain: (missed: LearnItem[]) => void }) {
  const [queue, setQueue] = useState(() => items.map((i) => i.id));
  const [pos, setPos] = useState(0);
  const [misses, setMisses] = useState<Record<string, number>>({});
  const [cleared, setCleared] = useState<Set<string>>(new Set());
  const [streak, setStreak] = useState(0);
  const [result, setResult] = useState<{ picked: string | null; correct: boolean } | null>(null);
  // For the summary: best streak, first wrong pick per item, time per answer.
  const [best, setBest] = useState(0);
  const [firstWrong, setFirstWrong] = useState<Record<string, string | null>>({});
  const [times, setTimes] = useState<number[]>([]);
  const askedAt = useRef(0);
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const base = byId.get(queue[pos] ?? "");
  // Each step is a 4-option question or, for cards that have one, about a
  // third of the time a true/false. Fixed per step, so nothing changes on
  // re-render.
  const step = useMemo(() => {
    if (!base) return null;
    if (base.tf && Math.random() < 0.35) {
      const answer = base.tf.isTrue ? TRUE : FALSE;
      return { item: { ...base, prompt: base.tf.statement, answer }, options: [TRUE, FALSE], tf: true };
    }
    return { item: base, options: shuffled([base.answer, ...base.distractors.slice(0, 3)]), tf: false };
  }, [base, pos]); // eslint-disable-line react-hooks/exhaustive-deps
  const item = step?.item;
  const options = step?.options ?? [];
  const finished = items.length > 0 && !base;
  const reported = useRef(false);

  useEffect(() => {
    if (!finished || reported.current) return;
    reported.current = true;
    report(items, misses);
  }, [finished, items, misses]);

  useEffect(() => {
    askedAt.current = Date.now();
  }, [pos]);

  function pick(opt: string | null) {
    if (!item || result) return;
    const correct = opt === item.answer;
    setResult({ picked: opt, correct });
    setTimes((t) => [...t, Date.now() - askedAt.current]);
    if (correct) {
      setStreak((s) => {
        setBest((b) => Math.max(b, s + 1));
        return s + 1;
      });
      setCleared((c) => new Set(c).add(item.id));
      window.setTimeout(next, 900);
    } else {
      setStreak(0);
      // The summary shows the card's own question; a "Verdadero" pick means nothing there.
      if (!(item.id in firstWrong)) setFirstWrong((w) => ({ ...w, [item.id]: step?.tf ? null : opt }));
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

  if (items.length === 0) return <Done shell={shell} />;
  if (finished) {
    const missed = items.filter((i) => (misses[i.id] ?? 0) > 0);
    return (
      <Summary
        shell={shell}
        items={items}
        total={items.length}
        missed={missed.map((i) => ({ item: i, wrong: firstWrong[i.id] ?? null }))}
        best={best}
        avgSeconds={times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length / 100) / 10 : 0}
        onAgain={missed.length ? () => onAgain(missed) : undefined}
      />
    );
  }
  if (!item) return null;

  const state = (opt: string): TileState =>
    !result ? "idle" : opt === item.answer ? "right" : opt === result.picked ? "wrong" : "out";

  return (
    <Stage {...shell} total={items.length} done={cleared.size} streak={streak}>
      <QuestionCard key={`${item.id}-${pos}`} item={item} timer onTimeout={result ? undefined : () => pick(null)} />
      {step?.tf ? (
        <div className="grid w-full max-w-[900px] grid-cols-2 gap-2.5 sm:gap-4">
          {options.map((opt, i) => (
            <Tile key={opt} i={opt === TRUE ? 2 : 0} label={opt} keycap={String(i + 1)} state={state(opt)} onClick={() => pick(opt)} />
          ))}
        </div>
      ) : (
        <Grid>
          {options.map((opt, i) => (
            <Tile key={opt} i={i} label={opt} keycap={String(i + 1)} state={state(opt)} onClick={() => pick(opt)} />
          ))}
        </Grid>
      )}
      <Streak n={streak} className="flex sm:hidden" />
      {result && !result.correct && <Continue onClick={next} />}
    </Stage>
  );
}

// ─── Resumen: how the round went ───
// Score ring, best streak and time per question (icons, no labels), the
// ones you missed with the right answer, ↻ to repeat those, ✓ to finish.

function Summary({
  shell,
  items,
  total,
  missed,
  best,
  avgSeconds,
  onAgain,
}: {
  shell: Shell;
  items: LearnItem[];
  total: number;
  missed: { item: LearnItem; wrong: string | null }[];
  best: number;
  avgSeconds: number;
  onAgain?: () => void;
}) {
  const t = useT();
  const right = total - missed.length;
  const pct = total ? (right / total) * 100 : 0;
  // A saved test taken again: record the score once. A new one: offer to keep it.
  const [saved, setSaved] = useState<"no" | "busy" | "yes">(shell.testId ? "yes" : "no");
  const recorded = useRef(false);
  useEffect(() => {
    if (!shell.testId || recorded.current) return;
    recorded.current = true;
    void recordTestScore(shell.testId, right);
  }, [shell.testId, right]);
  async function save() {
    const title = await ask.prompt(t("Nombre del test"), shell.saveAs?.title ?? t("Test"));
    if (title === null) return;
    setSaved("busy");
    const id = await saveTest({ title, kind: "quiz", pursuitId: shell.saveAs?.pursuitId ?? null, unitId: shell.saveAs?.unitId ?? null, items, score: right });
    setSaved(id ? "yes" : "no");
  }
  return (
    <Stage {...shell} total={total} done={total}>
      <div className="grid size-44 place-items-center rounded-full sm:size-52" style={{ background: `conic-gradient(#22c55e 0 ${pct}%, rgba(255,255,255,.1) ${pct}% 100%)` }} aria-label={t("{0} de {1} a la primera", { 0: right, 1: total })}>
        <div className="grid size-[148px] place-items-center rounded-full bg-[#18181b] sm:size-[172px]">
          <b className="text-5xl leading-none tabular-nums">
            {right}/{total}
          </b>
        </div>
      </div>
      <div className="flex gap-3">
        <span className="flex items-center gap-2 rounded-xl bg-white/8 px-4 py-2.5 text-xl font-bold" title={t("Mejor racha")} aria-label={t("Mejor racha: {0}", { 0: best })}>
          <span className="text-[#f5b82e]">✦</span> {best}
        </span>
        <span className="flex items-center gap-2 rounded-xl bg-white/8 px-4 py-2.5 text-xl font-bold" title={t("Segundos por pregunta")} aria-label={t("{0} segundos por pregunta", { 0: avgSeconds })}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-white/60" aria-hidden>
            <circle cx="12" cy="13" r="8" />
            <path d="M12 9v4l2.5 2.5M9.5 2.5h5" />
          </svg>
          {avgSeconds}s
        </span>
      </div>
      {missed.length > 0 && (
        <div className="flex w-full max-w-[640px] flex-col gap-2">
          {missed.slice(0, 6).map(({ item, wrong }) => (
            <div key={item.id} className="flex flex-col gap-1 rounded-xl bg-white px-4 py-3 text-[#18181b]">
              <b className="text-[15px] leading-snug">{item.prompt}</b>
              {wrong && <s className="text-[13px] text-[#e5484d]">{wrong}</s>}
              <span className="flex items-start gap-1.5 text-sm font-semibold text-[#16a34a]">
                <CheckIcon size={14} className="mt-0.5 shrink-0" /> {item.answer}
              </span>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center gap-3">
        {onAgain && (
          <button type="button" onClick={onAgain} title={t("Repetir los fallos")} aria-label={t("Repetir los fallos")} className="grid size-12 place-items-center rounded-xl bg-[#8b5cf6] text-xl shadow-[inset_0_-4px_0_rgba(0,0,0,.2)]">
            ↻
          </button>
        )}
        {!shell.testId && (
          <button
            type="button"
            onClick={save}
            disabled={saved !== "no"}
            title={saved === "yes" ? t("Guardado") : t("Guardar este test")}
            aria-label={saved === "yes" ? t("Guardado") : t("Guardar este test")}
            className="flex h-12 items-center gap-2 rounded-xl bg-[#2383e2] px-4 text-sm font-semibold shadow-[inset_0_-4px_0_rgba(0,0,0,.2)] disabled:opacity-80"
          >
            {saved === "yes" ? `✓ ${t("Guardado")}` : saved === "busy" ? "…" : t("Guardar test")}
          </button>
        )}
        <Link href={shell.backHref} title={t("Terminar")} aria-label={t("Terminar")} className="grid size-12 place-items-center rounded-xl bg-[#22c55e] shadow-[inset_0_-4px_0_rgba(0,0,0,.2)]">
          <CheckIcon size={22} className="block" />
        </Link>
      </div>
      <Link href="/review/tests" className="text-sm text-white/60 hover:text-white">
        {t("Mis tests y test final")} →
      </Link>
    </Stage>
  );
}

// ─── Hecho por hoy ───

function Done({ shell }: { shell: Shell }) {
  const t = useT();
  return (
    <Stage {...shell} total={1} done={1}>
      <span className="grid size-16 place-items-center rounded-full bg-[#22c55e] text-white shadow-[0_10px_30px_rgba(34,197,94,.35)]">
        <CheckIcon size={26} className="block" />
      </span>
      <p className="text-xl font-semibold text-white">{t("Nada que repasar hoy")}</p>
      {shell.practiceHref ? (
        <>
          <p className="max-w-sm text-center text-white/60">{t("Lo tienes al día. Si quieres refrescarlo, haz un quiz con todo lo que has apuntado.")}</p>
          <span className="mt-2 flex flex-wrap justify-center gap-2">
            <a href={shell.practiceHref} className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-[#1a1a1d]">
              {t("Practicar igualmente")}
            </a>
            <Link href="/review/tests" className="rounded-xl bg-white/10 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/15">
              {t("Mis tests y test final")}
            </Link>
          </span>
        </>
      ) : (
        <>
          <p className="max-w-sm text-center text-white/60">{t("Escribe tus apuntes en una asignatura y te haremos un quiz con ellos.")}</p>
          <span className="mt-2 flex flex-wrap justify-center gap-2">
            <Link href="/review/tests" className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-[#1a1a1d]">
              {t("Mis tests y test final")}
            </Link>
            <Link href="/pursuits" className="rounded-xl bg-white/10 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/15">
              {t("Ir a mis libretas")}
            </Link>
          </span>
        </>
      )}
    </Stage>
  );
}
