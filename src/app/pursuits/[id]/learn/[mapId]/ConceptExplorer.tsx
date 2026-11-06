"use client";

import { ArrowLeft, ChevronLeft, ChevronRight } from "@/app/icons";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CodeBlock } from "../../CodeBlock";
import { ConceptGraph } from "./ConceptGraph";
import { looksLikeCode, nextUp, progress, type Status } from "@/lib/internalize";
import { RichContent } from "../../RichContent";
import { ConceptQuiz } from "./ConceptQuiz";
import {
  addConcept,
  askAboutConcept,
  deleteConcept,
  editConcept,
  goDeeper,
  linkConcepts,
  markReread,
  openConcept,
  setConceptStatus,
  unlinkConcepts,
} from "../actions";

export type ExplorerConcept = {
  id: string;
  title: string;
  summary: string;
  explanation: string;
  excerpt: string | null;
  excerptFrom: string | null;
  order: number;
  depth: number;
  status: Status;
  attempt: string | null;
  feedback: string | null;
  parentId: string | null;
};
export type ExplorerLink = { fromId: string; toId: string; label: string | null };

export const STATUS_STYLE: Record<Status, { label: string; dot: string; pill: string }> = {
  NEW: { label: "Nuevo", dot: "bg-white border-2 border-ink-faint", pill: "bg-chip text-ink-muted" },
  SEEN: { label: "Visto", dot: "bg-ink-faint", pill: "bg-chip text-ink" },
  REREAD: { label: "Repasar", dot: "bg-amber", pill: "bg-amber text-white" },
  UNDERSTOOD: { label: "Entendido", dot: "bg-tile-sky", pill: "bg-tile-sky text-white" },
  MASTERED: { label: "Dominado", dot: "bg-tile-deep", pill: "bg-tile-deep text-white" },
};

const EXT_LANG: Record<string, string> = { ts: "ts", tsx: "ts", js: "js", jsx: "js", mjs: "js", py: "py", java: "java", sql: "sql" };
const langFor = (from: string | null) => EXT_LANG[from?.split(".").pop()?.toLowerCase() ?? ""] ?? "";

const GRAPH_KEY = "synaptic.learn.graph";
const PATH_KEY = "synaptic.learn.path";

