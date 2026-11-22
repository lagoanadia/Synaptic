"use client";

import { useT } from "@/app/LangProvider";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { calmLayout, type CalmGroup, type Mark } from "@/lib/calmMap";
import type { MapCluster } from "@/lib/knowledgeMap";

const BLUE = "#2383e2";
const RED = "#e16259";

// The unit's concept map: groups of dots that fill in blue as you learn them
// (half = seen, red = to review, empty = new), lines marked once both ends
// are known. Tap a group's name (or a chip above) to zoom into it — the rest
// fades and every name shows — and review just that unit from there.
export function CalmMap({
  cluster,
  currentId,
  onAdd,
  reviewHref,
}: {
  cluster: MapCluster;
  currentId?: string;
  onAdd?: (text: string) => Promise<string | null>;
  // Repasar for this unit (its cards and concepts).
  reviewHref: string;
}) {
  const t = useT();
  const router = useRouter();
  const [now] = useState(Date.now);
  const { groups, width, height } = useMemo(() => calmLayout(cluster.nodes, { now, looseTitle: t("Otros conceptos") }), [cluster.nodes, now, t]);
  const [focus, setFocus] = useState<string | null>(null);
  const [adding, setAdding] = useState<{ text: string; busy: boolean; error: string | null } | null>(null);
  const marks = useMemo(() => new Map(groups.flatMap((g) => g.dots.map((d) => [d.id, d.mark] as [string, Mark]))), [groups]);
  const toReview = groups.flatMap((g) => g.dots).filter((d) => d.mark === "r").length;

  // Zoom: fit the focused group in the picture.
  const g = groups.find((x) => x.id === focus);
  const z = g ? Math.min(2.4, width / (g.r * 2 + 60), height / (g.ry * 2 + 110)) : 1;
  const tx = g ? width / 2 - g.x * z : 0;
  const ty = g ? height / 2 - g.y * z + 10 : 0;
  const font = (px: number) => px / z;

  const named = (grp: CalmGroup, id: string, mark: Mark, main: boolean) => focus === grp.id || id === currentId || mark === "r" || main;

  return (
    <div className="relative overflow-hidden rounded-xl border border-border-subtle bg-[#fbfbfa] dark:bg-[#1c1c1c]">
      {/* Groups, as chips: tap to zoom in. */}
      <div className="relative z-10 flex flex-wrap gap-1.5 p-2.5 pr-12">
        <button type="button" onClick={() => setFocus(null)} className={`rounded-full px-3 py-1 text-xs font-bold ${focus === null ? "bg-ink text-white" : "bg-white text-ink shadow-[0_0_0_1px_var(--color-border-subtle)] hover:bg-hover dark:bg-[#262626]"}`}>
          {t("Todo")}
        </button>
        {groups.map((grp) => (
          <button
            key={grp.id}
            type="button"
            onClick={() => setFocus(focus === grp.id ? null : grp.id)}
            className={`max-w-40 truncate rounded-full px-3 py-1 text-xs font-bold ${focus === grp.id ? "bg-ink text-white" : "bg-white text-ink shadow-[0_0_0_1px_var(--color-border-subtle)] hover:bg-hover dark:bg-[#262626]"}`}
          >
            {grp.title}
          </button>
        ))}
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="block w-full select-none" role="img" aria-label={t("Mapa de conceptos")}>
        <defs>
          <linearGradient id="calm-half">
            <stop offset=".5" stopColor={BLUE} />
            <stop offset=".5" stopColor="#fff" />
          </linearGradient>
        </defs>
        <g style={{ transform: `translate(${tx}px, ${ty}px) scale(${z})`, transformOrigin: "0 0", transition: "transform .8s cubic-bezier(.22,.9,.24,1)" }}>
          {groups.map((grp) => {
            const known = grp.dots.filter((d) => d.mark === "k").length;
            const pct = known / grp.dots.length;
            const dim = focus !== null && focus !== grp.id;
            const at = new Map(grp.dots.map((d) => [d.id, d]));
            return (
              <g key={grp.id} style={{ opacity: dim ? 0.15 : 1, transition: "opacity .5s" }}>
                {/* Title with its progress ring: tap to zoom. */}
                <g transform={`translate(${grp.x}, ${grp.y - grp.ry - 6})`} className="cursor-pointer" onClick={() => setFocus(focus === grp.id ? null : grp.id)}>
                  {(() => {
                    // The name centred, its progress ring just to the left.
                    const half = ((grp.title.length + String(known).length + String(grp.dots.length).length + 2) * font(12.5) * 0.56) / 2;
                    const cx = -half - font(11);
                    const rr = font(6);
                    return (
                      <>
                        <circle cx={cx} cy={-font(4)} r={rr} fill="none" stroke="var(--color-border-subtle)" strokeWidth={font(2.4)} />
                        <circle cx={cx} cy={-font(4)} r={rr} fill="none" stroke={BLUE} strokeWidth={font(2.4)} strokeDasharray={`${2 * Math.PI * rr * pct} ${2 * Math.PI * rr}`} transform={`rotate(-90 ${cx} ${-font(4)})`} />
                        <text x={0} y={0} textAnchor="middle" fontSize={font(12.5)} fontWeight={800} className="fill-ink">
                          {grp.title} <tspan className="fill-ink-faint" fontWeight={600}>{known}/{grp.dots.length}</tspan>
                        </text>
                      </>
                    );
                  })()}
                </g>
                {grp.lines.map(([a, b]) => {
                  const A = at.get(a)!;
                  const B = at.get(b)!;
                  const on = marks.get(a) === "k" && marks.get(b) === "k";
                  return <line key={`${a}-${b}`} x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke={on ? BLUE : "var(--color-border-subtle)"} strokeWidth={on ? 2 : 1.3} strokeDasharray={on ? undefined : "3 4"} />;
                })}
                {grp.dots.map((d) => {
                  const cur = d.id === currentId;
                  const r = cur ? 11 : d.main ? 9 : 7;
                  const fill = d.mark === "k" || cur ? BLUE : d.mark === "p" ? "url(#calm-half)" : d.mark === "r" ? RED : "var(--background)";
                  const stroke = d.mark === "n" ? "#c9c7c1" : d.mark === "p" ? BLUE : "#fff";
                  return (
                    <g key={d.id} className="cursor-pointer" onClick={() => router.push(d.href)}>
                      <title>{d.title}</title>
                      {cur && (
                        <circle cx={d.x} cy={d.y} r={r + 6} fill="none" stroke={BLUE} strokeWidth={2} opacity={0.35}>
                          <animate attributeName="r" values={`${r + 4};${r + 9};${r + 4}`} dur="2.4s" repeatCount="indefinite" />
                        </circle>
                      )}
                      <circle cx={d.x} cy={d.y} r={r} fill={fill} stroke={stroke} strokeWidth={d.mark === "n" || d.mark === "p" ? 1.6 : 2} />
                      {(d.mark === "k" || cur) && <path d={`M${d.x - 3.5},${d.y} l2.5,2.6 l4.5,-5`} fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />}
                      {named(grp, d.id, d.mark, d.main) && (
                        <text x={Math.min(width - font(50), Math.max(font(50), d.x))} y={d.y + r + font(12)} textAnchor="middle" fontSize={font(cur ? 11.5 : 10.5)} fontWeight={cur ? 800 : 600} className={d.mark === "n" && !cur ? "fill-ink-faint" : "fill-ink"} style={{ paintOrder: "stroke", stroke: "var(--background)", strokeWidth: 3 / z, strokeLinejoin: "round" }}>
                          {(() => {
                            // Loose ones sit close together: shorter names until you zoom in.
                            const max = grp.loose && focus !== grp.id ? 15 : 26;
                            return d.title.length > max ? `${d.title.slice(0, max - 1)}…` : d.title;
                          })()}
                        </text>
                      )}
                    </g>
                  );
                })}
              </g>
            );
          })}
        </g>
      </svg>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 pt-1 pb-3 text-[11.5px] font-semibold text-ink-muted">
        <span className="flex items-center gap-1"><i className="size-2.5 rounded-full bg-[#2383e2]" />{t("Lo sabes")}</span>
        <span className="flex items-center gap-1"><i className="size-2.5 rounded-full shadow-[inset_0_0_0_1.5px_#2383e2]" style={{ background: "linear-gradient(90deg,#2383e2 50%,#fff 50%)" }} />{t("A medias")}</span>
        <span className="flex items-center gap-1"><i className="size-2.5 rounded-full bg-[#e16259]" />{t("Repasar")}</span>
        <span className="flex items-center gap-1"><i className="size-2.5 rounded-full bg-white shadow-[inset_0_0_0_1.5px_#c9c7c1]" />{t("Nuevo")}</span>
        <Link href={reviewHref} className={`ml-auto rounded-full px-3.5 py-1.5 text-xs font-bold text-white hover:brightness-95 ${toReview ? "bg-[#e16259]" : "bg-[#2383e2]"}`}>
          ▶ {toReview ? t("Repasar · {0} en rojo", { 0: toReview }) : t("Repasar este tema")}
        </Link>
      </div>

      {onAdd &&
        (adding ? (
          <form
            className="absolute top-2 right-2 z-20 flex flex-col items-end gap-1"
            onSubmit={async (e) => {
              e.preventDefault();
              const text = adding.text.trim();
              if (!text || adding.busy) return;
              setAdding({ ...adding, busy: true, error: null });
              const error = await onAdd(text);
              setAdding(error ? { text, busy: false, error } : null);
            }}
          >
            <input
              autoFocus
              value={adding.text}
              disabled={adding.busy}
              onChange={(e) => setAdding({ ...adding, text: e.target.value, error: null })}
              onKeyDown={(e) => e.key === "Escape" && setAdding(null)}
              onBlur={() => !adding.text.trim() && setAdding(null)}
              placeholder={t("Concepto…")}
              aria-label={t("Nuevo concepto")}
              className={`w-56 rounded-md bg-white px-2.5 py-1.5 text-sm shadow-sm ring-1 ring-border-subtle outline-none focus:ring-ink/30 ${adding.busy ? "animate-pulse" : ""}`}
            />
            {adding.error && <span className="max-w-56 text-xs text-red-500">{adding.error}</span>}
          </form>
        ) : (
          <button type="button" onClick={() => setAdding({ text: "", busy: false, error: null })} title={t("Añadir concepto")} aria-label={t("Añadir concepto")} className="absolute top-2.5 right-2.5 z-20 grid size-7 place-items-center rounded-md bg-white text-lg text-ink-muted shadow-sm hover:text-ink dark:bg-[#262626]">
            +
          </button>
        ))}
    </div>
  );
}
