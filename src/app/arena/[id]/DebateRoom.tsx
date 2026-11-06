"use client";

import { AlertIcon, ArrowLeft, ArrowUpRight } from "@/app/icons";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { endDebate, sendArgument } from "../actions";
import { INTENTS, MAX_TURNS, type DebateMessage, type Intent, type Verdict } from "@/lib/debateTypes";

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
  const [side, setSide] = useState(debate.side);
  const userTurns = messages.filter((m) => m.role === "user").length;
  const arguments_ = messages.filter((m) => m.role === "user" && !m.intent).length;

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  function send(intent?: Intent) {
    const text = intent ? INTENTS[intent].label : draft.trim();
    if (!text || isSending) return;
    setError(null);
    setMessages((m) => [...m, { role: "user", text, ...(intent ? { intent } : {}) }]);
    if (!intent) setDraft("");
    startSend(async () => {
      const r = await sendArgument(debate.id, intent ? "" : text, intent);
      if (r.error || !r.messages) {
        setError(r.error ?? "Try again");
        setMessages((m) => m.slice(0, -1));
        if (!intent) setDraft(text);
        return;
      }
      setMessages(r.messages);
      if (r.side) setSide(r.side as "for" | "against");
    });
  }


  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 px-6 py-8">
      <header className="flex flex-col gap-2">
        <Link href="/arena" className="text-sm text-ink-muted hover:underline"><ArrowLeft /> Arena</Link>
        <h1 className="text-2xl font-extrabold text-balance">“{debate.motion}”</h1>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className={`rounded-full px-2.5 py-1 font-bold text-white ${side === "for" ? "bg-mint" : "bg-crimson"}`}>
            You: {side.toUpperCase()}
          </span>
          <span className="text-ink-muted">Round {Math.min(userTurns, MAX_TURNS)}/{MAX_TURNS}</span>
          {debate.url && (
            <a href={debate.url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
              Source <ArrowUpRight />
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
                    <AlertIcon size={12} /> {f.name}
                  </span>
                ))}
              </div>
            )}
            {m.intent ? (
              <span className="rounded-full bg-orchid/15 px-3 py-1 text-xs font-semibold text-orchid">{m.text}</span>
            ) : (
            <div
              className={`max-w-[85%] rounded-3xl px-5 py-3.5 text-sm leading-relaxed whitespace-pre-line ${
                m.role === "user" ? "bg-ink text-white" : "bg-white shadow-[0_1px_2px_rgba(13,13,13,0.06)]"
              }`}
            >
              {m.text}
            </div>
            )}
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
          <div className="flex flex-wrap gap-1.5" aria-label="Quick moves">
            {(Object.keys(INTENTS) as Intent[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => send(k)}
                disabled={isSending || userTurns >= MAX_TURNS}
                className="rounded-full bg-chip px-3 py-1.5 text-xs font-semibold text-ink-muted hover:bg-orchid hover:text-white disabled:opacity-40"
              >
                {INTENTS[k].label}
              </button>
            ))}
          </div>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send();
            }}
            rows={3}
            placeholder="Argue, ask, push back…  (Ctrl+Enter)"
            aria-label="Your argument"
            disabled={isSending || userTurns >= MAX_TURNS}
            className="resize-none rounded-2xl border border-border-subtle px-4 py-3 text-sm"
          />
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              disabled={arguments_ < 2 || isJudging}
              onClick={() =>
                startJudge(async () => {
                  const r = await endDebate(debate.id);
                  if (r.error) setError(r.error);
                  else router.refresh();
                })
              }
              className="rounded-full px-4 py-2 text-sm font-semibold text-ink-muted hover:bg-chip disabled:opacity-40"
              title={arguments_ < 2 ? "Make at least two arguments first" : "End the debate and get judged"}
            >
              {isJudging ? "Judging…" : "Verdict"}
            </button>
            <button
              type="button"
              onClick={() => send()}
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
                {q} <ArrowUpRight />
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