export function ConceptExplorer({
  pursuitId,
  pursuitTitle,
  map,
  concepts,
  links,
  startId,
}: {
  pursuitId: string;
  pursuitTitle: string;
  map: { id: string; title: string; sourceKind: string; sourceRef: string | null };
  concepts: ExplorerConcept[];
  links: ExplorerLink[];
  startId: string | null;
}) {
  const router = useRouter();
  const [currentId, setCurrentId] = useState(startId);
  const [history, setHistory] = useState<string[]>([]);
  // Status changes show instantly; the server catches up on refresh.
  const [localStatus, setLocalStatus] = useState<Record<string, Status>>({});
  const [weakOnly, setWeakOnly] = useState(false);
  const [showGraph, setShowGraph] = useState(() => {
    try {
      return typeof window !== "undefined" && window.localStorage.getItem(GRAPH_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [pathOpen, setPathOpen] = useState(true);
  useEffect(() => {
    try {
      // Browser storage, so only after mount.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (window.localStorage.getItem(PATH_KEY) === "0") setPathOpen(false);
    } catch {}
  }, []);
  function togglePath() {
    setPathOpen((o) => {
      try {
        window.localStorage.setItem(PATH_KEY, o ? "0" : "1");
      } catch {}
      return !o;
    });
  }
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const statusOf = (c: ExplorerConcept) => localStatus[c.id] ?? c.status;
  const byId = useMemo(() => new Map(concepts.map((c) => [c.id, c])), [concepts]);
  const current = currentId ? byId.get(currentId) : undefined;

  const withStatus = concepts.map((c) => ({ ...c, status: statusOf(c) }));
  const upNext = nextUp(withStatus, links, currentId ?? undefined);
  const stats = progress(withStatus.map((c) => c.status));

  // Opening a concept marks it seen (server side; never demotes).
  useEffect(() => {
    if (currentId) openConcept(currentId).catch(() => {});
  }, [currentId]);

  function go(id: string | null, remember = true) {
    if (!id || id === currentId) return;
    if (remember && currentId) setHistory((h) => [...h, currentId]);
    setCurrentId(id);
    setError(null);
    const c = byId.get(id);
    if (c && statusOf(c) === "NEW") setLocalStatus((s) => ({ ...s, [id]: "SEEN" }));
    window.history.replaceState(null, "", `?c=${id}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function back() {
    const prev = history[history.length - 1];
    if (!prev) return;
    setHistory((h) => h.slice(0, -1));
    go(prev, false);
  }

  function run(fn: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
      } catch {
        setError("Algo ha fallado — inténtalo de nuevo");
      }
    });
  }

  const actions = {
    skip: () => go(upNext ?? nextInOrder(concepts, currentId)),
    reread: () => {
      if (!current) return;
      setLocalStatus((s) => ({ ...s, [current.id]: "REREAD" }));
      run(() => markReread(current.id));
      go(upNext ?? nextInOrder(concepts, currentId));
    },
    deeper: () => {
      if (!current) return;
      const kids = concepts.filter((c) => c.parentId === current.id);
      if (kids.length > 0) return go(kids[0].id);
      run(async () => {
        const r = await goDeeper(current.id);
        if (r.error !== null) setError(r.error);
        else router.refresh();
      });
    },
    random: () => {
      const pool = concepts.filter((c) => c.id !== currentId);
      go(pickRandom(pool)?.id ?? null);
    },
  };

  function toggleGraph() {
    setShowGraph((v) => {
      try {
        window.localStorage.setItem(GRAPH_KEY, v ? "0" : "1");
      } catch {}
      return !v;
    });
  }

  const askRef = useRef<HTMLInputElement>(null);
  const quizRef = useRef<HTMLButtonElement>(null);

  // Keyboard: → skip, ← back, d deeper, r reread, j random, a ask,
  // q quiz, g graph. Ignored while typing.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, [contenteditable]") || e.metaKey || e.ctrlKey || e.altKey) return;
      const map: Record<string, () => void> = {
        ArrowRight: actions.skip,
        ArrowLeft: back,
        d: actions.deeper,
        r: actions.reread,
        j: actions.random,
        a: () => askRef.current?.focus(),
        q: () => quizRef.current?.click(),
        g: () => toggleGraph(),
      };
      const fn = map[e.key];
      if (fn) {
        e.preventDefault();
        fn();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });


  const pct = (n: number) => `${stats.total ? (n / stats.total) * 100 : 0}%`;

  return (
    <div className="mx-auto flex w-full max-w-[1500px] flex-1 flex-col gap-6 px-6 py-8 lg:px-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <Link href={`/pursuits/${pursuitId}?tab=learn`} className="text-sm text-ink-muted hover:underline">
            <ArrowLeft /> {pursuitTitle}
          </Link>
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={togglePath}
              aria-pressed={pathOpen}
              title={pathOpen ? "Ocultar ruta" : "Mostrar ruta"}
              aria-label={pathOpen ? "Ocultar ruta" : "Mostrar ruta"}
              className="hidden shrink-0 rounded-full bg-chip p-1.5 text-ink-muted hover:text-ink lg:block"
            >
              {pathOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
            </button>
            <h1 className="truncate text-2xl font-extrabold text-tile-sky italic">{map.title}</h1>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex w-48 flex-col gap-1" title={`${stats.mastered} dominados · ${stats.understood} entendidos · ${stats.reread} por repasar`}>
            <div className="flex h-2 overflow-hidden rounded-full bg-chip" aria-hidden>
              <span className="bg-tile-deep" style={{ width: pct(stats.mastered) }} />
              <span className="bg-tile-sky" style={{ width: pct(stats.understood) }} />
              <span className="bg-amber" style={{ width: pct(stats.reread) }} />
            </div>
            <span className="text-xs text-ink-muted">
              {stats.mastered + stats.understood}/{stats.total} entendidos · {stats.reread} por repasar
            </span>
          </div>
          <button
            type="button"
            onClick={() => setWeakOnly((v) => !v)}
            aria-pressed={weakOnly}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${weakOnly ? "bg-amber text-white" : "bg-chip text-ink-muted hover:text-ink"}`}
          >
            Puntos débiles
          </button>
          <button
            type="button"
            onClick={toggleGraph}
            aria-pressed={showGraph}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${showGraph ? "bg-ink text-white" : "bg-chip text-ink-muted hover:text-ink"}`}
          >
            Mapa <kbd className="ml-1 opacity-60">g</kbd>
          </button>
        </div>
      </header>

      {showGraph && (
        <ConceptGraph
          concepts={withStatus}
          links={links}
          currentId={currentId}
          nextUpId={upNext}
          weakOnly={weakOnly}
          onSelect={(id) => go(id)}
        />
      )}

      <div className={`grid grid-cols-1 gap-8 ${pathOpen ? "lg:grid-cols-[300px_minmax(0,1fr)]" : ""}`}>
        {pathOpen && (
        <PathList
          concepts={withStatus}
          currentId={currentId}
          nextUpId={upNext}
          weakOnly={weakOnly}
          onSelect={(id) => go(id)}
          onAdd={(title) =>
            run(async () => {
              await addConcept(map.id, title, null);
              router.refresh();
            })
          }
        />
        )}

        {current ? (
          <ConceptCard
            key={current.id}
            concept={{ ...current, status: statusOf(current) }}
            concepts={concepts}
            links={links}
            parentChain={chain(byId, current)}
            isPending={isPending}
            error={error}
            askRef={askRef}
            quizRef={quizRef}
            onGo={(id) => go(id)}
            actions={actions}
            onStatus={(s) => {
              setLocalStatus((m) => ({ ...m, [current.id]: s }));
              run(() => setConceptStatus(current.id, s));
            }}
            onQuizzed={(s) => setLocalStatus((m) => ({ ...m, [current.id]: s }))}
            run={run}
            refresh={() => router.refresh()}
            mapId={map.id}
            onDeleted={() => go(upNext ?? nextInOrder(concepts, currentId))}
          />
        ) : (
          <p className="rounded-3xl bg-white p-10 text-center text-sm text-ink-muted">Este mapa está vacío.</p>
        )}
      </div>
    </div>
  );
}

function pickRandom<T>(items: T[]): T | undefined {
  return items[Math.floor(Math.random() * items.length)];
}

function nextInOrder(concepts: ExplorerConcept[], currentId: string | null) {
  const i = concepts.findIndex((c) => c.id === currentId);
  return concepts[(i + 1) % concepts.length]?.id ?? null;
}

function chain(byId: Map<string, ExplorerConcept>, c: ExplorerConcept) {
  const out: ExplorerConcept[] = [];
  let p = c.parentId ? byId.get(c.parentId) : undefined;
  while (p && out.length < 10) {
    out.unshift(p);
    p = p.parentId ? byId.get(p.parentId) : undefined;
  }
  return out;
}

// ─── Left: the learning path ──────────────────────────────────────────
function PathList({
  concepts,
  currentId,
  nextUpId,
  weakOnly,
  onSelect,
  onAdd,
}: {
  concepts: ExplorerConcept[];
  currentId: string | null;
  nextUpId: string | null;
  weakOnly: boolean;
  onSelect: (id: string) => void;
  onAdd: (title: string) => void;
}) {
  const [adding, setAdding] = useState("");
  const childrenOf = (id: string | null) =>
    concepts.filter((c) => c.parentId === id).sort((a, b) => a.order - b.order);
  const weak = (c: ExplorerConcept) => c.status === "NEW" || c.status === "SEEN" || c.status === "REREAD";

  function render(id: string | null, level: number): React.ReactNode {
    return childrenOf(id).map((c) => {
      const kids = render(c.id, level + 1);
      const hidden = weakOnly && !weak(c);
      return (
        <li key={c.id}>
          {!hidden && (
            <button
              type="button"
              onClick={() => onSelect(c.id)}
              style={{ paddingLeft: `${0.75 + level * 1}rem` }}
              className={`flex w-full items-center gap-2.5 rounded-xl py-2 pr-2 text-left text-sm transition-colors ${
                c.id === currentId ? "bg-white font-semibold shadow-sm" : "hover:bg-white/60"
              }`}
            >
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${STATUS_STYLE[c.status].dot}`} title={STATUS_STYLE[c.status].label} />
              <span className="min-w-0 flex-1 truncate">{c.title}</span>
              {c.id === nextUpId && (
                <span className="shrink-0 rounded-full bg-tile-aqua px-1.5 py-0.5 text-[10px] font-bold text-white">siguiente</span>
              )}
            </button>
          )}
          {kids && <ul>{kids}</ul>}
        </li>
      );
    });
  }

  return (
    <aside className="flex flex-col gap-2 self-start lg:sticky lg:top-6" aria-label="Ruta de aprendizaje">
      <span className="px-3 text-xs font-bold text-ink-muted uppercase">Ruta</span>
      <ul className="flex max-h-[70vh] flex-col overflow-y-auto">{render(null, 0)}</ul>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (adding.trim()) onAdd(adding);
          setAdding("");
        }}
        className="px-1"
      >
        <input
          value={adding}
          onChange={(e) => setAdding(e.target.value)}
          placeholder="+ Añadir un concepto"
          aria-label="Añadir un concepto"
          className="w-full rounded-xl bg-transparent px-2 py-2 text-sm placeholder:text-ink-faint focus:bg-white"
        />
      </form>
    </aside>
  );
}

