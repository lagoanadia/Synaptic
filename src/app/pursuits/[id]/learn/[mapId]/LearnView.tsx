"use client";

import { useT } from "@/app/LangProvider";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckIcon } from "@/app/icons";
import { DraggableMap } from "@/app/DraggableMap";
import { looksLikeCode } from "@/lib/internalize";
import type { MapCluster } from "@/lib/knowledgeMap";
import { CodeBlock } from "../../CodeBlock";
import { ScanText } from "./ScanText";
import { RichContent } from "../../RichContent";
import { ConceptQuiz } from "./ConceptQuiz";
import { addConceptByName, askAboutConcept, deleteConcept, editConcept, goDeeper, openConcept } from "../actions";

export type LearnConcept = {
  id: string;
  title: string;
  summary: string;
  explanation: string;
  excerpt: string | null;
  excerptFrom: string | null;
};

const EXT_LANG: Record<string, string> = { ts: "ts", tsx: "ts", js: "js", jsx: "js", mjs: "js", py: "py", java: "java", sql: "sql" };
const langFor = (from: string | null) => EXT_LANG[from?.split(".").pop()?.toLowerCase() ?? ""] ?? "";

const BulbIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.4 1 1.1 1 1.8V16h5v-.3c0-.7.4-1.4 1-1.8A6 6 0 0 0 12 3Z" />
  </svg>
);

