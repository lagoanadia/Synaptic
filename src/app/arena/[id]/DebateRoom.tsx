"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { endDebate, sendArgument } from "../actions";
import { MAX_TURNS, type DebateMessage, type Verdict } from "@/lib/debate";

export function DebateRoom({
  debate,
}: {
  debate: {
    id: string;
    headline: string;
    url: string | null;
    motion: string;
    brief: string;
    side: "for" | "against";
    messages: DebateMessage[];
    verdict: Verdict | null;
  };
}) {
  const router = useRouter();
  const [messages, setMessages] = useState(debate.messages);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSending, startSend] = useTransition();
  const [isJudging, startJudge] = useTransition();
  const end = useRef<HTMLDivElement>(null);
  const userTurns = messages.filter((m) => m.role === "user").length;
  const isSteelman = userTurns === 0;

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  function send() {
    const text = draft.trim();
    if (!text) return;
    setError(null);
    setMessages((m) => [...m, { role: "user", text }]);
    setDraft("");
    startSend(async () => {
      const r = await sendArgument(debate.id, text);
      if (r.error || !r.messages) {
        setError(r.error ?? "Try again");
        setMessages((m) => m.slice(0, -1));
        setDraft(text);
        return;
      }
      setMessages(r.messages);
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-6 py-8">
      <header className="flex flex-col gap-2">
        <Link href="/arena" className="text-sm text-ink-muted hover:underline">← Arena</Link>
        <h1 className="text-2xl font-extrabold text-balance">“{debate.motion}”</h1>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className={`rounded-full px-2.5 py-1 font-bold text-white ${debate.side === "for" ? "bg-mint" : "bg-crimson"}`}>
            You: {debate.side.toUpperCase()}
          </span>
          <span className="text-ink-muted">Round {Math.min(userTurns, MAX_TURNS)}/{MAX_TURNS}</span>
          {debate.url && (
            <a href={debate.url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
              Source ↗
            </a>
          )}
        </div>
        <details className="text-sm text-ink-muted">
          <summary className="cursor-pointer select-none hover:text-ink">Context</summary>
          <p className="mt-2 leading-relaxed">{debate.brief}</p>
        </details>
      </header>

      <ol className="flex flex-col gap-4" aria-label="Debate">
        {messages.map((m, i) => (
          <li key={i} className={`flex flex-col gap-1.5 ${m.role === "user" ? "items-end" : "items-start"}`}>
            {m.role === "ai" && m.fallacies && m.fallacies.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {m.fallacies.map((f, j) => (
                  <span key={j} title={`“${f.quote}”`} className="rounded-full bg-amber px-2.5 py-0.5 text-[11px] font-bold text-white">
                    ⚠ {f.name}
                  </span>
                ))}
              </div>
            )}
            <div
              className={`max-w-[85%] rounded-3xl px-5 py-3.5 text-sm leading-relaxed whitespace-pre-line ${
                m.role === "user" ? "bg-ink text-white" : "bg-white shadow-[0_1px_2px_rgba(13,13,13,0.06)]"
              }`}
            >
              {m.text}
            </div>
          </li>
        ))}
        {isSending && (
          <li className="text-sm text-ink-muted">Your opponent is thinking…</li>
        )}
        <div ref={end} />
      </ol>

      {debate.verdict ? (
        <VerdictCard verdict={debate.verdict} />
      ) : (
        <div className="sticky bottom-4 flex flex-col gap-2 rounded-3xl bg-white p-4 shadow-[0_8px_30px_rgba(13,13,13,0.08)]">
          {isSteelman && (
            <p className="text-xs font-semibold text-orchid">Step 1 — steelman: argue their side as well as you can.</p>
          )}
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send();
            }}
            rows={3}
            placeholder={isSteelman ? "The strongest case for their side is…" : "Your argument… (Ctrl+Enter to send)"}
            aria-label="Your argument"
            disabled={isSending || userTurns >= MAX_TURNS}
            className="resize-none rounded-2xl border border-border-subtle px-4 py-3 text-sm"
          />
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              disabled={userTurns < 2 || isJudging}
              onClick={() =>
                startJudge(async () => {
                  const r = await endDebate(debate.id);
                  if (r.error) setError(r.error);
                  else router.refresh();
                })
              }
              className="rounded-full px-4 py-2 text-sm font-semibold text-ink-muted hover:bg-chip disabled:opacity-40"
              title={userTurns < 2 ? "Argue at least two rounds first" : "End the debate and get judged"}
            >
              {isJudging ? "Judging…" : "End & get the verdict"}
            </button>
            <button
              type="button"
              onClick={send}
              disabled={isSending || !draft.trim() || userTurns >= MAX_TURNS}
              className="rounded-full bg-orchid px-6 py-2.5 text-sm font-bold text-white disabled:opacity-50"
            >
              Send
            </button>
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
      )}
    </div>
  );
}

function VerdictCard({ verdict }: { verdict: Verdict }) {
  const headline = verdict.winner === "you" ? "You won this one." : verdict.winner === "ai" ? "Your opponent took it." : "A draw.";
  return (
    <section className="flex flex-col gap-4 rounded-3xl bg-white p-6 shadow-[0_1px_2px_rgba(13,13,13,0.06)]" aria-label="Verdict">
      <h2 className="text-2xl font-extrabold">{headline}</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(Object.entries(verdict.scores) as [string, number][]).map(([k, v]) => (
          <div key={k} className="flex flex-col items-center rounded-2xl bg-chip px-3 py-3">
            <span className="text-2xl font-extrabold">{v}<span className="text-sm text-ink-muted">/5</span></span>
            <span className="text-xs capitalize text-ink-muted">{k}</span>
          </div>
        ))}
      </div>
      <Row title="Your best moment" text={verdict.strongest} />
      <Row title="Your weakest moment" text={verdict.weakest} />
      {verdict.steelman && <Row title="Your steelman" text={verdict.steelman} />}
      {verdict.fallacies.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <h3 className="text-sm font-bold">Fallacies</h3>
          {verdict.fallacies.map((f, i) => (
            <p key={i} className="text-sm">
              <span className="font-semibold text-amber">{f.name}</span>
              {f.quote && <span className="text-ink-muted"> — “{f.quote}”</span>}
            </p>
          ))}
        </div>
      )}
      <Row title="What could change your mind" text={verdict.rethink} />
      {verdict.readMore.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <h3 className="text-sm font-bold">Go deeper</h3>
          <div className="flex flex-wrap gap-1.5">
            {verdict.readMore.map((q) => (
              <a
                key={q}
                href={`https://www.google.com/search?q=${encodeURIComponent(q)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full bg-chip px-3 py-1 text-xs hover:text-accent"
              >
                {q} ↗
              </a>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function Row({ title, text }: { title: string; text: string }) {
  if (!text) return null;
  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-sm font-bold">{title}</h3>
      <p className="text-sm leading-relaxed text-ink-muted">{text}</p>
    </div>
  );
}
