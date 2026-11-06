"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CheckIcon, TrashIcon } from "@/app/icons";
import { LANGUAGE_INFO, LANGUAGES, type Language } from "@/lib/challenge";
import { DeleteButton } from "../pursuits/DeleteButton";
import { deleteChallenge } from "./actions";
import { DIFFICULTIES, LANGUAGE_STYLE, difficultyOf, type Difficulty } from "./look";

export type ChallengeItem = {
  id: string;
  title: string;
  language: Language;
  difficulty: string;
  passed: boolean;
  started: boolean;
  subject: string | null;
};

type Status = "all" | "todo" | "started" | "solved";
const STATUSES: { key: Status; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "todo", label: "Por hacer" },
  { key: "started", label: "Empezados" },
  { key: "solved", label: "Resueltos" },
];
type Filters = { status: Status; language: Language | null; difficulty: Difficulty | null; subject: string | null; q: string };
const EMPTY: Filters = { status: "all", language: null, difficulty: null, subject: null, q: "" };
const KEY = "synaptic.challenges.filters";

// Your challenges: progress at the top, filters, and a grid of cards.
export function ChallengeList({ items }: { items: ChallengeItem[] }) {
  const [f, setF] = useState<Filters>(EMPTY);
  // Browser storage, so only after mount.
  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(KEY) ?? "null");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setF({ ...EMPTY, ...saved, q: "" });
    } catch {}
  }, []);
  function set(patch: Partial<Filters>) {
    setF((cur) => {
      const next = { ...cur, ...patch };
      try {
        window.localStorage.setItem(KEY, JSON.stringify({ ...next, q: "" }));
      } catch {}
      return next;
    });
  }

  const languages = LANGUAGES.filter((l) => items.some((i) => i.language === l));
  const subjects = [...new Set(items.map((i) => i.subject).filter((s): s is string => !!s))];
  const statusOf = (i: ChallengeItem): Status => (i.passed ? "solved" : i.started ? "started" : "todo");

  const shown = useMemo(() => {
    const q = f.q.trim().toLowerCase();
    return items.filter(
      (i) =>
        (f.status === "all" || statusOf(i) === f.status) &&
        (!f.language || i.language === f.language) &&
        (!f.difficulty || difficultyOf(i.difficulty).key === f.difficulty) &&
        (!f.subject || i.subject === f.subject) &&
        (!q || i.title.toLowerCase().includes(q)),
    );
  }, [items, f]);

  const solved = items.filter((i) => i.passed).length;
  const filtered = f.status !== "all" || f.language || f.difficulty || f.subject || f.q;

  if (items.length === 0) {
    return (
      <p className="rounded-3xl bg-callout px-6 py-10 text-center text-sm text-ink-muted">
        Aún no hay ninguno. Pide uno — se hará a partir de lo que estudias.
      </p>
    );
  }

  const chip = (on: boolean) =>
    `flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
      on ? "bg-ink text-white" : "bg-white text-ink-muted hover:text-ink"
    }`;

  return (
    <div className="flex flex-col gap-5">
      {/* Progress */}
      <div className="flex flex-col gap-2 rounded-3xl bg-white p-5 shadow-[0_1px_2px_rgba(13,13,13,0.06)]">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-3xl font-extrabold">
            {solved}
            <span className="text-lg text-ink-muted">/{items.length}</span>
          </span>
          <span className="text-sm font-semibold text-ink-muted">resueltos</span>
        </div>
        <div className="flex h-2.5 overflow-hidden rounded-full bg-chip">
          {DIFFICULTIES.map((d) => {
            const n = items.filter((i) => i.passed && difficultyOf(i.difficulty).key === d.key).length;
            return <span key={d.key} className={d.bar} style={{ width: `${(n / items.length) * 100}%` }} title={`${n} ${d.label}`} />;
          })}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
          {DIFFICULTIES.map((d) => {
            const all = items.filter((i) => difficultyOf(i.difficulty).key === d.key);
            if (!all.length) return null;
            return (
              <span key={d.key} className="flex items-center gap-1.5">
                <span className={`size-2 rounded-full ${d.bar}`} />
                {d.label} {all.filter((i) => i.passed).length}/{all.length}
              </span>
            );
          })}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-2.5">
        <input
          value={f.q}
          onChange={(e) => set({ q: e.target.value })}
          placeholder="Buscar por título…"
          aria-label="Buscar retos"
          className="rounded-2xl border border-border-subtle bg-white px-4 py-2.5 text-sm"
        />
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Estado">
          {STATUSES.map((s) => {
            const n = s.key === "all" ? items.length : items.filter((i) => statusOf(i) === s.key).length;
            return (
              <button key={s.key} type="button" aria-pressed={f.status === s.key} onClick={() => set({ status: s.key })} className={chip(f.status === s.key)}>
                {s.label} <span className="opacity-60">{n}</span>
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {languages.length > 1 &&
            languages.map((l) => (
              <button
                key={l}
                type="button"
                aria-pressed={f.language === l}
                onClick={() => set({ language: f.language === l ? null : l })}
                className={chip(f.language === l)}
              >
                <span className={`rounded px-1 font-mono text-[10px] font-extrabold ${LANGUAGE_STYLE[l].badge}`}>{LANGUAGE_INFO[l].short}</span>
                {LANGUAGE_INFO[l].label}
              </button>
            ))}
          {languages.length > 1 && <span className="mx-1 h-4 w-px bg-border-subtle" />}
          {DIFFICULTIES.map((d, n) => (
            <button
              key={d.key}
              type="button"
              aria-pressed={f.difficulty === d.key}
              onClick={() => set({ difficulty: f.difficulty === d.key ? null : d.key })}
              className={chip(f.difficulty === d.key)}
            >
              <Bars n={n} color={d.bar} />
              {d.label}
            </button>
          ))}
        </div>
        {subjects.length > 1 && (
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Asignatura">
            {subjects.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={f.subject === s}
                onClick={() => set({ subject: f.subject === s ? null : s })}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                  f.subject === s ? "bg-tile-sky text-white" : "bg-white text-ink-muted hover:text-ink"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Cards */}
      {shown.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-3xl bg-callout px-6 py-10 text-sm text-ink-muted">
          Ningún reto con estos filtros.
          <button type="button" onClick={() => set(EMPTY)} className="font-semibold text-ink underline">
            Quitar filtros
          </button>
        </div>
      ) : (
        <>
          {filtered && (
            <p className="text-xs text-ink-muted">
              {shown.length} de {items.length} ·{" "}
              <button type="button" onClick={() => set(EMPTY)} className="font-semibold underline">
                quitar filtros
              </button>
            </p>
          )}
          <ul className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
            {shown.map((c) => {
              const d = difficultyOf(c.difficulty);
              const status = statusOf(c);
              return (
                <li
                  key={c.id}
                  className={`group relative flex flex-col gap-3 rounded-2xl p-4 shadow-[0_1px_2px_rgba(13,13,13,0.06)] transition-shadow hover:shadow-md ${
                    c.passed ? "bg-mint/10" : "bg-white"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className={`grid size-9 shrink-0 place-items-center rounded-xl font-mono text-xs font-extrabold ${LANGUAGE_STYLE[c.language].badge}`}>
                      {LANGUAGE_INFO[c.language].short}
                    </span>
                    <Link href={`/challenges/${c.id}`} className="min-w-0 flex-1 font-bold leading-snug after:absolute after:inset-0 hover:underline">
                      {c.title}
                    </Link>
                    <DeleteButton
                      action={deleteChallenge.bind(null, c.id)}
                      confirmMessage={`¿Eliminar "${c.title}"?`}
                      className="relative z-10 rounded-full p-1 text-ink-faint opacity-0 group-hover:opacity-100 hover:text-red-600 focus:opacity-100"
                    >
                      <TrashIcon size={14} title="Eliminar reto" />
                    </DeleteButton>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="flex items-center gap-1.5 text-ink-muted">
                      <Bars n={DIFFICULTIES.indexOf(d)} color={d.bar} />
                      {d.label}
                    </span>
                    {c.subject && <span className="max-w-40 truncate rounded-full bg-chip px-2 py-0.5 text-ink-muted">{c.subject}</span>}
                    <span
                      className={`ml-auto flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${
                        status === "solved" ? "bg-mint text-white" : status === "started" ? "bg-amber/20 text-amber" : "bg-chip text-ink-muted"
                      }`}
                    >
                      {status === "solved" && <CheckIcon size={11} />}
                      {status === "solved" ? "Resuelto" : status === "started" ? "Empezado" : "Nuevo"}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

// Signal-strength bars: 1, 2 or 3 lit.
function Bars({ n, color }: { n: number; color: string }) {
  return (
    <span className="flex h-3 items-end gap-0.5" aria-hidden>
      {[0, 1, 2].map((b) => (
        <span key={b} className={`w-1 rounded-full ${b <= n ? color : "bg-ink-faint/30"}`} style={{ height: `${(b + 1) * 3 + 3}px` }} />
      ))}
    </span>
  );
}
