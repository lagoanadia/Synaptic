"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { focusHeight, layoutMap, type MapCluster, type PlacedNode } from "@/lib/knowledgeMap";

const WIDE_W = 1000;
const FOCUS_W = 520;

// The dots map. Hover shows the concept's name; click opens it in Aprender.
// `labels` writes every name (for a single small map), `currentId` rings
// the concept you're on.
export function KnowledgeMap({
  clusters,
  perRow,
  rowHeight,
  labels = false,
  currentId,
  empty,
  focus = false,
}: {
  clusters: MapCluster[];
  perRow?: number;
  rowHeight?: number;
  labels?: boolean;
  currentId?: string;
  empty?: React.ReactNode;
  // One unit drawn at real size (Aprender): dots fill the box, always labelled.
  focus?: boolean;
}) {
  const router = useRouter();
  const [hover, setHover] = useState<PlacedNode | null>(null);
  // Narrow screens: two clusters per row so the dots stay big enough.
  const box = useRef<HTMLDivElement>(null);
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setNarrow(e.contentRect.width < 560));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // Dots and lines scale up with the drawing so they stay readable.
  const k = narrow && !focus ? 2.2 : 1;
  const W = focus ? FOCUS_W : WIDE_W;
  const cols = focus ? 1 : narrow ? Math.min(perRow ?? 2, 2) : perRow;
  const rowH = focus ? focusHeight(clusters[0]?.nodes.length ?? 0) : narrow ? (rowHeight ?? 210) * 1.6 : rowHeight;
  const { clusters: placed, height } = useMemo(() => layoutMap(clusters, W, { perRow: cols, rowHeight: rowH, fill: focus }), [clusters, W, cols, rowH, focus]);

  if (clusters.every((c) => c.nodes.length === 0)) {
    return <div className="grid min-h-40 place-items-center rounded-lg bg-[#fbfbfa] p-6 text-sm text-ink-faint">{empty}</div>;
  }

  return (
    <div ref={box} className="relative rounded-lg border border-[#f1f1ef] bg-[#fbfbfa]">
      <svg viewBox={`0 0 ${W} ${height}`} className="block h-auto w-full" role="img" aria-label="Mapa de conceptos">
        {placed.map((c) => (
          <g key={c.id}>
            {c.links.map(([a, b]) => (
              <line key={`${a.id}-${b.id}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#d8d3c9" strokeWidth={k} />
            ))}
            {c.nodes.map((n) => (
              <g
                key={n.id}
                className="cursor-pointer"
                onMouseEnter={() => setHover(n)}
                onMouseLeave={() => setHover((h) => (h?.id === n.id ? null : h))}
                onClick={() => router.push(n.href)}
                role="link"
                aria-label={n.title}
              >
                <circle cx={n.x} cy={n.y} r={(n.r + 8) * k} fill="transparent" />
                {n.id === currentId && <circle cx={n.x} cy={n.y} r={(n.r + 6) * k} fill="none" stroke={c.color} strokeWidth={1.5 * k} opacity={0.4} />}
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={n.r * k * (hover?.id === n.id ? 1.4 : 1)}
                  style={{ transition: "r .12s" }}
                  fill={n.state === "todo" ? "#fff" : c.color}
                  stroke={c.color}
                  strokeWidth={1.7 * k}
                  opacity={n.state === "fading" ? 0.35 : 1}
                />
                {(labels || n.id === currentId) && (
                  <text x={n.x} y={n.y + n.r + 14} textAnchor="middle" fontSize={n.id === currentId ? 13 : 11} fontWeight={n.id === currentId ? 600 : 400} fill={n.id === currentId ? "#37352f" : "#787774"}>
                    {short(n.title, focus && n.id !== currentId ? 20 : 28)}
                  </text>
                )}
              </g>
            ))}
            {!labels && (
              <text x={c.x} y={c.y + ((rowHeight ?? 210) * (narrow ? 1.6 : 1)) / 2 - 8} textAnchor="middle" fontSize={narrow ? 22 : 12} fontWeight={600} fill={c.color}>
                {short(c.label, narrow ? 18 : 30)}
              </text>
            )}
          </g>
        ))}
      </svg>
      {hover && (!labels || hover.title.length > 20) && (
        <span
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-md bg-ink px-2 py-1 text-xs whitespace-nowrap text-white shadow"
          style={{ left: `${(hover.x / W) * 100}%`, top: `calc(${(hover.y / height) * 100}% - 10px)` }}
        >
          {hover.title}
        </span>
      )}
    </div>
  );
}

const short = (t: string, max: number) => (t.length > max ? `${t.slice(0, max - 1)}…` : t);
