"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { reviewFlashcard } from "../pursuits/[id]/actions";
import type { QuizQuestion, ReviewCard } from "@/lib/review";

export type Mode = "quiz" | "recall" | "flash" | "challenge";

type RecallItem = {
  id: string;
  pursuitId: string;
  pursuitTitle: string;
  title: string;
  excerpt: string;
};

const MODE_LABEL: Record<Mode, string> = {
  quiz: "Quiz",
  recall: "Recall",
  flash: "Flashcards",
  challenge: "Challenge",
};

export function ReviewGames({
  mode,
  scopeQuery,
  scopeKey,
  quiz,
  challenge,
  recall,
  flash,
  cardCount,
}: {
  mode: Mode;
  scopeQuery: string;
  scopeKey: string;
  quiz: QuizQuestion[];
  challenge: QuizQuestion[];
  recall: RecallItem[];
  flash: ReviewCard[];
  cardCount: number;
}) {
  const href = (m: Mode) => `/review?mode=${m}${scopeQuery ? `&${scopeQuery}` : ""}`;

  return (
    <div className="flex flex-col gap-6">
      <nav className="flex gap-1 self-start rounded-full bg-chip p-1" aria-label="Game">
        {(Object.keys(MODE_LABEL) as Mode[]).map((m) => (
          <Link
            key={m}
            href={href(m)}
            aria-current={m === mode ? "page" : undefined}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
              m === mode ? "bg-white text-ink shadow-sm" : "text-ink-muted hover:text-ink"
            }`}
          >
            {MODE_LABEL[m]}
          </Link>
        ))}
      </nav>

      {mode === "quiz" && <QuizGame questions={quiz} cardCount={cardCount} />}
      {mode === "challenge" && <ChallengeGame questions={challenge} scopeKey={scopeKey} />}
      {mode === "recall" && <RecallGame items={recall} />}
      {mode === "flash" && <FlashGame cards={flash} />}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-3xl bg-white px-6 py-10 text-center text-sm text-ink-muted">{children}</p>;
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-5 rounded-3xl bg-white p-6 shadow-[0_1px_2px_rgba(13,13,13,0.06)] sm:p-8">
      {children}
    </div>
  );
}

function Progress({ value, total }: { value: number; total: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-chip">
      <div
        className="h-full rounded-full bg-tile-aqua transition-all"
        style={{ width: `${total === 0 ? 0 : (value / total) * 100}%` }}
      />
    </div>
  );
}

// ─── Quiz ──────────────────────────────────────────────────────────────
// Answers feed spaced repetition: right counts as "Good", wrong as
// "Again", so a card you miss here comes back sooner in Flashcards too.
function QuizGame({ questions, cardCount }: { questions: QuizQuestion[]; cardCount: number }) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [, startTransition] = useTransition();

  if (questions.length === 0) {
    return (
      <Empty>
        {cardCount < 3
          ? "A quiz needs at least 3 flashcards with different answers. Generate some from a note in a subject's Cards tab."
          : "Your cards' answers are too similar to make multiple choice out of — try Flashcards instead."}
      </Empty>
    );
  }

  if (index >= questions.length) {
    return (
      <Panel>
        <p className="text-sm font-semibold text-ink-muted">Done</p>
        <p className="text-4xl font-extrabold">
          {score}/{questions.length}
        </p>
        <p className="text-sm text-ink-muted">{verdict(score / questions.length)}</p>
        <button
          type="button"
          onClick={() => router.refresh()}
          className="self-start rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white"
        >
          New round
        </button>
      </Panel>
    );
  }

  const q = questions[index];

  function choose(i: number) {
    if (picked !== null) return;
    setPicked(i);
    const correct = i === q.correctIndex;
    if (correct) setScore((s) => s + 1);
    startTransition(() => reviewFlashcard(q.pursuitId, q.cardId, correct ? 4 : 1));
  }

  return (
    <Panel>
      <Progress value={index} total={questions.length} />
      <div className="flex items-center justify-between text-xs font-semibold text-ink-muted">
        <span>
          {index + 1} of {questions.length}
        </span>
        <span>{q.pursuitTitle}</span>
      </div>
      <p className="text-lg font-bold">{q.question}</p>
      <div className="grid gap-2.5">
        {q.options.map((opt, i) => {
          const state =
            picked === null
              ? "idle"
              : i === q.correctIndex
                ? "right"
                : i === picked
                  ? "wrong"
                  : "dim";
          return (
            <button
              key={i}
              type="button"
              onClick={() => choose(i)}
              disabled={picked !== null}
              className={`rounded-2xl border-2 px-4 py-3 text-left text-sm transition-colors ${
                state === "idle"
                  ? "border-border-subtle hover:border-tile-sky"
                  : state === "right"
                    ? "border-mint bg-mint/10 font-semibold"
                    : state === "wrong"
                      ? "border-crimson bg-crimson-soft"
                      : "border-border-subtle text-ink-faint"
              }`}
            >
              {opt}
            </button>
          );
        })}
      </div>
      {picked !== null && (
        <button
          type="button"
          autoFocus
          onClick={() => {
            setIndex((i) => i + 1);
            setPicked(null);
          }}
          className="self-end rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white"
        >
          {index + 1 === questions.length ? "See score" : "Next →"}
        </button>
      )}
    </Panel>
  );
}

function verdict(ratio: number) {
  if (ratio === 1) return "Perfect. You actually know this.";
  if (ratio >= 0.7) return "Solid. The misses will come back sooner in Flashcards.";
  if (ratio >= 0.4) return "Getting there — worth another round later.";
  return "Rough one. Good thing you checked now and not in the exam.";
}

// ─── Challenge ────────────────────────────────────────────────────────
// 60 seconds, as many right answers as you can. A sprint, so it doesn't
// touch spaced repetition (rushed guesses would mess up the schedule).
// Best score lives in this browser only.
const CHALLENGE_SECONDS = 60;

function readBest(key: string): number {
  try {
    return Number(window.localStorage.getItem(key)) || 0;
  } catch {
    return 0;
  }
}

function writeBest(key: string, value: number) {
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    // Private window / blocked storage: the score just isn't remembered.
  }
}

function ChallengeGame({ questions, scopeKey }: { questions: QuizQuestion[]; scopeKey: string }) {
  const router = useRouter();
  const storageKey = `synaptic.challenge.best.${scopeKey}`;
  const [phase, setPhase] = useState<"ready" | "playing" | "over">("ready");
  const [timeLeft, setTimeLeft] = useState(CHALLENGE_SECONDS);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [flash, setFlash] = useState<"right" | "wrong" | null>(null);
  const [best, setBest] = useState(0);
  const [newBest, setNewBest] = useState(false);
  const scoreRef = useRef(0);

  // The clock. Everything that happens at 0 lives inside the interval
  // callback, so the effect only depends on the phase and the storage key.
  useEffect(() => {
    if (phase !== "playing") return;
    const started = Date.now();
    const id = window.setInterval(() => {
      const left = CHALLENGE_SECONDS - Math.floor((Date.now() - started) / 1000);
      if (left > 0) {
        setTimeLeft(left);
        return;
      }
      window.clearInterval(id);
      const final = scoreRef.current;
      const previous = readBest(storageKey);
      if (final > previous) writeBest(storageKey, final);
      setBest(Math.max(final, previous));
      setNewBest(final > previous);
      setTimeLeft(0);
      setPhase("over");
    }, 250);
    return () => window.clearInterval(id);
  }, [phase, storageKey]);

  if (questions.length === 0) {
    return <Empty>The challenge needs at least 3 flashcards with different answers.</Empty>;
  }

  if (phase === "ready") {
    return (
      <Panel>
        <p className="text-4xl font-extrabold">60 seconds.</p>
        <p className="text-sm text-ink-muted">
          As many right answers as you can. Wrong answers just cost you time.
        </p>
        <button
          type="button"
          onClick={() => setPhase("playing")}
          className="self-start rounded-full bg-tile-sky px-6 py-3 text-sm font-bold text-white"
        >
          Start
        </button>
      </Panel>
    );
  }

  if (phase === "over") {
    return (
      <Panel>
        <p className="text-sm font-semibold text-ink-muted">Time&apos;s up</p>
        <p className="text-4xl font-extrabold">{score} right</p>
        <p className="text-sm text-ink-muted">
          {newBest ? "New best! 🎉" : `Best: ${best}`}
        </p>
        <button
          type="button"
          onClick={() => router.refresh()}
          className="self-start rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white"
        >
          Again
        </button>
      </Panel>
    );
  }

  // Ran out of questions before the clock: wrap around.
  const q = questions[index % questions.length];

  function choose(i: number) {
    const correct = i === q.correctIndex;
    if (correct) {
      scoreRef.current += 1;
      setScore(scoreRef.current);
    }
    setFlash(correct ? "right" : "wrong");
    window.setTimeout(() => setFlash(null), 250);
    setIndex((n) => n + 1);
  }

  return (
    <Panel>
      <div className="flex items-center justify-between">
        <span className="text-3xl font-extrabold tabular-nums">{timeLeft}s</span>
        <span
          className={`rounded-full px-3 py-1 text-sm font-bold transition-colors ${
            flash === "right" ? "bg-mint text-white" : flash === "wrong" ? "bg-crimson text-white" : "bg-chip"
          }`}
        >
          {score} right
        </span>
      </div>
      <Progress value={CHALLENGE_SECONDS - timeLeft} total={CHALLENGE_SECONDS} />
      <p className="text-lg font-bold">{q.question}</p>
      <div className="grid gap-2.5 sm:grid-cols-2">
        {q.options.map((opt, i) => (
          <button
            key={`${index}-${i}`}
            type="button"
            onClick={() => choose(i)}
            className="rounded-2xl border-2 border-border-subtle px-4 py-3 text-left text-sm hover:border-tile-sky"
          >
            {opt}
          </button>
        ))}
      </div>
    </Panel>
  );
}

// ─── Recall ───────────────────────────────────────────────────────────
// Active recall on a random concept: see the title, try to remember what
// it was about, then check. Nothing typed here is saved — it's a thinking
// space, not a test.
function RecallGame({ items }: { items: RecallItem[] }) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [attempt, setAttempt] = useState("");
  const [remembered, setRemembered] = useState(0);

  if (items.length === 0) {
    return <Empty>No concepts yet. Organize some Brain Dumps into notes first.</Empty>;
  }

  if (index >= items.length) {
    return (
      <Panel>
        <p className="text-sm font-semibold text-ink-muted">Round done</p>
        <p className="text-4xl font-extrabold">
          {remembered}/{items.length}
        </p>
        <p className="text-sm text-ink-muted">concepts you still had.</p>
        <button
          type="button"
          onClick={() => router.refresh()}
          className="self-start rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white"
        >
          New random set
        </button>
      </Panel>
    );
  }

  const item = items[index];
  const next = (gotIt: boolean) => {
    if (gotIt) setRemembered((n) => n + 1);
    setIndex((i) => i + 1);
    setRevealed(false);
    setAttempt("");
  };

  return (
    <Panel>
      <Progress value={index} total={items.length} />
      <div className="flex items-center justify-between text-xs font-semibold text-ink-muted">
        <span>
          {index + 1} of {items.length}
        </span>
        <span>{item.pursuitTitle}</span>
      </div>
      <p className="text-2xl font-extrabold">{item.title}</p>
      {!revealed ? (
        <>
          <label htmlFor="recall-attempt" className="text-sm text-ink-muted">
            What do you remember about it? (Just for you — not saved.)
          </label>
          <textarea
            id="recall-attempt"
            value={attempt}
            onChange={(e) => setAttempt(e.target.value)}
            rows={4}
            className="rounded-2xl border border-border-subtle px-4 py-3 text-sm"
          />
          <button
            type="button"
            onClick={() => setRevealed(true)}
            className="self-start rounded-full bg-tile-sky px-5 py-2.5 text-sm font-bold text-white"
          >
            Check
          </button>
        </>
      ) : (
        <>
          <p className="rounded-2xl bg-callout px-4 py-3 text-sm leading-relaxed">
            {item.excerpt || "(This note is mostly images — open it to check.)"}
          </p>
          <Link
            href={`/pursuits/${item.pursuitId}?tab=organized`}
            className="self-start text-xs font-semibold text-accent hover:underline"
          >
            Open the full note →
          </Link>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => next(true)}
              className="flex-1 rounded-full border-2 border-mint px-4 py-2.5 text-sm font-semibold"
            >
              Had it
            </button>
            <button
              type="button"
              onClick={() => next(false)}
              className="flex-1 rounded-full border-2 border-border-subtle px-4 py-2.5 text-sm font-semibold text-ink-muted"
            >
              Fuzzy
            </button>
          </div>
        </>
      )}
    </Panel>
  );
}

// ─── Flashcards ───────────────────────────────────────────────────────
// Same SM-2 review as a subject's Cards tab, but across every subject in
// scope at once.
const RATINGS = [
  { label: "Again", quality: 1 },
  { label: "Hard", quality: 3 },
  { label: "Good", quality: 4 },
  { label: "Easy", quality: 5 },
] as const;

function FlashGame({ cards }: { cards: ReviewCard[] }) {
  const [queue, setQueue] = useState(cards);
  const [revealed, setRevealed] = useState(false);
  const [isPending, startTransition] = useTransition();
  const current = queue[0];

  if (!current) {
    return <Empty>Nothing due right now. Come back tomorrow — or play a Quiz.</Empty>;
  }

  function rate(quality: number) {
    if (isPending) return;
    startTransition(async () => {
      await reviewFlashcard(current.pursuitId, current.id, quality);
      setQueue((q) => q.slice(1));
      setRevealed(false);
    });
  }

  return (
    <Panel>
      <div className="flex items-center justify-between text-xs font-semibold text-ink-muted">
        <span>{queue.length} left</span>
        <span>{current.pursuitTitle}</span>
      </div>
      <p className="text-lg font-bold">{current.question}</p>
      {revealed ? (
        <>
          <p className="text-base text-ink-muted">{current.answer}</p>
          <div className="grid grid-cols-4 gap-2">
            {RATINGS.map((r) => (
              <button
                key={r.label}
                type="button"
                disabled={isPending}
                onClick={() => rate(r.quality)}
                className="rounded-full border-2 border-border-subtle px-2 py-2.5 text-sm font-semibold hover:border-tile-sky disabled:opacity-50"
              >
                {r.label}
              </button>
            ))}
          </div>
        </>
      ) : (
        <button
          type="button"
          onClick={() => setRevealed(true)}
          className="self-start rounded-full bg-tile-sky px-5 py-2.5 text-sm font-bold text-white"
        >
          Show answer
        </button>
      )}
    </Panel>
  );
}
