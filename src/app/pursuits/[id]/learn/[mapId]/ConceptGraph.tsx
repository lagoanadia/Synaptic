"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Status } from "@/lib/internalize";
import type { ExplorerConcept, ExplorerLink } from "./ConceptExplorer";

const FILL: Record<Status, string> = {
  NEW: "#ffffff",
  SEEN: "#b9b9b9",
  REREAD: "#eda100",
  UNDERSTOOD: "#3aa6ee",
  MASTERED: "#1d5fc4",
};

type P = { x: number; y: number; vx: number; vy: number; pinned: boolean };

const W = 1000;
const H = 460;

// Draggable map: color = how well you know it, pulsing ring = next up,
// hover = connections, "puntos débiles" fades what you know. Tiny hand-rolled
// force simulation (repel, springs, gravity).
export function ConceptGraph({
  concepts,
  links,
  currentId,
  nextUpId,
  weakOnly,
  onSelect,
}: {
  concepts: ExplorerConcept[];
  links: ExplorerLink[];
  currentId: string | null;
  nextUpId: string | null;
  weakOnly: boolean;
  onSelect: (id: string) => void;
}) {
  const pos = useRef(new Map<string, P>());
  const alpha = useRef(1);
  // What render reads: a copy of the positions, refreshed every frame
  // while the simulation is moving.
  const [snap, setSnap] = useState<Record<string, { x: number; y: number }>>({});
  const [hover, setHover] = useState<string | null>(null);
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const drag = useRef<{ id: string | null; startX: number; startY: number; moved: boolean; vx: number; vy: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const edges = useMemo(
    () => links.filter((l) => concepts.some((c) => c.id === l.fromId) && concepts.some((c) => c.id === l.toId)),
    [links, concepts],
  );
  const degree = useMemo(() => {
    const d = new Map<string, number>();
    for (const e of edges) {
      d.set(e.fromId, (d.get(e.fromId) ?? 0) + 1);
      d.set(e.toId, (d.get(e.toId) ?? 0) + 1);
    }
    return d;
  }, [edges]);

  // Place new nodes near their parent (or on a circle) and reheat.
  useEffect(() => {
    const m = pos.current;
    concepts.forEach((c, i) => {
      if (m.has(c.id)) return;
      const parent = c.parentId ? m.get(c.parentId) : undefined;
      const a = (i / Math.max(concepts.length, 1)) * Math.PI * 2;
      m.set(c.id, {
        x: parent ? parent.x + Math.cos(a) * 40 : W / 2 + Math.cos(a) * 180,
        y: parent ? parent.y + Math.sin(a) * 40 : H / 2 + Math.sin(a) * 140,
        vx: 0,
        vy: 0,
        pinned: false,
      });
    });
    for (const id of [...m.keys()]) if (!concepts.some((c) => c.id === id)) m.delete(id);
    alpha.current = 1;
  }, [concepts]);

  useEffect(() => {
    let raf = 0;
    const step = () => {
      const m = pos.current;
      if (alpha.current > 0.02) {
        const nodes = [...m.entries()];
        const a = alpha.current;
        for (let i = 0; i < nodes.length; i++) {
          const [, p] = nodes[i];
          for (let j = i + 1; j < nodes.length; j++) {
            const [, q] = nodes[j];
            const dx = p.x - q.x || 0.01;
            const dy = p.y - q.y || 0.01;
            const d2 = Math.max(dx * dx + dy * dy, 100);
            const f = (2600 / d2) * a;
            const d = Math.sqrt(d2);
            p.vx += (dx / d) * f;
            p.vy += (dy / d) * f;
            q.vx -= (dx / d) * f;
            q.vy -= (dy / d) * f;
          }
        }
        for (const e of edges) {
          const p = m.get(e.fromId);
          const q = m.get(e.toId);
          if (!p || !q) continue;
          const dx = q.x - p.x;
          const dy = q.y - p.y;
          const d = Math.sqrt(dx * dx + dy * dy) || 1;
          const rest = e.label === "part of" ? 60 : 110;
          const f = ((d - rest) / d) * 0.06 * a;
          p.vx += dx * f;
          p.vy += dy * f;
          q.vx -= dx * f;
          q.vy -= dy * f;
        }
        for (const [, p] of nodes) {
          p.vx += (W / 2 - p.x) * 0.004 * a;
          p.vy += (H / 2 - p.y) * 0.006 * a;
          if (p.pinned) {
            p.vx = 0;
            p.vy = 0;
            continue;
          }
          p.vx *= 0.82;
          p.vy *= 0.82;
          p.x += p.vx;
          p.y += p.vy;
        }
        alpha.current *= 0.985;
        setSnap(Object.fromEntries(nodes.map(([id, p]) => [id, { x: p.x, y: p.y }])));
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [edges]);

  function toGraph(e: React.PointerEvent | React.WheelEvent) {
    const r = svgRef.current!.getBoundingClientRect();
    const sx = ((e.clientX - r.left) / r.width) * W;
    const sy = ((e.clientY - r.top) / r.height) * H;
    return { x: (sx - view.x) / view.k, y: (sy - view.y) / view.k, sx, sy };
  }

  function onPointerDown(e: React.PointerEvent, id: string | null) {
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    const g = toGraph(e);
    drag.current = { id, startX: g.sx, startY: g.sy, moved: false, vx: view.x, vy: view.y };
    if (id) pos.current.get(id)!.pinned = true;
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const g = toGraph(e);
    if (Math.abs(g.sx - d.startX) + Math.abs(g.sy - d.startY) > 4) d.moved = true;
    if (d.id) {
      const p = pos.current.get(d.id)!;
      p.x = g.x;
      p.y = g.y;
      alpha.current = Math.max(alpha.current, 0.3);
    } else {
      setView((v) => ({ ...v, x: d.vx + (g.sx - d.startX), y: d.vy + (g.sy - d.startY) }));
    }
  }

  function onPointerUp() {
    const d = drag.current;
    drag.current = null;
    if (!d?.id) return;
    pos.current.get(d.id)!.pinned = false;
    if (!d.moved) onSelect(d.id);
  }

  function onWheel(e: React.WheelEvent) {
    const g = toGraph(e);
    setView((v) => {
      const k = Math.min(3, Math.max(0.35, v.k * (e.deltaY < 0 ? 1.12 : 1 / 1.12)));
      return { k, x: g.sx - ((g.sx - v.x) / v.k) * k, y: g.sy - ((g.sy - v.y) / v.k) * k };
    });
  }

  const neighbors = new Set<string>();
  if (hover) {
    for (const e of edges) {
      if (e.fromId === hover) neighbors.add(e.toId);
      if (e.toId === hover) neighbors.add(e.fromId);
    }
  }
  const solid = (s: Status) => s === "UNDERSTOOD" || s === "MASTERED";
  const faded = (c: ExplorerConcept) => (hover ? c.id !== hover && !neighbors.has(c.id) : weakOnly && solid(c.status));
  const hovered = hover ? concepts.find((c) => c.id === hover) : undefined;

  return (
    <div className="relative overflow-hidden rounded-3xl bg-white shadow-[0_1px_2px_rgba(13,13,13,0.06)]">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="h-[460px] w-full cursor-grab touch-none select-none active:cursor-grabbing"
        onPointerDown={(e) => onPointerDown(e, null)}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onWheel={onWheel}
        role="img"
        aria-label="Grafo del mapa de conceptos"
      >
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#9a9a9a" />
          </marker>
        </defs>
        <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
          {edges.map((e) => {
            const p = snap[e.fromId];
            const q = snap[e.toId];
            if (!p || !q) return null;
            const lit = hover && (e.fromId === hover || e.toId === hover);
            const r = 8 + Math.min(degree.get(e.toId) ?? 0, 6) * 1.5;
            const dx = q.x - p.x;
            const dy = q.y - p.y;
            const d = Math.sqrt(dx * dx + dy * dy) || 1;
            return (
              <line
                key={`${e.fromId}-${e.toId}`}
                x1={p.x}
                y1={p.y}
                x2={q.x - (dx / d) * (r + 3)}
                y2={q.y - (dy / d) * (r + 3)}
                stroke={lit ? "#2383e2" : "#cfcfcf"}
                strokeWidth={lit ? 2 : 1.2}
                strokeDasharray={e.label === "part of" ? "4 4" : undefined}
                markerEnd={e.label === "needs" ? "url(#arrow)" : undefined}
                opacity={hover && !lit ? 0.25 : 1}
              />
            );
          })}
          {concepts.map((c) => {
            const p = snap[c.id];
            if (!p) return null;
            const r = 8 + Math.min(degree.get(c.id) ?? 0, 6) * 1.5;
            const isNext = c.id === nextUpId;
            return (
              <g
                key={c.id}
                transform={`translate(${p.x} ${p.y})`}
                opacity={faded(c) ? 0.2 : 1}
                onPointerDown={(e) => onPointerDown(e, c.id)}
                onPointerEnter={() => setHover(c.id)}
                onPointerLeave={() => setHover(null)}
                className="cursor-pointer"
              >
                {isNext && (
                  <circle r={r + 7} fill="none" stroke="#2fb8c9" strokeWidth="2">
                    <animate attributeName="r" values={`${r + 4};${r + 10};${r + 4}`} dur="1.8s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="1;0.2;1" dur="1.8s" repeatCount="indefinite" />
                  </circle>
                )}
                <circle
                  r={r}
                  fill={FILL[c.status]}
                  stroke={c.id === currentId ? "#0d0d0d" : c.status === "NEW" ? "#9a9a9a" : "white"}
                  strokeWidth={c.id === currentId ? 3 : 1.5}
                />
                <text
                  y={r + 13}
                  textAnchor="middle"
                  fontSize={c.depth === 0 ? 12 : 10.5}
                  fontWeight={c.id === currentId ? 700 : 500}
                  fill="#3a3a3a"
                  style={{ pointerEvents: "none" }}
                >
                  {c.title.length > 26 ? `${c.title.slice(0, 25)}…` : c.title}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      {hovered && (
        <div className="pointer-events-none absolute top-3 left-3 max-w-xs rounded-2xl bg-ink px-3 py-2 text-xs text-white">
          <p className="font-bold">{hovered.title}</p>
          {hovered.summary && <p className="mt-0.5">{hovered.summary}</p>}
        </div>
      )}

      <div className="absolute right-3 bottom-3 flex flex-wrap items-center gap-3 rounded-full bg-white/90 px-3 py-1.5 text-[11px] text-ink-muted">
        {(["NEW", "SEEN", "REREAD", "UNDERSTOOD", "MASTERED"] as Status[]).map((s) => (
          <span key={s} className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full border border-ink-faint" style={{ background: FILL[s] }} />
            {s.charAt(0) + s.slice(1).toLowerCase()}
          </span>
        ))}
        <button type="button" onClick={() => setView({ x: 0, y: 0, k: 1 })} className="font-semibold text-ink hover:underline">
          Restablecer vista
        </button>
      </div>
    </div>
  );
}
