"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useT } from "@/app/LangProvider";
import type { Mark } from "@/lib/calmMap";
import { Dot, Ring, sunflower } from "../../dots";

type D = { id: string; title: string; href: string; mark: Mark };
type Preset = "rec" | "red" | "all";

const S = 640;

// A unit's big circle of dots and its three ways in. "Elegir conceptos"
// turns the dots into a selection: tap to add or take one out, or pick a
// preset; "Empezar" quizzes just those.
export function UnitView({ dots, title, subject, scope, finalHref, back }: { dots: D[]; title: string; subject: string; scope: string; finalHref: string; back: string }) {
  const t = useT();
  const router = useRouter();
  const [choosing, setChoosing] = useState(false);
  const [preset, setPreset] = useState<Preset | null>("rec");
  const pick = (p: Preset) => {
    const red = dots.filter((d) => d.mark === "r").map((d) => d.id);
    if (p === "red") return new Set(red);
    if (p === "all") return new Set(dots.map((d) => d.id));
    // Recommended: what's red, then half-known, then new, up to 12.
    const order: Mark[] = ["r", "p", "n"];
    return new Set(order.flatMap((m) => dots.filter((d) => d.mark === m).map((d) => d.id)).slice(0, 12));
  };
  const [sel, setSel] = useState<Set<string>>(() => pick("rec"));
  const marks = dots.map((d) => d.mark);
  const pct = marks.length ? marks.filter((m) => m === "k").length / marks.length : 0;
  const red = marks.filter((m) => m === "r").length;
  const R = S / 2 - 8;
  const pts = useMemo(() => sunflower(dots.length, R - 40), [dots.length, R]);
  const dr = dots.length > 80 ? 5 : 8;

  const toggle = (id: string) =>
    setSel((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      setPreset(null);
      return n;
    });

  return (
    <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      <svg viewBox={`0 0 ${S} ${S}`} className="mx-auto block w-full max-w-[640px] select-none" role="img" aria-label={t("Mapa de conceptos")}>
        <circle cx={S / 2} cy={S / 2} r={R} fill="var(--color-callout)" />
        <Ring cx={S / 2} cy={S / 2} r={R} pct={pct} width={6} />
        {dots.map((d, i) => {
          const [x0, y0] = pts[i];
          const x = S / 2 + x0;
          const y = S / 2 + y0;
          const on = choosing && sel.has(d.id);
          const label = (choosing ? on && d.mark === "r" : d.mark === "r") && (
            <text x={x} y={y + dr + 14} textAnchor="middle" fontSize={11.5} fontWeight={600} className="pointer-events-none fill-ink" style={{ paintOrder: "stroke", stroke: "var(--background)", strokeWidth: 4 }}>
              {d.title.length > 22 ? `${d.title.slice(0, 21)}…` : d.title}
            </text>
          );
          const body = (
            <g className={`cursor-pointer transition-opacity ${choosing && !on ? "opacity-40 hover:opacity-70" : "hover:opacity-80"}`}>
              <title>{d.title}</title>
              {on && <circle cx={x} cy={y} r={dr + 7} fill="#2383e2" opacity={0.14} />}
              <Dot mark={d.mark} x={x} y={y} r={dr} />
              {label}
            </g>
          );
          return choosing ? (
            <g key={d.id} onClick={() => toggle(d.id)}>
              {body}
            </g>
          ) : (
            <Link key={d.id} href={d.href}>
              {body}
            </Link>
          );
        })}
      </svg>

      {choosing ? (
        <div className="flex flex-col items-start gap-6">
          <div>
            <div className="text-sm text-ink-faint">{title}</div>
            <h1 className="text-3xl font-extrabold tracking-tight">{t("Elegir conceptos")}</h1>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ["rec", t("Recomendado")],
                ["red", t("Solo rojos")],
                ["all", t("Todo")],
              ] as [Preset, string][]
            ).map(([p, label]) => (
              <button
                key={p}
                type="button"
                onClick={() => {
                  setPreset(p);
                  setSel(pick(p));
                }}
                className={`rounded-full px-3.5 py-1.5 text-[13px] font-bold ${preset === p ? "bg-ink text-white" : "bg-chip text-ink hover:bg-hover"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <div>
            <div className="text-5xl leading-none font-extrabold tabular-nums">{sel.size}</div>
            <div className="mt-1 text-ink-muted">{t("conceptos")}</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={sel.size === 0}
              onClick={() => router.push(`/review?concepts=${[...sel].join(",")}&back=${encodeURIComponent(back)}`)}
              className="rounded-full bg-accent px-6 py-3 font-bold text-white shadow-[0_4px_12px_rgba(35,131,226,.3)] hover:brightness-95 disabled:opacity-40"
            >
              ▶ {t("Empezar")}
            </button>
            <button type="button" onClick={() => setChoosing(false)} className="rounded-full px-4 py-3 font-bold text-ink-muted hover:bg-chip hover:text-ink">
              {t("Cancelar")}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-start gap-6">
          <div>
            <div className="text-sm text-ink-faint">{subject}</div>
            <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
          </div>
          <div className="flex items-center gap-4">
            <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden>
              <Ring cx={28} cy={28} r={23} pct={pct} width={6} />
              <text x={28} y={33} textAnchor="middle" fontSize={13} fontWeight={800} className="fill-ink">
                {Math.round(pct * 100)}%
              </text>
            </svg>
            {red > 0 && <span className="font-bold text-[#e16259]">{t("{0} para repasar", { 0: red })}</span>}
          </div>
          <div className="flex flex-col items-start gap-2.5">
            <Link href={`/review?${scope}&practice=1`} className="rounded-full bg-accent px-6 py-3 font-bold text-white shadow-[0_4px_12px_rgba(35,131,226,.3)] hover:brightness-95">
              ▶ {t("Quiz rápido")}
            </Link>
            <button type="button" onClick={() => setChoosing(true)} className="rounded-full bg-chip px-6 py-3 font-bold text-ink hover:bg-hover">
              {t("Elegir conceptos")}
            </button>
            <Link href={finalHref} className="rounded-full px-6 py-2 font-bold text-ink-muted hover:bg-chip hover:text-ink">
              {t("Test final")}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
