"use client";

import { ArrowLeft, ArrowRight } from "@/app/icons";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { finishOnboarding, skipOnboarding } from "./actions";
import { LogoMark } from "../Logo";

const AREA_CHOICES = ["Estudios", "Trabajo", "Proyectos", "Hábitos", "Idiomas", "Lectura"];

const ITEM_PROMPT: Record<string, { question: string; placeholder: string }> = {
  Estudios: { question: "¿Qué asignaturas?", placeholder: "AD, Bases de Datos, Programación" },
  Trabajo: { question: "¿En qué estás trabajando?", placeholder: "Web de un cliente, informe mensual" },
  Proyectos: { question: "¿Qué proyectos?", placeholder: "Portfolio, Synaptic" },
  Hábitos: { question: "¿Qué hábitos?", placeholder: "Correr, Leer 20 min" },
  Idiomas: { question: "¿Qué idiomas?", placeholder: "Inglés, Alemán" },
  Lectura: { question: "¿Qué estás leyendo?", placeholder: "Atomic Habits" },
};
const promptFor = (area: string) =>
  ITEM_PROMPT[area] ?? { question: `¿Qué hay en ${area}?`, placeholder: "Separados por comas" };

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
          <p className="text-lg font-bold">Creando tu espacio…</p>
          <p className="text-sm text-ink-muted">
            {topic ? `Escribiendo tus primeras notas sobre ${topic}.` : "Preparando tus secciones."}
          </p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="flex items-center justify-between">
        <div className="flex gap-1.5" aria-label={`Paso ${step + 1} de 3`}>
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
          Saltar — empezar vacío
        </button>
      </div>

      {step === 0 && (
        <>
          <h1 className="text-3xl font-extrabold">
            Hola{name ? ` ${name.split(" ")[0]}` : ""}. ¿Qué tienes entre manos ahora mismo?
          </h1>
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
              placeholder="Otra cosa…"
              aria-label="Añade tu propia área"
              className="flex-1 rounded-2xl border border-border-subtle px-4 py-2.5 text-sm"
            />
            <button type="submit" className="rounded-full bg-chip px-4 text-sm font-semibold">
              Añadir
            </button>
          </form>
          <Next disabled={areas.length === 0} onClick={() => setStep(1)} />
        </>
      )}

      {step === 1 && (
        <>
          <h1 className="text-3xl font-extrabold">Nombra unas cuantas cosas en cada una.</h1>
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
          <h1 className="text-3xl font-extrabold">¿Algo que estés aprendiendo esta semana?</h1>
          <input
            autoFocus
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="p. ej. joins en SQL, ficheros secuenciales, present perfect"
            aria-label="Lo que estás aprendiendo"
            className="rounded-2xl border border-border-subtle px-4 py-3 text-base"
          />
          {allItems.length > 1 && (
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-semibold">¿Para cuál?</span>
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
              {topic.trim() ? "Crear mi espacio" : "Saltar esto y crearlo"} <ArrowRight />
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
      Siguiente <ArrowRight />
    </button>
  );
}

function Back({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="rounded-full px-4 py-3 text-sm text-ink-muted hover:bg-chip">
      <ArrowLeft /> Atrás
    </button>
  );
}
