"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { finishOnboarding, skipOnboarding } from "./actions";
import { LogoMark } from "../Logo";

const AREA_CHOICES = ["School", "Work", "Projects", "Habits", "Languages", "Reading"];

const ITEM_PROMPT: Record<string, { question: string; placeholder: string }> = {
  School: { question: "Which subjects?", placeholder: "AD, Bases de Datos, Programación" },
  Work: { question: "What are you working on?", placeholder: "Client site, monthly report" },
  Projects: { question: "Which projects?", placeholder: "Portfolio, Synaptic" },
  Habits: { question: "Which habits?", placeholder: "Running, Reading 20 min" },
  Languages: { question: "Which languages?", placeholder: "English, German" },
  Reading: { question: "What are you reading?", placeholder: "Atomic Habits" },
};
const promptFor = (area: string) =>
  ITEM_PROMPT[area] ?? { question: `What's in ${area}?`, placeholder: "Comma-separated" };

const splitList = (s: string) =>
  s
    .split(/[,\n]/)
    .map((x) => x.trim())
    .filter(Boolean);

// Three quick screens on the very first visit. Every answer becomes real
// content: sections, subjects, and a starter note about what you're
// learning. Everything is skippable.
export function Onboarding({ name }: { name: string | null }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [areas, setAreas] = useState<string[]>([]);
  const [custom, setCustom] = useState("");
  const [items, setItems] = useState<Record<string, string>>({});
  const [topic, setTopic] = useState("");
  const [subject, setSubject] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const allItems = areas.flatMap((a) => splitList(items[a] ?? ""));

  function toggle(area: string) {
    setAreas((cur) => (cur.includes(area) ? cur.filter((a) => a !== area) : [...cur, area]));
  }

  function addCustom() {
    const c = custom.trim();
    if (c && !areas.includes(c)) setAreas((cur) => [...cur, c]);
    setCustom("");
  }

  function finish() {
    setError(null);
    startTransition(async () => {
      const result = await finishOnboarding({
        areas: areas.map((a) => ({ name: a, items: splitList(items[a] ?? "") })),
        learning: { topic, subject: subject || allItems[0] || null },
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      router.push(result.landingId ? `/pursuits/${result.landingId}` : "/pursuits");
      router.refresh();
    });
  }

  if (isPending) {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <span className="h-10 w-10 animate-spin rounded-full border-4 border-tile-aqua border-t-transparent" />
          <p className="text-lg font-bold">Building your space…</p>
          <p className="text-sm text-ink-muted">
            {topic ? `Writing your first notes on ${topic}.` : "Setting up your sections."}
          </p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="flex items-center justify-between">
        <div className="flex gap-1.5" aria-label={`Step ${step + 1} of 3`}>
          {[0, 1, 2].map((i) => (
            <span key={i} className={`h-1.5 w-8 rounded-full ${i <= step ? "bg-tile-aqua" : "bg-chip"}`} />
          ))}
        </div>
        <button
          type="button"
          onClick={() => startTransition(async () => {
            await skipOnboarding();
            router.refresh();
          })}
          className="text-xs text-ink-faint hover:text-ink"
        >
          Skip — start empty
        </button>
      </div>

      {step === 0 && (
        <>
          <h1 className="text-3xl font-extrabold">
            Hi{name ? ` ${name.split(" ")[0]}` : ""}. What are you juggling right now?
          </h1>
          <p className="text-sm text-ink-muted">Pick all that apply. Each one becomes a section.</p>
          <div className="flex flex-wrap gap-2">
            {[...AREA_CHOICES, ...areas.filter((a) => !AREA_CHOICES.includes(a))].map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => toggle(a)}
                aria-pressed={areas.includes(a)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                  areas.includes(a) ? "bg-tile-sky text-white" : "bg-chip text-ink-muted hover:text-ink"
                }`}
              >
                {a}
              </button>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              addCustom();
            }}
            className="flex gap-2"
          >
            <input
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder="Something else…"
              aria-label="Add your own area"
              className="flex-1 rounded-2xl border border-border-subtle px-4 py-2.5 text-sm"
            />
            <button type="submit" className="rounded-full bg-chip px-4 text-sm font-semibold">
              Add
            </button>
          </form>
          <Next disabled={areas.length === 0} onClick={() => setStep(1)} />
        </>
      )}

      {step === 1 && (
        <>
          <h1 className="text-3xl font-extrabold">Name a few things in each.</h1>
          <p className="text-sm text-ink-muted">Comma-separated. Leave any blank.</p>
          <div className="flex flex-col gap-4">
            {areas.map((a) => (
              <label key={a} className="flex flex-col gap-1.5">
                <span className="text-sm font-semibold">
                  {a} · <span className="font-normal text-ink-muted">{promptFor(a).question}</span>
                </span>
                <input
                  value={items[a] ?? ""}
                  onChange={(e) => setItems((cur) => ({ ...cur, [a]: e.target.value }))}
                  placeholder={promptFor(a).placeholder}
                  className="rounded-2xl border border-border-subtle px-4 py-2.5 text-sm"
                />
              </label>
            ))}
          </div>
          <div className="flex justify-between">
            <Back onClick={() => setStep(0)} />
            <Next onClick={() => setStep(2)} />
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <h1 className="text-3xl font-extrabold">One thing you&apos;re learning this week?</h1>
          <p className="text-sm text-ink-muted">
            We&apos;ll write your first note, flashcards and practice tasks about it, so you start
            with something real.
          </p>
          <input
            autoFocus
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. SQL joins, ficheros secuenciales, present perfect"
            aria-label="What you're learning"
            className="rounded-2xl border border-border-subtle px-4 py-3 text-base"
          />
          {allItems.length > 1 && (
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-semibold">For which one?</span>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="rounded-2xl border border-border-subtle bg-white px-4 py-2.5"
              >
                {allItems.map((i) => (
                  <option key={i} value={i}>
                    {i}
                  </option>
                ))}
              </select>
            </label>
          )}
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex justify-between">
            <Back onClick={() => setStep(1)} />
            <button
              type="button"
              onClick={finish}
              className="rounded-full bg-ink px-6 py-3 text-sm font-bold text-white transition-transform hover:-translate-y-0.5"
            >
              {topic.trim() ? "Build my space →" : "Skip this, build it →"}
            </button>
          </div>
        </>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-6 px-6 py-12">
      <LogoMark size={32} />
      <div className="flex flex-col gap-5 rounded-3xl bg-white p-6 shadow-[0_1px_2px_rgba(13,13,13,0.06)] sm:p-8">
        {children}
      </div>
    </div>
  );
}

function Next({ onClick, disabled = false }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="self-end rounded-full bg-ink px-6 py-3 text-sm font-bold text-white transition-transform hover:-translate-y-0.5 disabled:opacity-40 disabled:hover:translate-y-0"
    >
      Next →
    </button>
  );
}

function Back({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="rounded-full px-4 py-3 text-sm text-ink-muted hover:bg-chip">
      ← Back
    </button>
  );
}
