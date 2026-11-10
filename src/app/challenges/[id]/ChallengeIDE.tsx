"use client";

import { useT } from "@/app/LangProvider";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { ArrowLeft, ArrowRight, CheckIcon, TrashIcon, XIcon } from "@/app/icons";
import { CodeEditor } from "../CodeEditor";
import { PromptText } from "../PromptText";
import { DIFFICULTIES, difficultyOf } from "../look";
import { Badge, Bars } from "../ChallengeList";
import { runInSandbox, warmSandbox } from "../sandbox";
import { askAboutSolution, deleteChallenge, draftChallenge, explainSolution, getHint, reviewSolution, saveRun, type ExplainStep } from "../actions";
import { checkAndSave } from "../checkAndSave";
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
  pursuitId: string | null;
};

const show = (v: unknown) => {
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
};

const KEY = "synaptic.challenge.task";
const WIDTH_KEY = "synaptic.challenge.taskWidth";
const clampW = (w: number) => Math.min(Math.max(w, 260), 760);

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
  const t = useT();
  const [code, setCode] = useState(challenge.code ?? challenge.starterCode);
  const [output, setOutput] = useState<RunOutput | null>(null);
  // "Ejecutar": a free run with the example only, nothing marked.
  const [trial, setTrial] = useState<RunOutput | null>(null);
  const [running, setRunning] = useState(false);
  const [solved, setSolved] = useState(challenge.passed);
  const [picked, setPicked] = useState<number | null>(null);
  const [taskOpen, setTaskOpen] = useState(true);
  const [taskW, setTaskW] = useState(380);
  const [termOpen, setTermOpen] = useState(false);
  const [review, setReview] = useState(challenge.review);
  const [hints, setHints] = useState<string[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [isHinting, startHint] = useTransition();
  const [explained, setExplained] = useState<{ steps: ExplainStep[]; code: string } | null>(null);
  const [isExplaining, startExplain] = useTransition();
  const [isReviewing, startReview] = useTransition();
  const [isDeleting, startDelete] = useTransition();
  const router = useRouter();

  useEffect(warmSandbox, []);
  // Remember whether you hid the task (browser storage, after mount).
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (window.localStorage.getItem(KEY) === "hidden") setTaskOpen(false);
      const w = Number(window.localStorage.getItem(WIDTH_KEY));
      if (w) setTaskW(clampW(w));
    } catch {}
  }, []);
  // Drag the line between the task and the editor to resize the task.
  function startResize(e: React.PointerEvent) {
    e.preventDefault();
    const x0 = e.clientX;
    const w0 = taskW;
    let w = w0;
    const move = (ev: PointerEvent) => setTaskW((w = clampW(w0 + ev.clientX - x0)));
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      document.body.style.userSelect = "";
      try {
        window.localStorage.setItem(WIDTH_KEY, String(w));
      } catch {}
    };
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }
  function toggleTask(open: boolean) {
    setTaskOpen(open);
    try {
      window.localStorage.setItem(KEY, open ? "shown" : "hidden");
    } catch {}
  }

  // Runs your code with the example's input: shows what it returns and
  // what you console.log, like a terminal. Doesn't check anything.
  async function tryRun() {
    if (running) return;
    setRunning(true);
    const out = await runInSandbox(challenge.language, code, challenge.entry, challenge.tests.slice(0, 1));
    setTrial(out);
    setOutput(null);
    setRunning(false);
    setTermOpen(true);
    saveRun(challenge.id, code, false).catch(() => {});
  }

  // "Listo": every check.
  async function run() {
    if (running) return;
    setRunning(true);
    const out = await runInSandbox(challenge.language, code, challenge.entry, challenge.tests);
    setOutput(out);
    setTrial(null);
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

  function dontKnow() {
    startExplain(async () => {
      setNote(null);
      const r = await explainSolution(challenge.id);
      if (r.error || !r.steps || !r.code) return setNote(r.error ?? "Inténtalo de nuevo");
      setExplained({ steps: r.steps, code: r.code });
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
          <ArrowLeft /> <span className="hidden sm:inline">{t("Retos")}</span>
        </Link>
        <h1 className="min-w-0 truncate text-[15px] font-semibold">{challenge.title}</h1>
        <Badge language={challenge.language} small />
        <span title={t(d.label)}>
          <Bars n={DIFFICULTIES.indexOf(d)} color={d.bar} />
        </span>
        {solved && <CheckIcon size={15} className="text-[#448361]" />}
        <span className="flex-1" />
        <button type="button" onClick={hint} disabled={isHinting || hints.length >= 3} title={hints.length >= 3 ? t("No quedan pistas") : t("Pista")} aria-label={t("Pista")} className={icon}>
          {isHinting ? "…" : "💡"}
        </button>
        <button type="button" onClick={dontKnow} disabled={isExplaining || !!explained} title={t("Explícame cómo se hace")} className="rounded-md px-2.5 py-1.5 text-sm text-ink-muted hover:bg-chip hover:text-ink disabled:opacity-40">
          {isExplaining ? t("Explicando…") : "No lo sé"}
        </button>
        <button
          type="button"
          onClick={() => window.confirm("¿Volver al código inicial?") && setCode(challenge.starterCode)}
          title={t("Volver al código inicial")}
          aria-label={t("Reiniciar")}
          className={`${icon} text-lg`}
        >
          ↺
        </button>
        <button
          type="button"
          onClick={() =>
            window.confirm(`¿Eliminar "${challenge.title}"?`) &&
            startDelete(async () => {
              await deleteChallenge(challenge.id);
              router.push("/challenges");
            })
          }
          disabled={isDeleting}
          title={t("Eliminar reto")}
          aria-label={t("Eliminar reto")}
          className={`${icon} hover:text-red-600`}
        >
          <TrashIcon size={15} />
        </button>
        <button type="button" onClick={tryRun} disabled={running} title={t("Prueba tu código con el ejemplo")} className="flex items-center gap-2 rounded-lg border border-border-subtle px-3.5 py-2 text-sm font-semibold text-ink hover:bg-chip disabled:opacity-60">
          {t("▶ Ejecutar")}
          <kbd className="hidden text-xs font-normal text-ink-faint sm:inline">{t("Ctrl ↵")}</kbd>
        </button>
        <button type="button" onClick={run} disabled={running} title={t("Pasa todas las comprobaciones")} className="flex items-center gap-1.5 rounded-lg bg-[#448361] px-3.5 py-2 text-sm font-semibold text-white hover:brightness-105 disabled:opacity-60">
          <CheckIcon size={14} />{" "}{t("Listo")}
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {taskOpen ? (
          <section
            style={{ "--task-w": `${taskW}px` } as React.CSSProperties}
            className="relative flex max-h-[45vh] shrink-0 flex-col gap-5 overflow-y-auto border-b border-border-subtle px-6 py-5 lg:max-h-none lg:w-[var(--task-w)] lg:border-b-0"
            aria-label={t("Enunciado")}
          >
            <button type="button" onClick={() => toggleTask(false)} title={t("Ocultar el enunciado")} aria-label={t("Ocultar el enunciado")} className="absolute top-4 right-3 rounded px-1.5 text-ink-faint hover:bg-chip hover:text-ink">
              «
            </button>
            <div className="flex flex-col gap-2.5">
              <h2 className="text-[11px] font-semibold tracking-wider text-ink-faint uppercase">{t("Enunciado")}</h2>
              {(task.note || challenge.pursuitTitle) && (
                <span className="text-xs text-ink-faint">{[challenge.pursuitTitle, task.note && `De tu nota “${task.note}”`].filter(Boolean).join(" · ")}</span>
              )}
              <PromptText prompt={task.text} />
            </div>
            {challenge.tests[0] && (
              <div className="flex flex-col gap-2.5">
                <h2 className="text-[11px] font-semibold tracking-wider text-ink-faint uppercase">{t("Ejemplo")}</h2>
                <Example inputs={inputs(challenge.tests[0])} expected={challenge.tests[0].expected} react={react} />
              </div>
            )}
            {hints.map((h, i) => (
              <p key={i} className="rounded-lg bg-[#fbf3db] px-3.5 py-2.5 text-sm leading-relaxed">
                <span className="mr-1.5">💡</span>
                {h}
              </p>
            ))}
            {explained && <Explained steps={explained.steps} code={explained.code} challenge={challenge} />}
            {review && <Review text={review} challenge={challenge} />}
            {note && <p className="text-xs text-red-500">{note}</p>}
          </section>
        ) : null}
        {taskOpen ? (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label={t("Ancho del enunciado")}
            title={t("Arrastra para cambiar el ancho")}
            onPointerDown={startResize}
            onDoubleClick={() => setTaskW(380)}
            className="group hidden w-[5px] shrink-0 cursor-col-resize justify-center lg:flex"
          >
            <span className="w-px bg-border-subtle transition-colors group-hover:w-[3px] group-hover:bg-accent/60" />
          </div>
        ) : (
          <button type="button" onClick={() => toggleTask(true)} title={t("Mostrar el enunciado")} aria-label={t("Mostrar el enunciado")} className="hidden w-8 shrink-0 items-start justify-center border-r border-border-subtle pt-4 text-ink-faint hover:bg-chip hover:text-ink lg:flex">
            »
          </button>
        )}

        <section className="flex min-h-0 min-w-0 flex-1 flex-col" aria-label={t("Código")}>
          <div className="min-h-[220px] flex-1">
            <CodeEditor value={code} language={challenge.language} onChange={setCode} onRun={tryRun} />
          </div>

          {/* Terminal: one dot per check; open it to see the failing case. */}
          <div className="flex shrink-0 flex-col bg-[#0e0e10] text-[#d4d4d8]" aria-live="polite">
            <div className="flex flex-wrap items-center gap-1.5 border-t border-white/10 px-4 py-2 text-[13px]">
              <button type="button" onClick={() => setTermOpen((o) => !o)} aria-expanded={termOpen} className="mr-2 flex items-center gap-1.5 font-mono text-xs text-white/60 hover:text-white">
                <span className={`inline-block transition-transform ${termOpen ? "rotate-90" : ""}`}>›</span>{" "}{t("Terminal")}
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
                    title={t("Comprobación {0}", { 0: i + 1 })}
                    aria-label={t("Comprobación {0}{1}", { 0: i + 1, 1: r ? (r.ok ? ", correcta" : ", falla") : "" })}
                    className={`grid size-[16px] place-items-center rounded-full text-white ${r ? (r.ok ? "bg-[#3fa36b]" : "bg-[#e5484d]") : "border-[1.5px] border-white/25"} ${termOpen && shown === i ? "ring-2 ring-white/40 ring-offset-1 ring-offset-[#0e0e10]" : ""}`}
                  >
                    {r && (r.ok ? <CheckIcon size={9} /> : <XIcon size={9} />)}
                  </button>
                );
              })}
              <span className="ml-1.5 text-white/50">
                {running ? t("Ejecutando…") : output ? (output.error ? t("No se ha podido ejecutar") : `${passedCount} de ${output.results.length}`) : trial ? t("Prueba con el ejemplo") : t("Ejecutar para probar · Listo para comprobar")}
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
                  {isReviewing ? t("Revisando…") : t("Revisar mi código")}
                </button>
              )}
            </div>
            {termOpen && (
              <div className="flex max-h-[38vh] flex-col gap-2.5 overflow-y-auto px-4 pt-1 pb-4 font-mono text-[12.5px]">
                {!output && !trial && !running && <p className="text-white/40">{t("Ejecutar prueba tu código con el ejemplo y enseña tus console.log. Listo pasa todas las comprobaciones.")}</p>}
                {trial?.error && <pre className="whitespace-pre-wrap text-[#ff7b7b]">{trial.error}</pre>}
                {trial && !trial.error && challenge.tests[0] && <Case inputs={inputs(challenge.tests[0])} expected={challenge.tests[0].expected} result={trial.results[0]} react={react} />}
                {trial && trial.logs.length > 0 && (
                  <div className="border-t border-white/10 pt-2">
                    <p className="mb-1 text-white/40">{t("console.log")}</p>
                    <pre className="whitespace-pre-wrap text-white/80">{trial.logs.slice(0, 200).join("\n")}</pre>
                  </div>
                )}
                {output?.error && <pre className="whitespace-pre-wrap text-[#ff7b7b]">{output.error}</pre>}
                {shown !== null && challenge.tests[shown] && output && (
                  <Case inputs={inputs(challenge.tests[shown])} expected={challenge.tests[shown].expected} result={output.results[shown]} react={react} />
                )}
                {allGreen && shown === null && <p className="text-[#3fa36b]">{t("Todas las comprobaciones correctas.")}</p>}
                {output && output.logs.length > 0 && (
                  <div className="border-t border-white/10 pt-2">
                    <p className="mb-1 text-white/40">{t("console.log")}</p>
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
  const t = useT();
  const failed = result && !result.ok;
  return (
    <div className="grid grid-cols-[76px_1fr] gap-x-3 gap-y-1.5">
      <span className="text-white/40">{t("Entrada")}</span>
      <span className="font-mono text-[12.5px] break-words">{inputs.map(([k, v]) => `${k} = ${brief(v)}`).join(" · ") || (react ? "sin props" : "—")}</span>
      <span className="text-white/40">{t("Esperado")}</span>
      <span className="font-mono text-[12.5px]">{show(expected)}</span>
      {result && (
        <>
          <span className="text-white/40">{t("Obtenido")}</span>
          <span className={`font-mono text-[12.5px] break-words ${failed ? "text-[#ff7b7b]" : "text-[#3fa36b]"}`}>{result.error ?? show(result.got)}</span>
        </>
      )}
    </div>
  );
}

// "No lo sé": one step at a time — a short sentence and the few lines it
// adds — then everything together. To read and write yourself, not paste.
// Code scrolls sideways instead of wrapping, so lines stay lines.
function Explained({ steps, code, challenge }: { steps: ExplainStep[]; code: string; challenge: Challenge }) {
  const t = useT();
  const router = useRouter();
  const [at, setAt] = useState(0);
  const [making, setMaking] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const last = steps.length; // index `last` = everything together
  const [chat, setChat] = useState<{ q: string; a: string }[]>([]);
  const [asking, setAsking] = useState<string | null>(null);
  async function ask(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const input = e.currentTarget.elements.namedItem("q") as HTMLInputElement;
    const q = input.value.trim();
    if (!q || asking) return;
    input.value = "";
    setAsking(q);
    setFailed(null);
    const explanation = `${steps.map((st, i) => `${i + 1}. ${st.say}\n${st.code}`).join("\n")}\n\nFull solution:\n${code}`;
    const r = await askAboutSolution(challenge.id, explanation, chat, q);
    setAsking(null);
    if (r.answer) setChat((c) => [...c, { q, a: r.answer! }]);
    else setFailed(r.error ?? "Inténtalo de nuevo");
  }
  const inline = (t: string) => t.split(/`([^`]+)`/).map((part, j) => (j % 2 ? <code key={j} className="rounded bg-chip px-1 font-mono text-[12px]">{part}</code> : part));
  async function similar() {
    setMaking(true);
    setFailed(null);
    const r = await draftChallenge({
      language: challenge.language,
      difficulty: "easy",
      pursuitId: challenge.pursuitId,
      topic: `the same idea as the challenge "${challenge.title}", a bit easier, with different data, so the learner can now do it alone`,
    });
    const [id] = r.drafts ? await checkAndSave(challenge.language, r.drafts, 1) : [];
    setMaking(false);
    if (id) router.push(`/challenges/${id}`);
    else setFailed(r.error ?? "No ha salido bien — inténtalo de nuevo");
  }
  const block = (src: string) => (
    <pre className="rounded-md border border-border-subtle bg-white px-2.5 py-2 font-mono text-[11.5px] leading-[1.55] whitespace-pre-wrap text-ink [overflow-wrap:anywhere]">{src}</pre>
  );
  const step = steps[at];
  return (
    <div className="flex flex-col gap-2 rounded-lg bg-sidebar px-3 py-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[10.5px] font-semibold tracking-wider text-accent uppercase">{t("Cómo se hace")}</span>
        <span className="text-[11px] text-ink-faint">{at < last ? `${at + 1}/${last}` : "todo"}</span>
      </div>
      {step ? (
        <>
          <p className="text-[13px] leading-snug">
            {step.say.split(/`([^`]+)`/).map((part, j) => (j % 2 ? <code key={j} className="rounded bg-chip px-1 font-mono text-[12px]">{part}</code> : part))}
          </p>
          {step.code && block(step.code)}
        </>
      ) : (
        <>
          {block(code)}
          <p className="text-[11px] text-ink-faint">{t("Ahora escríbelo tú en el editor, sin copiar.")}</p>
        </>
      )}
      <div className="flex items-center gap-3 text-xs">
        {at > 0 && (
          <button type="button" onClick={() => setAt(at - 1)} className="text-ink-faint hover:text-ink">
            {t("← Atrás")}
          </button>
        )}
        {at < last ? (
          <button type="button" onClick={() => setAt(at + 1)} className="ml-auto flex items-center gap-1 font-medium text-accent hover:underline">
            {at === last - 1 ? t("Ver todo junto") : t("Siguiente")} <ArrowRight size={11} />
          </button>
        ) : (
          <button type="button" onClick={similar} disabled={making} className="ml-auto flex items-center gap-1 font-medium text-accent hover:underline disabled:opacity-50">
            {making ? t("Creando reto…") : <>{t("Practícalo tú")}{" "}<ArrowRight size={11} /></>}
          </button>
        )}
      </div>
      {(chat.length > 0 || asking) && (
        <div className="flex flex-col gap-2 border-t border-border-subtle pt-2 text-[13px] leading-snug">
          {[...chat, ...(asking ? [{ q: asking, a: "" }] : [])].map((m, i) => (
            <div key={i} className="flex flex-col gap-1">
              <p className="self-end rounded-lg bg-white px-2.5 py-1.5 text-ink-muted">{m.q}</p>
              <p>{m.a ? inline(m.a) : <span className="text-ink-faint">{t("Pensando…")}</span>}</p>
            </div>
          ))}
        </div>
      )}
      <form onSubmit={ask} className="flex items-center gap-2 rounded-md border border-border-subtle bg-white px-2.5 py-1.5">
        <input name="q" placeholder={t("Pregunta lo que no entiendas…")} aria-label={t("Pregunta sobre la explicación")} className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-ink-faint" />
        <button type="submit" disabled={!!asking} aria-label={t("Preguntar")} className="text-accent disabled:opacity-40">
          <ArrowRight size={13} />
        </button>
      </form>
      {failed && <p className="text-xs text-red-500">{failed}</p>}
    </div>
  );
}

