"use client";

import { ArrowLeft, ArrowRight, CheckIcon, XIcon } from "@/app/icons";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { CodeEditor } from "../CodeEditor";
import { runInSandbox, warmSandbox } from "../sandbox";
import { getHint, reviewSolution, saveRun } from "../actions";
import { LANGUAGE_INFO, parseReview, type ChallengeTest, type Language, type RunOutput } from "@/lib/challenge";

const show = (v: unknown) => {
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
};

// The online-compiler screen: task on the left, editor top-right, test
// console bottom-right. Run = Ctrl/Cmd+Enter.
export function ChallengeIDE({
  challenge,
}: {
  challenge: {
    id: string;
    title: string;
    prompt: string;
    language: Language;
    entry: string;
    starterCode: string;
    tests: ChallengeTest[];
    difficulty: string;
    code: string | null;
    passed: boolean;
    review: string | null;
    pursuitTitle: string | null;
  };
}) {
  const [code, setCode] = useState(challenge.code ?? challenge.starterCode);
  const [output, setOutput] = useState<RunOutput | null>(null);
  const [running, setRunning] = useState(false);
  const [solved, setSolved] = useState(challenge.passed);
  const [review, setReview] = useState(challenge.review);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [isReviewing, startReview] = useTransition();
  const [hints, setHints] = useState<string[]>([]);
  const [isHinting, startHint] = useTransition();

  useEffect(warmSandbox, []);

  async function run() {
    if (running) return;
    setRunning(true);
    const out = await runInSandbox(challenge.language, code, challenge.entry, challenge.tests);
    setOutput(out);
    setRunning(false);
    const allGreen = !out.error && out.results.length > 0 && out.results.every((r) => r.ok);
    if (allGreen) setSolved(true);
    saveRun(challenge.id, code, allGreen).catch(() => {});
  }

  const passedCount = output?.results.filter((r) => r.ok).length ?? 0;
  const task = splitPrompt(challenge.prompt);
  // React tests pass props; everything else, arguments.
  const input = (t: ChallengeTest) =>
    challenge.language === "react" ? `<${challenge.entry} ${props(t.args[0])}/>` : `${challenge.entry}(${t.args.map(show).join(", ")})`;

  return (
    <div className="flex h-[calc(100vh-3rem)] min-h-[600px] flex-col bg-[#1e2127] text-[#d7dae0]">
      <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/challenges" className="text-sm text-white/60 hover:text-white">
            <ArrowLeft /> Challenges
          </Link>
          <span className="truncate font-semibold text-white">{challenge.title}</span>
          <span className="rounded bg-white/10 px-2 py-0.5 text-xs">{LANGUAGE_INFO[challenge.language].label}</span>
          <span className="rounded bg-white/10 px-2 py-0.5 text-xs">{challenge.difficulty}</span>
          {solved && <span className="rounded bg-mint px-2 py-0.5 text-xs font-bold text-white">Solved</span>}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (window.confirm("Reset to the starter code?")) setCode(challenge.starterCode);
            }}
            className="rounded px-3 py-1.5 text-sm text-white/70 hover:bg-white/10"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={run}
            disabled={running}
            className="flex items-center gap-2 rounded bg-mint px-4 py-1.5 text-sm font-bold text-white hover:brightness-110 disabled:opacity-60"
          >
            {running ? "Running…" : "▶ Run"}
            <kbd className="text-xs opacity-70">Ctrl+↵</kbd>
          </button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(320px,38%)_1fr]">
        {/* Task */}
        <section className="flex min-h-0 flex-col gap-6 overflow-y-auto border-b border-white/10 p-5 lg:border-r lg:border-b-0" aria-label="Task">
          <div className="flex flex-col gap-3">
            {(task.note || challenge.pursuitTitle) && (
              <div className="flex flex-wrap gap-1.5 text-xs">
                {challenge.pursuitTitle && <span className="rounded-full bg-white/10 px-2.5 py-1 text-white/70">{challenge.pursuitTitle}</span>}
                {task.note && <span className="truncate rounded-full bg-tile-sky/20 px-2.5 py-1 text-tile-sky">{task.note}</span>}
              </div>
            )}
            <p className="text-[15px] leading-relaxed whitespace-pre-line text-white/90">{task.text}</p>
            <p className="text-sm text-white/60">
              Your goal: write <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-white">{challenge.entry}</code>
              {challenge.language === "react" ? " (a component)" : ""}
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <h2 className="text-xs font-bold tracking-wide text-white/50 uppercase">Examples</h2>
            {challenge.tests.slice(0, 2).map((t, i) => (
              <div key={i} className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-lg bg-white/5 px-3 py-2.5 font-mono text-xs">
                <span className="break-all text-white/80">{input(t)}</span>
                <ArrowRight size={14} className="text-white/40" />
                <span className="font-bold break-all text-white">{show(t.expected)}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold tracking-wide text-white/50 uppercase">Checks</h2>
              <span className="text-xs text-white/60">{output ? `${passedCount}/${challenge.tests.length} passing` : `${challenge.tests.length} to pass`}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className={`h-full rounded-full transition-[width] ${passedCount === challenge.tests.length ? "bg-mint" : "bg-amber"}`}
                style={{ width: `${(passedCount / challenge.tests.length) * 100}%` }}
              />
            </div>
            <ul className="grid gap-1.5 font-mono text-xs sm:grid-cols-2">
              {challenge.tests.map((t, i) => {
                const r = output?.results[i];
                return (
                  <li
                    key={i}
                    title={r && !r.ok ? (r.error ?? `got ${show(r.got)}`) : undefined}
                    className={`flex items-center gap-2 rounded-lg px-2.5 py-2 ${r ? (r.ok ? "bg-mint/15 text-white" : "bg-crimson/20 text-white") : "bg-white/5 text-white/70"}`}
                  >
                    <span className={`grid size-4 shrink-0 place-items-center rounded-full ${r ? (r.ok ? "bg-mint text-white" : "bg-crimson text-white") : "border border-white/30"}`}>
                      {r && (r.ok ? <CheckIcon size={10} /> : <XIcon size={10} />)}
                    </span>
                    <span className="min-w-0 truncate">
                      {challenge.language === "react" ? props(t.args[0]) || "no props" : t.args.map(show).join(", ")} → {show(t.expected)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={isHinting || hints.length >= 3}
                onClick={() =>
                  startHint(async () => {
                    setReviewError(null);
                    const r = await getHint(challenge.id, code, hints.length + 1);
                    if (r.error) setReviewError(r.error);
                    else if (r.hint) setHints((h) => [...h, r.hint!]);
                  })
                }
                className="flex flex-col items-start gap-0.5 rounded-xl bg-amber/15 px-4 py-3 text-left hover:bg-amber/25 disabled:opacity-50"
              >
                <span className="text-sm font-bold text-amber">{isHinting ? "Thinking…" : "Stuck?"}</span>
                <span className="text-xs text-white/60">{hints.length >= 3 ? "No hints left" : `Get a hint · ${3 - hints.length} left`}</span>
              </button>
              <button
                type="button"
                disabled={isReviewing}
                onClick={() =>
                  startReview(async () => {
                    setReviewError(null);
                    const r = await reviewSolution(challenge.id, code);
                    if (r.error) setReviewError(r.error);
                    else setReview(r.review ?? null);
                  })
                }
                className="flex flex-col items-start gap-0.5 rounded-xl bg-tile-sky/15 px-4 py-3 text-left hover:bg-tile-sky/25 disabled:opacity-50"
              >
                <span className="text-sm font-bold text-tile-sky">{isReviewing ? "Reviewing…" : "Review my code"}</span>
                <span className="text-xs text-white/60">Good, fix, next</span>
              </button>
            </div>
            {hints.map((h, i) => (
              <p key={i} className="rounded-lg bg-amber/10 p-3 text-sm leading-relaxed">
                <span className="mr-2 text-xs font-bold text-amber">Hint {i + 1}</span>
                {h}
              </p>
            ))}
            {reviewError && <p className="text-xs text-crimson">{reviewError}</p>}
            {review && <Review text={review} />}
          </div>
        </section>

        {/* Editor + console */}
        <section className="flex min-h-0 flex-col" aria-label="Code">
          <div className="min-h-[280px] flex-1">
            <CodeEditor value={code} language={challenge.language} onChange={setCode} onRun={run} />
          </div>
          <div className="h-56 shrink-0 overflow-y-auto border-t border-white/10 bg-[#16181d] p-4 font-mono text-xs" aria-live="polite">
            {!output && !running && (
              <p className="text-white/40">
                Ctrl+Enter to run
              </p>
            )}
            {running && <p className="text-white/60">Running…</p>}
            {output && !running && (
              <>
                {output.error ? (
                  <p className="whitespace-pre-wrap text-crimson">{output.error}</p>
                ) : (
                  <p className={passedCount === output.results.length ? "text-mint" : "text-amber"}>
                    {passedCount}/{output.results.length} tests passed
                    {passedCount === output.results.length && " — nice."}
                  </p>
                )}
                {output.results.map((r, i) =>
                  r.ok ? null : (
                    <p key={i} className="mt-1.5 text-white/80">
                      <XIcon size={12} /> {input(challenge.tests[i])}: {r.error ? <span className="text-crimson">{r.error}</span> : <>expected {show(challenge.tests[i].expected)}, got {show(r.got)}</>}
                    </p>
                  ),
                )}
                {output.logs.length > 0 && (
                  <div className="mt-3 border-t border-white/10 pt-2">
                    <p className="mb-1 text-white/40">console</p>
                    {output.logs.slice(0, 200).map((l, i) => (
                      <p key={i} className="whitespace-pre-wrap">{l}</p>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

const REVIEW_STYLE = {
  good: { label: "Good", icon: CheckIcon, cls: "text-mint" },
  fix: { label: "Fix", icon: XIcon, cls: "text-crimson" },
  next: { label: "Next", icon: ArrowRight, cls: "text-tile-sky" },
} as const;

// The code review as three short blocks; `code` shows as code.
function Review({ text }: { text: string }) {
  const sections = parseReview(text);
  const empty = !sections.good.length && !sections.fix.length && !sections.next.length;
  if (empty) return <div className="rounded bg-white/5 p-3 text-sm leading-relaxed whitespace-pre-line">{text}</div>;
  return (
    <div className="flex flex-col gap-2">
      {(["good", "fix", "next"] as const).map((k) => {
        if (!sections[k].length) return null;
        const { label, icon: Icon, cls } = REVIEW_STYLE[k];
        return (
          <div key={k} className="rounded-lg bg-white/5 p-3">
            <span className={`flex items-center gap-1.5 text-xs font-bold tracking-wide uppercase ${cls}`}>
              <Icon size={13} /> {label}
            </span>
            <ul className="mt-1.5 flex flex-col gap-1 text-sm leading-relaxed">
              {sections[k].map((line, i) => (
                <li key={i}>
                  {line.split(/`([^`]+)`/).map((part, j) =>
                    j % 2 ? (
                      <code key={j} className="rounded bg-white/10 px-1 font-mono text-[13px]">
                        {part}
                      </code>
                    ) : (
                      part
                    ),
                  )}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

// Generated prompts start with “From your note "…"” — shown as a chip.
function splitPrompt(prompt: string) {
  const m = prompt.match(/^From your note “([^”]+)”\s*/);
  return m ? { note: m[1], text: prompt.slice(m[0].length) } : { note: null, text: prompt };
}

const props = (p: unknown) =>
  p && typeof p === "object"
    ? Object.entries(p as Record<string, unknown>)
        .map(([k, v]) => `${k}={${show(v)}} `)
        .join("")
    : "";
