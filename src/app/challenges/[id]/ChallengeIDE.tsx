"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { ArrowLeft, ArrowRight, CheckIcon, XIcon } from "@/app/icons";
import { CodeEditor } from "../CodeEditor";
import { PromptText } from "../PromptText";
import { DIFFICULTIES, difficultyOf } from "../look";
import { Badge, Bars } from "../ChallengeList";
import { runInSandbox, warmSandbox } from "../sandbox";
import { getHint, reviewSolution, saveRun } from "../actions";
import { paramNames, parseReview, type ChallengeTest, type Language, type RunOutput } from "@/lib/challenge";

type Challenge = {
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

const show = (v: unknown) => {
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
};

const KEY = "synaptic.challenge.task";

// A value in one short line: a list of objects reads "Milk (2023-01-02, 2),
// Cheese (2023-01-10, 1)" instead of raw JSON.
function brief(v: unknown): string {
  const bare = (x: unknown) => (typeof x === "string" ? x : show(x));
  if (Array.isArray(v) && v.length > 0 && v.every((x) => x && typeof x === "object" && !Array.isArray(x))) {
    return v
      .map((o) => {
        // Lead with its name: the first text that isn't a date (the
        // database doesn't keep the keys' order).
        const vals = Object.values(o as Record<string, unknown>);
        const i = Math.max(0, vals.findIndex((x) => typeof x === "string" && !/^\d{4}-\d{2}-\d{2}/.test(x)));
        const rest = vals.filter((_, j) => j !== i);
        return rest.length ? `${bare(vals[i])} (${rest.map(bare).join(", ")})` : bare(vals[i]);
      })
      .join(", ");
  }
  return show(v);
}

// A challenge: the task on the left (hide it with «), the editor, and a
// strip of results under it: one dot per check, the failing case spelled
// out. Run = Ctrl/Cmd+Enter.
export function ChallengeIDE({ challenge }: { challenge: Challenge }) {
  const [code, setCode] = useState(challenge.code ?? challenge.starterCode);
  const [output, setOutput] = useState<RunOutput | null>(null);
  const [running, setRunning] = useState(false);
  const [solved, setSolved] = useState(challenge.passed);
  const [picked, setPicked] = useState<number | null>(null);
  const [taskOpen, setTaskOpen] = useState(true);
  const [termOpen, setTermOpen] = useState(false);
  const [review, setReview] = useState(challenge.review);
  const [hints, setHints] = useState<string[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [isHinting, startHint] = useTransition();
  const [isReviewing, startReview] = useTransition();

  useEffect(warmSandbox, []);
  // Remember whether you hid the task (browser storage, after mount).
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (window.localStorage.getItem(KEY) === "hidden") setTaskOpen(false);
    } catch {}
  }, []);
  function toggleTask(open: boolean) {
    setTaskOpen(open);
    try {
      window.localStorage.setItem(KEY, open ? "shown" : "hidden");
    } catch {}
  }

  async function run() {
    if (running) return;
    setRunning(true);
    const out = await runInSandbox(challenge.language, code, challenge.entry, challenge.tests);
    setOutput(out);
    setRunning(false);
    setPicked(null);
    setTermOpen(true);
    const allGreen = !out.error && out.results.length > 0 && out.results.every((r) => r.ok);
    if (allGreen) setSolved(true);
    saveRun(challenge.id, code, allGreen).catch(() => {});
  }

  function hint() {
    startHint(async () => {
      setNote(null);
      const r = await getHint(challenge.id, code, hints.length + 1);
      if (r.error) return setNote(r.error);
      if (r.hint) setHints((h) => [...h, r.hint!]);
      toggleTask(true);
    });
  }

  const react = challenge.language === "react";
  const names = react ? [] : paramNames(challenge.starterCode, challenge.entry, challenge.tests[0]?.args.length ?? 0);
  const inputs = (t: ChallengeTest): [string, unknown][] =>
    react ? Object.entries((t.args[0] as Record<string, unknown>) ?? {}) : t.args.map((a, i) => [names[i] ?? `arg${i + 1}`, a]);
  const task = splitPrompt(challenge.prompt);
  const passedCount = output?.results.filter((r) => r.ok).length ?? 0;
  const allGreen = !!output && !output.error && passedCount === output.results.length;
  const firstFail = output?.results.findIndex((r) => !r.ok) ?? -1;
  const shown = picked ?? (firstFail >= 0 ? firstFail : null);
  const d = difficultyOf(challenge.difficulty);
  const icon = "grid size-8 place-items-center rounded-md text-ink-muted hover:bg-chip hover:text-ink disabled:opacity-40";

  return (
    <div className="flex h-[100dvh] flex-col bg-white lg:h-screen">
      <header className="flex h-[54px] shrink-0 items-center gap-3 border-b border-border-subtle px-4 sm:px-5">
        <Link href="/challenges" className="flex items-center gap-1 text-sm text-ink-faint hover:text-ink">
          <ArrowLeft /> <span className="hidden sm:inline">Retos</span>
        </Link>
        <h1 className="min-w-0 truncate text-[15px] font-semibold">{challenge.title}</h1>
        <Badge language={challenge.language} small />
        <span title={d.label}>
          <Bars n={DIFFICULTIES.indexOf(d)} color={d.bar} />
        </span>
        {solved && <CheckIcon size={15} className="text-[#448361]" />}
        <span className="flex-1" />
        <button type="button" onClick={hint} disabled={isHinting || hints.length >= 3} title={hints.length >= 3 ? "No quedan pistas" : "Pista"} aria-label="Pista" className={icon}>
          {isHinting ? "…" : "💡"}
        </button>
        <button
          type="button"
          onClick={() => window.confirm("¿Volver al código inicial?") && setCode(challenge.starterCode)}
          title="Volver al código inicial"
          aria-label="Reiniciar"
          className={`${icon} text-lg`}
        >
          ↺
        </button>
        <button type="button" onClick={run} disabled={running} className="flex items-center gap-2 rounded-lg bg-[#448361] px-3.5 py-2 text-sm font-semibold text-white hover:brightness-105 disabled:opacity-60">
          {running ? "Ejecutando…" : "▶ Ejecutar"}
          <kbd className="hidden text-xs font-normal opacity-70 sm:inline">Ctrl ↵</kbd>
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {taskOpen ? (
          <section className="relative flex max-h-[45vh] shrink-0 flex-col gap-5 overflow-y-auto border-b border-border-subtle px-6 py-5 lg:max-h-none lg:w-[380px] lg:border-r lg:border-b-0" aria-label="Enunciado">
            <button type="button" onClick={() => toggleTask(false)} title="Ocultar el enunciado" aria-label="Ocultar el enunciado" className="absolute top-4 right-3 rounded px-1.5 text-ink-faint hover:bg-chip hover:text-ink">
              «
            </button>
            <div className="flex flex-col gap-2.5">
              <h2 className="text-[11px] font-semibold tracking-wider text-ink-faint uppercase">Enunciado</h2>
              {(task.note || challenge.pursuitTitle) && (
                <span className="text-xs text-ink-faint">{[challenge.pursuitTitle, task.note && `De tu nota “${task.note}”`].filter(Boolean).join(" · ")}</span>
              )}
              <PromptText prompt={task.text} />
            </div>
            {challenge.tests[0] && (
              <div className="flex flex-col gap-2.5">
                <h2 className="text-[11px] font-semibold tracking-wider text-ink-faint uppercase">Ejemplo</h2>
                <Example inputs={inputs(challenge.tests[0])} expected={challenge.tests[0].expected} react={react} />
              </div>
            )}
            {hints.map((h, i) => (
              <p key={i} className="rounded-lg bg-[#fbf3db] px-3.5 py-2.5 text-sm leading-relaxed">
                <span className="mr-1.5">💡</span>
                {h}
              </p>
            ))}
            {review && <Review text={review} />}
            {note && <p className="text-xs text-red-500">{note}</p>}
          </section>
        ) : (
          <button type="button" onClick={() => toggleTask(true)} title="Mostrar el enunciado" aria-label="Mostrar el enunciado" className="hidden w-8 shrink-0 items-start justify-center border-r border-border-subtle pt-4 text-ink-faint hover:bg-chip hover:text-ink lg:flex">
            »
          </button>
        )}

        <section className="flex min-h-0 min-w-0 flex-1 flex-col" aria-label="Código">
          <div className="min-h-[220px] flex-1">
            <CodeEditor value={code} language={challenge.language} onChange={setCode} onRun={run} />
          </div>

          {/* Terminal: one dot per check; open it to see the failing case. */}
          <div className="flex shrink-0 flex-col bg-[#0e0e10] text-[#d4d4d8]" aria-live="polite">
            <div className="flex flex-wrap items-center gap-1.5 border-t border-white/10 px-4 py-2 text-[13px]">
              <button type="button" onClick={() => setTermOpen((o) => !o)} aria-expanded={termOpen} className="mr-2 flex items-center gap-1.5 font-mono text-xs text-white/60 hover:text-white">
                <span className={`inline-block transition-transform ${termOpen ? "rotate-90" : ""}`}>›</span> Terminal
              </button>
              {challenge.tests.map((_, i) => {
                const r = output?.results[i];
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setPicked(i);
                      setTermOpen(true);
                    }}
                    title={`Comprobación ${i + 1}`}
                    aria-label={`Comprobación ${i + 1}${r ? (r.ok ? ", correcta" : ", falla") : ""}`}
                    className={`grid size-[16px] place-items-center rounded-full text-white ${r ? (r.ok ? "bg-[#3fa36b]" : "bg-[#e5484d]") : "border-[1.5px] border-white/25"} ${termOpen && shown === i ? "ring-2 ring-white/40 ring-offset-1 ring-offset-[#0e0e10]" : ""}`}
                  >
                    {r && (r.ok ? <CheckIcon size={9} /> : <XIcon size={9} />)}
                  </button>
                );
              })}
              <span className="ml-1.5 text-white/50">
                {running ? "Ejecutando…" : output ? (output.error ? "No se ha podido ejecutar" : `${passedCount} de ${output.results.length}`) : "Ctrl + Enter para comprobar"}
              </span>
              {allGreen && (
                <button
                  type="button"
                  disabled={isReviewing}
                  onClick={() =>
                    startReview(async () => {
                      const r = await reviewSolution(challenge.id, code);
                      if (r.error) setNote(r.error);
                      else setReview(r.review ?? null);
                      toggleTask(true);
                    })
                  }
                  className="ml-auto text-[13px] text-[#82aaff] hover:underline disabled:opacity-50"
                >
                  {isReviewing ? "Revisando…" : "Revisar mi código"}
                </button>
              )}
            </div>
            {termOpen && (
              <div className="flex max-h-[38vh] flex-col gap-2.5 overflow-y-auto px-4 pt-1 pb-4 font-mono text-[12.5px]">
                {!output && !running && <p className="text-white/40">Ejecuta tu código para ver aquí cada comprobación.</p>}
                {output?.error && <pre className="whitespace-pre-wrap text-[#ff7b7b]">{output.error}</pre>}
                {shown !== null && challenge.tests[shown] && output && (
                  <Case inputs={inputs(challenge.tests[shown])} expected={challenge.tests[shown].expected} result={output.results[shown]} react={react} />
                )}
                {allGreen && shown === null && <p className="text-[#3fa36b]">Todas las comprobaciones correctas.</p>}
                {output && output.logs.length > 0 && (
                  <div className="border-t border-white/10 pt-2">
                    <p className="mb-1 text-white/40">console.log</p>
                    <pre className="whitespace-pre-wrap text-white/80">{output.logs.slice(0, 200).join("\n")}</pre>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

// An input value, readable: lists of objects as a small table, short
// lists and objects inline, everything else as JSON.
function Value({ v }: { v: unknown }) {
  if (Array.isArray(v) && v.length > 0 && v.every((x) => x && typeof x === "object" && !Array.isArray(x))) {
    const cols = [...new Set(v.flatMap((x) => Object.keys(x as object)))].slice(0, 6);
    return (
      <table className="border-collapse font-mono text-xs">
        <thead>
          <tr>
            {cols.map((c) => (
              <th key={c} className="border border-[#ebeae6] bg-sidebar px-2 py-1 text-left font-medium text-ink-muted">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {v.slice(0, 8).map((row, i) => (
            <tr key={i}>
              {cols.map((c) => (
                <td key={c} className="border border-[#ebeae6] px-2 py-1">
                  {show((row as Record<string, unknown>)[c])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  return <span className="font-mono text-[12.5px] break-all">{show(v)}</span>;
}

function Example({ inputs, expected, react }: { inputs: [string, unknown][]; expected: unknown; react: boolean }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border-subtle">
      {inputs.map(([k, v]) => (
        <div key={k} className="flex items-start gap-3 border-b border-[#f1f1ef] px-3 py-2">
          <span className="w-16 shrink-0 pt-0.5 text-xs text-ink-faint">{k}</span>
          <span className="min-w-0 overflow-x-auto">
            <Value v={v} />
          </span>
        </div>
      ))}
      <div className="flex items-start gap-3 px-3 py-2">
        <span className="w-16 shrink-0 pt-0.5 text-xs text-ink-faint">{react ? "muestra" : "devuelve"}</span>
        <span className="font-mono text-[12.5px] font-semibold text-[#448361]">{show(expected)}</span>
      </div>
    </div>
  );
}

// One check, spelled out: what goes in, what should come out, what came out.
function Case({ inputs, expected, result, react }: { inputs: [string, unknown][]; expected: unknown; result?: { ok: boolean; got?: unknown; error?: string }; react: boolean }) {
  const failed = result && !result.ok;
  return (
    <div className="grid grid-cols-[76px_1fr] gap-x-3 gap-y-1.5">
      <span className="text-white/40">Entrada</span>
      <span className="font-mono text-[12.5px] break-words">{inputs.map(([k, v]) => `${k} = ${brief(v)}`).join(" · ") || (react ? "sin props" : "—")}</span>
      <span className="text-white/40">Esperado</span>
      <span className="font-mono text-[12.5px]">{show(expected)}</span>
      {result && (
        <>
          <span className="text-white/40">Obtenido</span>
          <span className={`font-mono text-[12.5px] break-words ${failed ? "text-[#ff7b7b]" : "text-[#3fa36b]"}`}>{result.error ?? show(result.got)}</span>
        </>
      )}
    </div>
  );
}

const REVIEW_STYLE = {
  good: { label: "Bien", icon: CheckIcon, cls: "text-[#448361]" },
  fix: { label: "Arreglar", icon: XIcon, cls: "text-[#e5484d]" },
  next: { label: "Siguiente", icon: ArrowRight, cls: "text-accent" },
} as const;

// The code review as three short blocks; `code` shows as code.
function Review({ text }: { text: string }) {
  const sections = parseReview(text);
  if (!sections.good.length && !sections.fix.length && !sections.next.length) return <p className="rounded-lg bg-sidebar p-3 text-sm whitespace-pre-line">{text}</p>;
  return (
    <div className="flex flex-col gap-2">
      {(["good", "fix", "next"] as const).map((k) => {
        if (!sections[k].length) return null;
        const { label, icon: Icon, cls } = REVIEW_STYLE[k];
        return (
          <div key={k} className="rounded-lg bg-sidebar p-3">
            <span className={`flex items-center gap-1.5 text-[11px] font-semibold tracking-wider uppercase ${cls}`}>
              <Icon size={12} /> {label}
            </span>
            <ul className="mt-1.5 flex flex-col gap-1 text-sm leading-relaxed">
              {sections[k].map((line, i) => (
                <li key={i}>
                  {line.split(/`([^`]+)`/).map((part, j) =>
                    j % 2 ? (
                      <code key={j} className="rounded bg-chip px-1 font-mono text-[12.5px]">
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

// Generated prompts start with “De tu nota "…"” — shown as a small line.
function splitPrompt(prompt: string) {
  const m = prompt.match(/^(?:From your note|De tu nota) “([^”]+)”\s*/);
  return m ? { note: m[1], text: prompt.slice(m[0].length) } : { note: null, text: prompt };
}