// ─── Middle: one concept ──────────────────────────────────────────────
function ConceptCard({
  concept,
  concepts,
  links,
  parentChain,
  isPending,
  error,
  askRef,
  quizRef,
  onGo,
  actions,
  onStatus,
  onQuizzed,
  run,
  refresh,
  mapId,
  onDeleted,
}: {
  concept: ExplorerConcept;
  concepts: ExplorerConcept[];
  links: ExplorerLink[];
  parentChain: ExplorerConcept[];
  isPending: boolean;
  error: string | null;
  askRef: React.RefObject<HTMLInputElement | null>;
  quizRef: React.RefObject<HTMLButtonElement | null>;
  onGo: (id: string) => void;
  actions: { skip: () => void; reread: () => void; deeper: () => void; random: () => void };
  onStatus: (s: Status) => void;
  onQuizzed: (s: Status) => void;
  run: (fn: () => Promise<void>) => void;
  refresh: () => void;
  mapId: string;
  onDeleted: () => void;
}) {
  const byId = new Map(concepts.map((c) => [c.id, c]));
  const children = concepts.filter((c) => c.parentId === concept.id).sort((a, b) => a.order - b.order);
  const needs = links.filter((l) => l.toId === concept.id && l.label !== "part of" && byId.has(l.fromId));
  const leadsTo = links.filter((l) => l.fromId === concept.id && l.label !== "part of" && byId.has(l.toId));

  const [question, setQuestion] = useState("");
  const [answers, setAnswers] = useState<{ q: string; a: string }[]>([]);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ title: concept.title, summary: concept.summary, explanation: concept.explanation });
  const [linkTarget, setLinkTarget] = useState("");
  const [busy, setBusy] = useState<"ask" | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  function ask() {
    const q = question.trim();
    if (!q) return;
    setBusy("ask");
    setLocalError(null);
    run(async () => {
      const r = await askAboutConcept(concept.id, q);
      setBusy(null);
      if (r.error !== null) return setLocalError(r.error);
      setAnswers((a) => [...a, { q, a: r.answer }]);
      setQuestion("");
    });
  }

  return (
    <article className="flex flex-col gap-6">
      <div className="flex flex-col gap-5 rounded-3xl bg-white p-6 shadow-[0_1px_2px_rgba(13,13,13,0.06)] sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <nav className="flex flex-wrap items-center gap-1 text-xs text-ink-muted" aria-label="Dentro de">
            {parentChain.map((p) => (
              <span key={p.id} className="flex items-center gap-1">
                <button type="button" onClick={() => onGo(p.id)} className="hover:text-ink hover:underline">
                  {p.title}
                </button>
                <ChevronRight size={12} />
              </span>
            ))}
          </nav>
          <select
            value={concept.status}
            onChange={(e) => onStatus(e.target.value as Status)}
            aria-label="Estado"
            className={`rounded-full border-0 px-3 py-1 text-xs font-bold ${STATUS_STYLE[concept.status].pill}`}
          >
            {(Object.keys(STATUS_STYLE) as Status[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_STYLE[s].label}
              </option>
            ))}
          </select>
        </div>

        {editing ? (
          <div className="flex flex-col gap-2">
            <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} aria-label="Título" className="rounded-xl border border-border-subtle px-3 py-2 text-xl font-bold" />
            <input value={draft.summary} onChange={(e) => setDraft({ ...draft, summary: e.target.value })} placeholder="Resumen en una frase" aria-label="Resumen" className="rounded-xl border border-border-subtle px-3 py-2 text-sm" />
            <textarea value={draft.explanation} onChange={(e) => setDraft({ ...draft, explanation: e.target.value })} rows={6} placeholder="Explicación" aria-label="Explicación" className="rounded-xl border border-border-subtle px-3 py-2 text-sm" />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() =>
                  run(async () => {
                    await editConcept(concept.id, draft);
                    setEditing(false);
                    refresh();
                  })
                }
                className="rounded-full bg-ink px-4 py-2 text-xs font-semibold text-white"
              >
                Guardar
              </button>
              <button type="button" onClick={() => setEditing(false)} className="rounded-full px-4 py-2 text-xs text-ink-muted hover:bg-chip">
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <>
            <h2 className="text-3xl font-extrabold text-balance">{concept.title}</h2>
            {concept.summary && <p className="text-lg font-semibold text-ink-muted">{concept.summary}</p>}
            {concept.explanation && <p className="text-base leading-relaxed whitespace-pre-line">{concept.explanation}</p>}
          </>
        )}

        {concept.excerpt && (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-ink-muted">
              De la fuente{concept.excerptFrom ? ` · ${concept.excerptFrom}` : ""}
            </span>
            <div className="px-5">
              {langFor(concept.excerptFrom) || looksLikeCode(concept.excerpt) ? (
                <CodeBlock code={concept.excerpt} language={langFor(concept.excerptFrom)} />
              ) : (
                <div className="border-l-2 border-border-subtle pl-4">
                  <RichContent content={concept.excerpt} paragraphClassName="text-sm leading-relaxed whitespace-pre-line text-ink-muted" />
                </div>
              )}
            </div>
          </div>
        )}

        {/* What to do next — every option is one tap. */}
        <div className="flex flex-wrap gap-2">
          <ActionButton onClick={actions.deeper} disabled={isPending} primary kbd="d">
            {children.length > 0 ? `Profundizar (${children.length})` : isPending ? "Dividiendo…" : "Profundizar"}
          </ActionButton>
          <ActionButton onClick={actions.reread} kbd="r">
            No lo sé
          </ActionButton>
        </div>
        {(error || localError) && <p className="text-sm text-red-500">{error ?? localError}</p>}

        {needs.length > 0 && (
          <Chips title="Se basa en" items={needs.map((l) => ({ id: l.fromId, title: byId.get(l.fromId)!.title, status: byId.get(l.fromId)!.status, label: l.label }))} onGo={onGo} onRemove={(id) => run(async () => { await unlinkConcepts(id, concept.id); refresh(); })} />
        )}
        {leadsTo.length > 0 && (
          <Chips title="Lleva a" items={leadsTo.map((l) => ({ id: l.toId, title: byId.get(l.toId)!.title, status: byId.get(l.toId)!.status, label: l.label }))} onGo={onGo} onRemove={(id) => run(async () => { await unlinkConcepts(concept.id, id); refresh(); })} />
        )}
      </div>

      <ConceptQuiz key={concept.id} conceptId={concept.id} startRef={quizRef} onStatus={onQuizzed} onDontKnow={actions.reread} />

      {/* Ask */}
      <section className="flex flex-col gap-3 rounded-3xl bg-white p-6 shadow-[0_1px_2px_rgba(13,13,13,0.06)]" aria-label="Preguntar">
        {answers.map((x, i) => (
          <div key={i} className="flex flex-col gap-1 text-sm">
            <span className="font-semibold">{x.q}</span>
            <p className="leading-relaxed text-ink-muted whitespace-pre-line">{x.a}</p>
          </div>
        ))}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask();
          }}
          className="flex gap-2"
        >
          <input
            ref={askRef}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Pregunta lo que quieras sobre esto…  (a)"
            aria-label="Tu pregunta"
            className="flex-1 rounded-2xl border border-border-subtle px-4 py-2.5 text-sm"
          />
          <button type="submit" disabled={busy !== null} className="rounded-full bg-ink px-5 text-sm font-semibold text-white disabled:opacity-50">
            {busy === "ask" ? "…" : "Preguntar"}
          </button>
        </form>
      </section>

      {/* Edit the map */}
      <details className="rounded-3xl px-2 text-sm text-ink-muted">
        <summary className="cursor-pointer select-none hover:text-ink">Editar este concepto</summary>
        <div className="mt-3 flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setEditing(true)} className="rounded-full bg-chip px-3 py-1.5 hover:text-ink">
              Editar texto
            </button>
            <button
              type="button"
              onClick={() => {
                const title = window.prompt("Título del subconcepto");
                if (title) run(async () => { await addConcept(mapId, title, concept.id); refresh(); });
              }}
              className="rounded-full bg-chip px-3 py-1.5 hover:text-ink"
            >
              + Subconcepto
            </button>
            <button
              type="button"
              onClick={() => {
                if (!window.confirm(`¿Eliminar "${concept.title}" y todo lo que contiene?`)) return;
                run(async () => { await deleteConcept(concept.id); onDeleted(); refresh(); });
              }}
              className="rounded-full bg-chip px-3 py-1.5 hover:text-red-600"
            >
              Eliminar
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span>Enlazar con</span>
            <select value={linkTarget} onChange={(e) => setLinkTarget(e.target.value)} aria-label="Concepto para enlazar" className="max-w-56 rounded-full border border-border-subtle bg-white px-3 py-1.5">
              <option value="">elige un concepto…</option>
              {concepts.filter((c) => c.id !== concept.id).map((c) => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
            {(["needs", "related"] as const).map((label) => (
              <button
                key={label}
                type="button"
                disabled={!linkTarget}
                onClick={() =>
                  run(async () => {
                    // "needs": the chosen concept is needed for this one.
                    if (label === "needs") await linkConcepts(linkTarget, concept.id, "needs");
                    else await linkConcepts(concept.id, linkTarget, "related");
                    setLinkTarget("");
                    refresh();
                  })
                }
                className="rounded-full bg-chip px-3 py-1.5 hover:text-ink disabled:opacity-40"
              >
                {label === "needs" ? "esto se basa en él" : "related"}
              </button>
            ))}
          </div>
        </div>
      </details>
    </article>
  );
}

