"use client";

import { XIcon } from "@/app/icons";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { frameHeadline, startDebate } from "./actions";
import type { Headline } from "@/lib/feeds";

type Framed = { motion: string; brief: string; forCase: string; againstCase: string };

const ago = (iso: string | null) => {
  if (!iso) return "";
  const h = Math.round((Date.now() - new Date(iso).getTime()) / 3600000);
  return h < 1 ? "just now" : h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
};

export function HeadlinePicker({ headlines }: { headlines: Headline[] }) {
  const router = useRouter();
  const sources = [...new Set(headlines.map((h) => h.source))];
  const [source, setSource] = useState<string | null>(null);
  const [language, setLanguage] = useState("English");
  const [style, setStyle] = useState<"opponent" | "socratic">("opponent");
  const [selected, setSelected] = useState<Headline | null>(null);
  const [framed, setFramed] = useState<Framed | null>(null);
  const [own, setOwn] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function frame(h: Headline) {
    setSelected(h);
    setFramed(null);
    setError(null);
    startTransition(async () => {
      const r = await frameHeadline({ title: h.title, summary: h.summary, source: h.source }, language);
      if (r.error !== null) return setError(r.error);
      setFramed({ motion: r.motion!, brief: r.brief!, forCase: r.forCase!, againstCase: r.againstCase! });
    });
  }

  function pick(side: "for" | "against") {
    if (!selected || !framed) return;
    startTransition(async () => {
      const r = await startDebate({
        headline: selected.title,
        url: selected.url || null,
        source: selected.source,
        motion: framed.motion,
        brief: framed.brief,
        side,
        style,
        language,
      });
      if (r.error || !r.id) return setError(r.error ?? "Try again");
      router.push(`/arena/${r.id}`);
    });
  }

  const shown = headlines.filter((h) => !source || h.source === source);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-1.5">
        {[null, ...sources].map((s) => (
          <button
            key={s ?? "all"}
            type="button"
            onClick={() => setSource(s)}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${source === s ? "bg-ink text-white" : "bg-chip text-ink-muted hover:text-ink"}`}
          >
            {s ?? "All"}
          </button>
        ))}
        <span className="flex-1" />
        <label className="flex items-center gap-1.5 text-xs text-ink-muted">
          Debate in
          <select value={language} onChange={(e) => setLanguage(e.target.value)} className="rounded-full border border-border-subtle bg-white px-2 py-1">
            <option>English</option>
            <option>Español</option>
          </select>
        </label>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (own.trim().length > 8) frame({ title: own.trim(), url: "", source: "You", summary: "", publishedAt: null });
        }}
        className="flex gap-2"
      >
        <input
          value={own}
          onChange={(e) => setOwn(e.target.value)}
          placeholder="Or bring your own topic / claim / headline…"
          aria-label="Your own topic"
          className="flex-1 rounded-2xl border border-border-subtle bg-white px-4 py-2.5 text-sm"
        />
        <button type="submit" className="rounded-full bg-chip px-4 text-sm font-semibold">Frame it</button>
      </form>

      {shown.length === 0 && (
        <p className="rounded-3xl bg-callout px-6 py-8 text-center text-sm text-ink-muted">
          Couldn&apos;t load headlines right now. Bring your own topic above.
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {shown.map((h) => {
          const active = selected?.url === h.url && selected.title === h.title;
          return (
            <li key={h.url + h.title} className={`rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(13,13,13,0.06)] ${active ? "ring-2 ring-orchid" : ""}`}>
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <a href={h.url} target="_blank" rel="noopener noreferrer" className="font-semibold hover:underline">
                    {h.title}
                  </a>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    {h.source}{h.publishedAt ? ` · ${ago(h.publishedAt)}` : ""}
                  </p>
                  {h.summary && <p className="mt-1.5 line-clamp-2 text-sm text-ink-muted">{h.summary}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => frame(h)}
                  disabled={isPending}
                  className="shrink-0 rounded-full bg-orchid px-3.5 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                >
                  Debate this
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {selected && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border-subtle bg-white/95 p-5 shadow-[0_-8px_30px_rgba(13,13,13,0.08)] backdrop-blur">
          <div className="mx-auto flex max-w-3xl flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <p className="text-xs text-ink-muted">{selected.title}</p>
              <button type="button" onClick={() => setSelected(null)} aria-label="Close" className="text-ink-muted hover:text-ink"><XIcon /></button>
            </div>
            {!framed && !error && <p className="text-sm font-semibold">Finding the real argument in this…</p>}
            {error && <p className="text-sm text-red-500">{error}</p>}
            {framed && (
              <>
                <p className="text-xl font-extrabold">“{framed.motion}”</p>
                <p className="text-sm leading-relaxed text-ink-muted">{framed.brief}</p>
                <div className="flex gap-1 self-start rounded-full bg-chip p-1 text-xs font-semibold" role="radiogroup" aria-label="Style">
                  {([
                    ["opponent", "Argue with me"],
                    ["socratic", "Only ask me questions"],
                  ] as const).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={style === value}
                      onClick={() => setStyle(value)}
                      className={`rounded-full px-3 py-1.5 ${style === value ? "bg-white text-ink shadow-sm" : "text-ink-muted"}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <button type="button" disabled={isPending} onClick={() => pick("for")} className="flex flex-col items-start gap-1 rounded-2xl border-2 border-mint p-3 text-left hover:bg-mint/10 disabled:opacity-50">
                    <span className="text-sm font-bold">I&apos;m FOR</span>
                    <span className="text-xs text-ink-muted">{framed.forCase}</span>
                  </button>
                  <button type="button" disabled={isPending} onClick={() => pick("against")} className="flex flex-col items-start gap-1 rounded-2xl border-2 border-crimson p-3 text-left hover:bg-crimson-soft disabled:opacity-50">
                    <span className="text-sm font-bold">I&apos;m AGAINST</span>
                    <span className="text-xs text-ink-muted">{framed.againstCase}</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