const REVIEW_STYLE = {
  good: { label: "Bien", icon: CheckIcon, cls: "text-[#448361]" },
  fix: { label: "Arreglar", icon: XIcon, cls: "text-[#e5484d]" },
  next: { label: "Siguiente", icon: ArrowRight, cls: "text-accent" },
} as const;

// The code review as three short blocks; `code` shows as code. Each
// "Siguiente" idea can become a new challenge that practises it.
function Review({ text, challenge }: { text: string; challenge: Challenge }) {
  const t = useT();
  const router = useRouter();
  const [making, setMaking] = useState<number | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  async function practise(i: number, idea: string) {
    setMaking(i);
    setFailed(null);
    const difficulty = (["easy", "medium", "hard"] as const).find((d) => d === challenge.difficulty) ?? "easy";
    const r = await draftChallenge({
      language: challenge.language,
      difficulty,
      pursuitId: challenge.pursuitId,
      topic: `${idea.replace(/`/g, "")} (follow-up to the challenge "${challenge.title}": same kind of data, a new situation)`,
    });
    const [id] = r.drafts ? await checkAndSave(challenge.language, r.drafts, 1) : [];
    setMaking(null);
    if (id) router.push(`/challenges/${id}`);
    else setFailed(r.error ?? "No ha salido bien — inténtalo de nuevo");
  }
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
                  {k === "next" && (
                    <button
                      type="button"
                      onClick={() => practise(i, line)}
                      disabled={making !== null}
                      className="mt-1 flex items-center gap-1 text-xs font-medium text-accent hover:underline disabled:opacity-50"
                    >
                      {making === i ? t("Creando reto…") : <>{t("Practicarlo en un reto")}{" "}<ArrowRight size={11} /></>}
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {k === "next" && failed && <p className="mt-1.5 text-xs text-red-500">{failed}</p>}
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
