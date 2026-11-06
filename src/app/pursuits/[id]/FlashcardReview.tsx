"use client";

import { CheckIcon } from "@/app/icons";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { reviewFlashcard } from "./actions";

type CardForDisplay = { id: string; question: string; answer: string; pursuitId: string; pursuitTitle?: string };

// Two choices, not four: did you know it or not. (SM-2 qualities.)
const RATINGS = [
  { label: "Otra vez", quality: 1, className: "bg-crimson text-white" },
  { label: "Me la sé", quality: 4, className: "bg-mint text-white" },
] as const;

// Click or Space flips the card, 1/2 rates it. The queue on the side
// shows what's coming; click one to jump to it.
export function FlashcardReview({
  learnHref,
  dueCards,
  upcomingCount,
}: {
  learnHref: string;
  dueCards: CardForDisplay[];
  upcomingCount: number;
}) {
  const [queue, setQueue] = useState(dueCards);
  const [flipped, setFlipped] = useState(false);
  const [done, setDone] = useState(0);
  const [isPending, startTransition] = useTransition();
  const current = queue[0];
  const total = done + queue.length;

  function rate(quality: number) {
    if (!current || isPending) return;
    startTransition(async () => {
      await reviewFlashcard(current.pursuitId, current.id, quality);
      setQueue((q) => q.slice(1));
      setDone((n) => n + 1);
      setFlipped(false);
    });
  }

  function jumpTo(id: string) {
    setQueue((q) => [...q.filter((c) => c.id === id), ...q.filter((c) => c.id !== id)]);
    setFlipped(false);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.target as HTMLElement).closest("input, textarea, select, [contenteditable]")) return;
      if (e.key === " ") {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (flipped && ["1", "2"].includes(e.key)) {
        rate(RATINGS[Number(e.key) - 1].quality);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!current) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-3xl bg-white px-6 py-16 text-center shadow-[0_1px_2px_rgba(13,13,13,0.06)]">
        <span className="flex items-center gap-2 text-5xl font-extrabold text-mint">{done > 0 && done}<CheckIcon size={44} className="block" /></span>
        <p className="font-semibold">{done > 0 ? "Todo al día" : "Nada pendiente"}</p>
        {upcomingCount > 0 && <p className="text-sm text-ink-muted">{upcomingCount} programadas para más tarde</p>}
        <Link
          href={learnHref}
          className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white"
        >
          Aprender
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="flex flex-col gap-4">
        <button
          type="button"
          onClick={() => setFlipped((f) => !f)}
          aria-label={flipped ? "Ver pregunta" : "Ver respuesta"}
          className="group [perspective:1600px]"
        >
          <div
            className={`relative min-h-[340px] w-full transition-transform duration-500 [transform-style:preserve-3d] ${
              flipped ? "[transform:rotateY(180deg)]" : ""
            }`}
          >
            <Face className="bg-white">
              <span className="text-2xl leading-snug font-bold text-balance sm:text-3xl">{current.question}</span>
              <span className="absolute bottom-5 text-xs text-ink-faint">clic o Espacio</span>
            </Face>
            <Face className="bg-tile-blue text-white [transform:rotateY(180deg)]">
              <span className="text-2xl leading-snug font-semibold text-balance sm:text-3xl">{current.answer}</span>
            </Face>
          </div>
        </button>

        <div className={`grid grid-cols-2 gap-3 transition-opacity ${flipped ? "opacity-100" : "pointer-events-none opacity-0"}`}>
          {RATINGS.map((r, i) => (
            <button
              key={r.label}
              type="button"
              disabled={isPending || !flipped}
              onClick={() => rate(r.quality)}
              className={`flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold transition-transform hover:-translate-y-0.5 disabled:opacity-50 ${r.className}`}
            >
              {r.label}
              <kbd className="text-xs opacity-70">{i + 1}</kbd>
            </button>
          ))}
        </div>
      </div>

      <aside className="flex flex-col gap-3 self-start" aria-label="Cola">
        <div className="h-2 overflow-hidden rounded-full bg-chip" title={`${done} de ${total} hechas`}>
          <div className="h-full rounded-full bg-mint transition-all" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
        </div>
        <span className="text-xs font-semibold text-ink-muted">
          {done}/{total}
          {upcomingCount > 0 && ` · ${upcomingCount} later`}
        </span>
        <ol className="flex flex-col gap-1.5">
          {queue.slice(1, 9).map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => jumpTo(c.id)}
                className="w-full truncate rounded-xl bg-white px-3 py-2.5 text-left text-sm text-ink-muted shadow-[0_1px_2px_rgba(13,13,13,0.04)] hover:text-ink"
              >
                {c.question}
              </button>
            </li>
          ))}
          {queue.length > 9 && <li className="px-3 text-xs text-ink-faint">+{queue.length - 9}</li>}
        </ol>
      </aside>
    </div>
  );
}

function Face({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <div
      className={`absolute inset-0 flex flex-col items-center justify-center rounded-3xl p-10 shadow-[0_1px_2px_rgba(13,13,13,0.06)] [backface-visibility:hidden] ${className}`}
    >
      {children}
    </div>
  );
}
