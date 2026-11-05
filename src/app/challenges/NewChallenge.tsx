"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { draftChallenge, saveChallenge } from "./actions";
import { runInSandbox } from "./sandbox";
import type { Language } from "@/lib/challenge";

export function NewChallenge({
  subjects,
  defaultSubject,
}: {
  subjects: { id: string; title: string }[];
  defaultSubject: string | null;
}) {
  const router = useRouter();
  const [language, setLanguage] = useState<Language>("javascript");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("easy");
  const [subject, setSubject] = useState(defaultSubject ?? "");
  const [topic, setTopic] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function create() {
    setError(null);
    startTransition(async () => {
      setStatus("Writing a challenge…");
      const r = await draftChallenge({ language, difficulty, pursuitId: subject || null, topic });
      if (r.error || !r.draft) {
        setStatus(null);
        return setError(r.error ?? "Try again");
      }
      // Check the AI's own answer key in the sandbox; keep only the tests
      // its reference solution actually passes.
      setStatus(language === "python" ? "Checking the tests (loading Python)…" : "Checking the tests…");
      const check = await runInSandbox(language, r.draft.solution, r.draft.entry, r.draft.tests);
      const passing = check.error ? [] : r.draft.tests.filter((_, i) => check.results[i]?.ok);
      if (passing.length < 2) {
        setStatus(null);
        return setError("The AI's challenge didn't check out — try again");
      }
      setStatus("Saving…");
      const saved = await saveChallenge(r.draft, passing);
      setStatus(null);
      if (saved.error || !saved.id) return setError(saved.error ?? "Try again");
      router.push(`/challenges/${saved.id}`);
    });
  }

  const pill = (active: boolean) =>
    `rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${active ? "bg-ink text-white" : "bg-chip text-ink-muted hover:text-ink"}`;

  return (
    <div className="flex flex-col gap-4 rounded-3xl bg-white p-6 shadow-[0_1px_2px_rgba(13,13,13,0.06)]">
      <h2 className="text-lg font-extrabold">Hand me a challenge</h2>
      <div className="flex flex-wrap gap-2">
        {(["javascript", "python"] as const).map((l) => (
          <button key={l} type="button" onClick={() => setLanguage(l)} className={pill(language === l)} aria-pressed={language === l}>
            {l === "python" ? "Python" : "JavaScript"}
          </button>
        ))}
        <span className="w-2" />
        {(["easy", "medium", "hard"] as const).map((d) => (
          <button key={d} type="button" onClick={() => setDifficulty(d)} className={pill(difficulty === d)} aria-pressed={difficulty === d}>
            {d}
          </button>
        ))}
      </div>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-semibold">From my notes in</span>
        <select value={subject} onChange={(e) => setSubject(e.target.value)} className="rounded-2xl border border-border-subtle bg-white px-4 py-2.5">
          <option value="">All my notes (random)</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>{s.title}</option>
          ))}
        </select>
      </label>
      <input
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        placeholder="Optional topic: strings, recursion, arrays…"
        aria-label="Topic"
        className="rounded-2xl border border-border-subtle px-4 py-2.5 text-sm"
      />
      <button
        type="button"
        onClick={create}
        disabled={isPending}
        className="self-start rounded-full bg-mint px-6 py-3 text-sm font-bold text-white transition-transform hover:-translate-y-0.5 disabled:opacity-60"
      >
        {isPending ? (status ?? "Working…") : "Give me one →"}
      </button>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
