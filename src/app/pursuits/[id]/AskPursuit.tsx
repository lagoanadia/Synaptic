"use client";

import { useState, useTransition } from "react";
import { askPursuit } from "./actions";

type Turn = { question: string; answer: string };

// Chat history lives in memory only.
export function AskPursuit({ pursuitId }: { pursuitId: string }) {
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleAsk() {
    const q = question.trim();
    if (!q) return;
    setError(null);
    startTransition(async () => {
      const result = await askPursuit(pursuitId, q);
      if (result.error) {
        setError(result.error);
        return;
      }
      setTurns((prev) => [...prev, { question: q, answer: result.answer ?? "" }]);
      setQuestion("");
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4">
        {turns.map((turn, i) => (
          <div key={i} className="flex flex-col gap-2">
            <p className="self-end rounded-xl bg-chip px-4 py-2.5 text-sm">
              {turn.question}
            </p>
            <p className="px-1 py-1 text-sm leading-relaxed whitespace-pre-wrap">
              {turn.answer}
            </p>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAsk();
            }
          }}
          placeholder="Pregunta sobre esta asignatura…"
          disabled={isPending}
          className="flex-1 rounded-lg border border-border-subtle bg-white px-3.5 py-2 text-sm disabled:opacity-50"
        />
        <button
          type="button"
          onClick={handleAsk}
          disabled={isPending || question.trim() === ""}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium whitespace-nowrap text-white disabled:opacity-50"
        >
          {isPending ? "Pensando…" : "Preguntar"}
        </button>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
