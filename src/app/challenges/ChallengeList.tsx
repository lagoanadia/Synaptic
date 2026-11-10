"use client";

import { useT } from "@/app/LangProvider";
import Link from "next/link";
import { useEffect, useState } from "react";
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
  skill: string | null;
  passed: boolean;
  subject: string | null;
};

type Status = "all" | "todo" | "solved";
const STATUSES: { key: Status; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "todo", label: "Por hacer" },
  { key: "solved", label: "Resueltos" },
];
type Filters = { status: Status; language: Language | null; difficulty: Difficulty | null };
const EMPTY: Filters = { status: "all", language: null, difficulty: null };
const KEY = "synaptic.challenges.filters";

// Your challenges: a row of filters and a grid of cards.
export function ChallengeList({ items }: { items: ChallengeItem[] }) {
  const t = useT();
  const [f, setF] = useState<Filters>(EMPTY);
  // Browser storage, so only after mount.
  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(KEY) ?? "null");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setF({ ...EMPTY, status: saved.status === "solved" || saved.status === "todo" ? saved.status : "all", language: saved.language ?? null, difficulty: saved.difficulty ?? null });
    } catch {}
  }, []);
  function set(patch: Partial<Filters>) {
    setF((cur) => {
      const next = { ...cur, ...patch };
      try {
        window.localStorage.setItem(KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }

  const languages = LANGUAGES.filter((l) => items.some((i) => i.language === l));
  const shown = items.filter(
    (i) =>
      (f.status === "all" || (f.status === "solved") === i.passed) &&
      (!f.language || i.language === f.language) &&
      (!f.difficulty || difficultyOf(i.difficulty).key === f.difficulty),
  );

  if (items.length === 0) {
    return <p className="rounded-lg bg-[#fbfbfa] px-6 py-12 text-center text-sm text-ink-faint">{t("Aún no hay retos. Pide tres a la derecha.")}</p>;
  }

  const chip = (on: boolean) => `flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs transition-colors ${on ? "bg-ink text-white" : "bg-chip text-ink-muted hover:text-ink"}`;
  const nextDifficulty = (): Difficulty | null => {
    const i = f.difficulty ? DIFFICULTIES.findIndex((d) => d.key === f.difficulty) : -1;
    return i + 1 < DIFFICULTIES.length ? DIFFICULTIES[i + 1].key : null;
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-1.5">
        {STATUSES.map((s) => (
          <button key={s.key} type="button" aria-pressed={f.status === s.key} onClick={() => set({ status: s.key })} className={chip(f.status === s.key)}>
            {t(s.label)}
          </button>
        ))}
        {languages.length > 1 && <span className="mx-1 h-4 w-px bg-border-subtle" />}
        {languages.length > 1 &&
          languages.map((l) => (
            <button key={l} type="button" aria-pressed={f.language === l} title={t(LANGUAGE_INFO[l].label)} onClick={() => set({ language: f.language === l ? null : l })} className={chip(f.language === l)}>
              <Badge language={l} small />
            </button>
          ))}
        <span className="mx-1 h-4 w-px bg-border-subtle" />
        <button
          type="button"
          onClick={() => set({ difficulty: nextDifficulty() })}
          title={f.difficulty ? t("Solo {0}", { 0: difficultyOf(f.difficulty).label }) : t("Cualquier dificultad")}
          aria-label={t("Dificultad")}
          className={chip(!!f.difficulty)}
        >
          {f.difficulty ? <Bars n={DIFFICULTIES.findIndex((d) => d.key === f.difficulty)} color={difficultyOf(f.difficulty).bar} /> : <Bars n={2} color="bg-ink-muted" />}
        </button>
      </div>

      {shown.length === 0 ? (
        <button type="button" onClick={() => set(EMPTY)} className="rounded-lg bg-[#fbfbfa] px-6 py-10 text-sm text-ink-faint hover:text-ink">
          {t("Nada con estos filtros · quitar filtros")}
        </button>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {shown.map((c) => {
            const d = difficultyOf(c.difficulty);
            return (
              <li key={c.id} className={`group relative flex flex-col gap-2.5 rounded-lg border p-4 transition-colors hover:border-[#d3d1cb] ${c.passed ? "border-[#dfeee4] bg-[#f3f8f4]" : "border-border-subtle bg-white"}`}>
                <div className="flex items-start justify-between">
                  <Badge language={c.language} />
                  <DeleteButton
                    action={deleteChallenge.bind(null, c.id)}
                    confirmMessage={t("¿Eliminar \"{0}\"?", { 0: c.title })}
                    className="relative z-10 rounded p-1 text-ink-faint/60 hover:bg-chip hover:text-red-600"
                  >
                    <TrashIcon size={14} title={t("Eliminar reto")} />
                  </DeleteButton>
                </div>
                <Link href={`/challenges/${c.id}`} className="font-semibold leading-snug after:absolute after:inset-0">
                  {c.title}
                </Link>
                {c.skill && <span className="-mt-1.5 text-xs text-ink-muted">{c.skill}</span>}
                <div className="flex items-center gap-2 text-xs">
                  <span title={t(d.label)}>
                    <Bars n={DIFFICULTIES.indexOf(d)} color={d.bar} />
                  </span>
                  {c.subject && <span className="max-w-40 truncate rounded bg-chip px-1.5 py-0.5 text-ink-muted">{c.subject}</span>}
                  {c.passed && <CheckIcon size={13} className="ml-auto text-[#448361]" />}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function Badge({ language, small = false }: { language: Language; small?: boolean }) {
  return (
    <span className={`grid shrink-0 place-items-center rounded-md font-mono font-extrabold ${LANGUAGE_STYLE[language].badge} ${small ? "h-4 px-1 text-[9px]" : "size-8 text-[11px]"}`}>
      {LANGUAGE_INFO[language].short}
    </span>
  );
}

// Signal-strength bars: 1, 2 or 3 lit.
export function Bars({ n, color }: { n: number; color: string }) {
  return (
    <span className="flex h-3 items-end gap-0.5" aria-hidden>
      {[0, 1, 2].map((b) => (
        <span key={b} className={`w-1 rounded-full ${b <= n ? color : "bg-ink-faint/30"}`} style={{ height: `${(b + 1) * 3 + 3}px` }} />
      ))}
    </span>
  );
}