function ActionButton({
  children,
  onClick,
  disabled,
  primary,
  kbd,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
  kbd?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex max-w-full items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold disabled:opacity-50 ${
        primary ? "bg-tile-sky text-white" : "bg-chip text-ink"
      }`}
    >
      <span className="truncate">{children}</span>
      {kbd && <kbd className="text-xs opacity-60">{kbd}</kbd>}
    </button>
  );
}

function Chips({
  title,
  items,
  onGo,
  onRemove,
}: {
  title: string;
  items: { id: string; title: string; status: Status; label?: string | null }[];
  onGo: (id: string) => void;
  onRemove?: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-ink-muted">{title}</span>
      <div className="flex flex-wrap gap-1.5">
        {items.map((i) => (
          <span key={i.id} className="group flex items-center rounded-full bg-chip text-sm">
            <button type="button" onClick={() => onGo(i.id)} className="flex items-center gap-2 py-1.5 pr-2 pl-3 hover:text-tile-sky">
              <span className={`h-2 w-2 rounded-full ${STATUS_STYLE[i.status].dot}`} />
              {i.title}
            </button>
            {onRemove && (
              <button
                type="button"
                onClick={() => onRemove(i.id)}
                aria-label={`Unlink ${i.title}`}
                className="pr-3 text-ink-faint opacity-0 group-hover:opacity-100 hover:text-red-600 focus:opacity-100"
              >
                ×
              </button>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
