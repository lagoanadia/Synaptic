"use client";

import { useState, useTransition } from "react";
import { reviewFlashcard } from "./actions";

type CardForDisplay = { id: string; question: string; answer: string };

// Quality ratings match the 0-5 scale SM-2 itself uses (see lib/sm2.ts) —
// these four buttons just cover the range people actually need day to
// day, not all six values.
const RATINGS = [
  { label: "Again", quality: 1, className: "border-red-300 bg-red-50 text-red-600" },
  { label: "Hard", quality: 3, className: "border-border-subtle text-ink-muted" },
  { label: "Good", quality: 4, className: "border-accent text-accent" },
  { label: "Easy", quality: 5, className: "border-border-subtle text-ink-muted" },
] as const;

export function FlashcardReview({
  pursuitId,
  dueCards,
  upcomingCount,
}: {
  pursuitId: string;
  dueCards: CardForDisplay[];
  upcomingCount: number;
}) {
  const [queue, setQueue] = useState(dueCards);
  const [revealed, setRevealed] = useState(false);
  const [isPending, startTransition] = useTransition();

  const current = queue[0];

  function rate(quality: number) {
    if (!current || isPending) return;
    startTransition(async () => {
      await reviewFlashcard(pursuitId, current.id, quality);
      setQueue((q) => q.slice(1));
      setRevealed(false);
    });
  }

  if (!current) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm text-ink-muted">No cards due right now.</p>
        {upcomingCount > 0 && (
          <p className="text-xs text-ink-faint">
            {upcomingCount} more scheduled for later.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-white p-6">
        <span className="text-xs text-ink-faint">
          {queue.length} card{queue.length === 1 ? "" : "s"} left today
        </span>
        <p className="text-lg font-semibold">{current.question}</p>
        {revealed ? (
          <p className="text-base text-ink-muted">{current.answer}</p>
        ) : (
          <button
            type="button"
            onClick={() => setRevealed(true)}
            className="self-start text-sm font-semibold text-accent hover:underline"
          >
            Show answer
          </button>
        )}
      </div>
      {revealed && (
        <div className="flex gap-2">
          {RATINGS.map((r) => (
            <button
              key={r.label}
              type="button"
              disabled={isPending}
              onClick={() => rate(r.quality)}
              className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium disabled:opacity-50 ${r.className}`}
            >
              {r.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