// Aprender: the unit's map on the left (one place, this unit only), the
// concept on the right, and two choices — ✓ "lo entiendo" (a quick check;
// pass and it moves on by itself) and 💡 "explícamelo de otra forma".
export function LearnView({
  pursuitId,
  mapId,
  crumbs,
  concept,
  map,
}: {
  pursuitId: string;
  mapId: string;
  crumbs: { label: string; href?: string }[];
  concept: LearnConcept;
  map: MapCluster[];
}) {
  const t = useT();
  const router = useRouter();
  const [mode, setMode] = useState<"read" | "check" | "explain">("read");
  const [explanation, setExplanation] = useState<string | null>(null);
  const [answers, setAnswers] = useState<{ q: string; a: string }[]>([]);
  const [question, setQuestion] = useState("");
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ title: concept.title, summary: concept.summary, explanation: concept.explanation });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const quizStart = useRef<HTMLButtonElement>(null);

  // Opening a concept counts as having seen it.
  useEffect(() => {
    openConcept(concept.id).catch(() => {});
  }, [concept.id]);

  function explainDifferently() {
    setMode("explain");
    if (explanation) return;
    start(async () => {
      const r = await askAboutConcept(concept.id, t("Explícamelo de otra forma: más sencillo y con un ejemplo cotidiano, en 3 o 4 frases."));
      if (r.error !== null) setError(r.error);
      else setExplanation(r.answer);
    });
  }

  function ask() {
    const q = question.trim();
    if (!q) return;
    setQuestion("");
    start(async () => {
      const r = await askAboutConcept(concept.id, q);
      if (r.error !== null) setError(r.error);
      else setAnswers((a) => [...a, { q, a: r.answer }]);
    });
  }

  const roundMain = "grid size-[52px] place-items-center rounded-full bg-accent text-white shadow-[0_4px_12px_rgba(35,131,226,.35)] disabled:opacity-50";
  const roundAlt = "grid size-11 place-items-center rounded-full border border-[#e3e2de] text-ink-muted hover:bg-chip hover:text-ink";

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-4 px-6 py-8 sm:px-12">
      <nav className="text-sm text-ink-faint" aria-label={t("Ruta")}>
        {crumbs.map((c, i) => (
          <span key={i}>
            {i > 0 && <span className="mx-1.5">/</span>}
            {c.href ? (
              <Link href={c.href} className="hover:text-ink hover:underline">
                {t(c.label)}
              </Link>
            ) : (
              <span className="text-ink-muted">{t(c.label)}</span>
            )}
          </span>
        ))}
      </nav>

      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-2">
        <div className="lg:sticky lg:top-6">
          {map[0] && (
            <DraggableMap
              cluster={map[0]}
              currentId={concept.id}
              onAdd={async (text) => {
                const r = await addConceptByName(mapId, text);
                if (r.error !== null) return r.error;
                router.push(`/pursuits/${pursuitId}/learn/${mapId}?c=${r.conceptId}`);
                return null;
              }}
            />
          )}
        </div>

        <article className="flex min-w-0 flex-col gap-4 text-[15px] leading-relaxed max-lg:order-first">
          {editing ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                start(async () => {
                  await editConcept(concept.id, draft);
                  setEditing(false);
                  router.refresh();
                });
              }}
              className="flex flex-col gap-2"
            >
              <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} aria-label={t("Título")} className="rounded-md border border-border-subtle px-2 py-1 text-2xl font-bold" />
              <input value={draft.summary} onChange={(e) => setDraft({ ...draft, summary: e.target.value })} aria-label={t("Resumen")} className="rounded-md border border-border-subtle px-2 py-1" />
              <textarea value={draft.explanation} onChange={(e) => setDraft({ ...draft, explanation: e.target.value })} rows={6} aria-label={t("Explicación")} className="rounded-md border border-border-subtle px-2 py-1" />
              <span className="flex gap-2">
                <button type="submit" disabled={pending} className="rounded-md bg-ink px-3 py-1.5 text-sm text-white">
                  {t("Guardar")}
                </button>
                <button type="button" onClick={() => setEditing(false)} className="rounded-md px-3 py-1.5 text-sm text-ink-muted hover:bg-chip">
                  {t("Cancelar")}
                </button>
              </span>
            </form>
          ) : (
            <>
              <div className="flex items-start gap-2">
                <h1 className="flex-1 text-[1.9rem] leading-tight font-bold tracking-tight">{concept.title}</h1>
                <span className="relative">
                  <button type="button" onClick={() => setMenu((m) => !m)} aria-label={t("Más")} title={t("Más")} className="rounded-md px-2 py-1 text-ink-faint hover:bg-chip hover:text-ink">
                    ⋯
                  </button>
                  {menu && (
                    <div className="absolute top-full right-0 z-10 mt-1 w-56 rounded-lg bg-white p-1 text-sm shadow-[0_0_0_1px_rgba(15,15,15,.05),0_10px_26px_rgba(15,15,15,.16)]">
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => {
                          setMenu(false);
                          start(async () => {
                            const r = await goDeeper(concept.id);
                            if (r.error !== null) setError(r.error);
                            router.refresh();
                          });
                        }}
                        className="block w-full rounded-md px-2.5 py-1.5 text-left hover:bg-chip"
                      >
                        {t("Dividir en subconceptos")}
                      </button>
                      <button type="button" onClick={() => { setMenu(false); setEditing(true); }} className="block w-full rounded-md px-2.5 py-1.5 text-left hover:bg-chip">
                        {t("Editar")}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!window.confirm(t("¿Eliminar \"{0}\" y todo lo que contiene?", { 0: concept.title }))) return;
                          start(async () => {
                            await deleteConcept(concept.id);
                            router.replace(`/pursuits/${pursuitId}/learn/${mapId}`);
                          });
                        }}
                        className="block w-full rounded-md px-2.5 py-1.5 text-left text-red-600 hover:bg-chip"
                      >
                        {t("Eliminar")}
                      </button>
                    </div>
                  )}
                </span>
              </div>
              {concept.summary && <p className="text-[17px] font-medium text-ink-muted">{concept.summary}</p>}
              {concept.explanation && concept.explanation !== concept.summary && <ScanText text={concept.explanation} />}
            </>
          )}

          {concept.excerpt && (
            <div className="flex flex-col gap-2 rounded-lg bg-sidebar p-3.5">
              <span className="text-ink-faint" title={t("De tus apuntes")} aria-label={t("De tus apuntes")}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden>
                  <path d="M7 3h7l5 5v13H7z" />
                  <path d="M14 3v5h5" />
                </svg>
              </span>
              {langFor(concept.excerptFrom) || looksLikeCode(concept.excerpt) ? (
                <CodeBlock code={concept.excerpt} language={langFor(concept.excerptFrom)} />
              ) : (
                <RichContent content={concept.excerpt} paragraphClassName="text-sm leading-relaxed whitespace-pre-line" />
              )}
            </div>
          )}

          {mode === "check" && (
            <ConceptQuiz
              key={concept.id}
              conceptId={concept.id}
              startRef={quizStart}
              auto
              onStatus={() => {}}
              onDontKnow={explainDifferently}
              onFinish={(passed) => {
                // Passed: the server picks what comes next.
                if (passed) {
                  router.replace(`/pursuits/${pursuitId}/learn/${mapId}`);
                  router.refresh();
                } else explainDifferently();
              }}
            />
          )}

          {mode === "explain" && (
            <div className="flex flex-col gap-3 rounded-lg bg-sidebar p-4">
              {explanation ? <ScanText text={explanation} /> : <span className="h-3 w-40 animate-pulse rounded bg-chip" />}
              {answers.map((x, i) => (
                <div key={i} className="flex flex-col gap-1 text-sm">
                  <span className="self-end rounded-xl bg-white px-3 py-1.5">{x.q}</span>
                  <ScanText text={x.a} className="text-sm" />
                </div>
              ))}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  ask();
                }}
                className="flex items-center rounded-full border border-[#e3e2de] bg-white py-1 pr-1 pl-4"
              >
                <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder={t("¿Qué no te cuadra?")} aria-label={t("Tu duda")} className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
                <button type="submit" disabled={pending || !question.trim()} aria-label={t("Preguntar")} className="grid size-8 place-items-center rounded-full bg-ink text-white disabled:opacity-40">
                  →
                </button>
              </form>
            </div>
          )}

          {mode !== "check" && !editing && (
            <div className="flex items-center gap-3 pt-1">
              <button type="button" onClick={() => setMode("check")} title={t("Lo entiendo")} aria-label={t("Lo entiendo")} className={roundMain}>
                <CheckIcon size={22} className="block" />
              </button>
              {mode === "read" && (
                <button type="button" onClick={explainDifferently} title={t("Explícamelo de otra forma")} aria-label={t("Explícamelo de otra forma")} className={roundAlt}>
                  <BulbIcon />
                </button>
              )}
            </div>
          )}
          {error && <p className="text-sm text-red-500">{error}</p>}
        </article>
      </div>
    </div>
  );
}
