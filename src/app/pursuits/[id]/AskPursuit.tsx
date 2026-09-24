"use client";

import { useState, useTransition } from "react";
import { askPursuit } from "./actions";

type Turn = { question: string; answer: string };

// Local-only chat history (not saved to the database) — each question is
// answered fresh from a full-text search over this pursuit's content, see
// askPursuit's comment in actions.ts for why full-text search instead of
// embeddings for now.
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
            <p className="self-end rounded-md bg-chip px-3 py-2 text-sm">{turn.question}</p>
            <p className="rounded-md bg-callout px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap">
              {turn.answer}
            </p>
          </div>
        ))}
        {turns.length === 0 && (
          <p className="text-sm text-ink-muted">
            Ask something about this pursuit — the answer is based only on your brain
            dumps and organized notes.
          </p>
        )}
      </div>

      <div className="flex gap-2 border-t border-border-subtle pt-4">
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
          placeholder="Ask this pursuit…"
          disabled={isPending}
          className="flex-1 rounded-md border border-border-subtle bg-white px-3 py-2 text-sm disabled:opacity-50"
        />
        <button
          type="button"
          onClick={handleAsk}
          disabled={isPending || question.trim() === ""}
          className="rounded-md bg-ink px-4 py-2 text-sm font-medium whitespace-nowrap text-white hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? "Thinking…" : "Ask"}
        </button>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
