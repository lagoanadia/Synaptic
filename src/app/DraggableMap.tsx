"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { dotState, focusHeight, type MapCluster } from "@/lib/knowledgeMap";

type P = { x: number; y: number; vx: number; vy: number; pinned: boolean };

const W = 520;

// One unit's map you can move around (as in the first version): drag a
// dot, drag the background to pan, wheel to zoom, click a dot to open it.
// A small hand-rolled force simulation keeps dots apart and linked ones
// close. Dots: hollow = to learn, filled = known, faded = slipping.
export function DraggableMap({
  cluster,
  currentId,
  onAdd,
}: {
  cluster: MapCluster;
  currentId?: string;
  // The +: type a concept and the AI finds it in the notes. Returns an error.
  onAdd?: (text: string) => Promise<string | null>;
}) {
  const router = useRouter();
  const nodes = cluster.nodes;
  const H = focusHeight(nodes.length);
  const pos = useRef(new Map<string, P>());
  const alpha = useRef(1);
  const [snap, setSnap] = useState<Record<string, { x: number; y: number }>>({});
  const [hover, setHover] = useState<string | null>(null);
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const drag = useRef<{ id: string | null; startX: number; startY: number; moved: boolean; vx: number; vy: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [adding, setAdding] = useState<{ text: string; busy: boolean; error: string | null } | null>(null);
  // Read once (lazy initial state), so render stays pure.
  const [now] = useState(Date.now);

  const edges = useMemo(() => {
    const ids = new Set(nodes.map((n) => n.id));
    return nodes.filter((n) => n.parentId && ids.has(n.parentId)).map((n) => ({ from: n.parentId!, to: n.id }));
  }, [nodes]);

  // New dots start on a spiral (near their parent if it's placed) and the
  // simulation warms up again.
  useEffect(() => {
    const m = pos.current;
    nodes.forEach((n, i) => {
      if (m.has(n.id)) return;
      const parent = n.parentId ? m.get(n.parentId) : undefined;
      const a = i * 2.39996;
      const r = 30 + 14 * Math.sqrt(i);
      m.set(n.id, {
        x: parent ? parent.x + Math.cos(a) * 50 : W / 2 + Math.cos(a) * r * 1.3,
        y: parent ? parent.y + Math.sin(a) * 50 : H / 2 + Math.sin(a) * r,
        vx: 0,
        vy: 0,
        pinned: false,
      });
    });
    for (const id of [...m.keys()]) if (!nodes.some((n) => n.id === id)) m.delete(id);
    alpha.current = 1;
  }, [nodes, H]);

  useEffect(() => {
    let raf = 0;
    const step = () => {
      const m = pos.current;
      if (alpha.current > 0.02) {
        const list = [...m.entries()];
        const a = alpha.current;
        for (let i = 0; i < list.length; i++) {
          const p = list[i][1];
          for (let j = i + 1; j < list.length; j++) {
            const q = list[j][1];
            const dx = p.x - q.x || 0.01;
            const dy = p.y - q.y || 0.01;
            const d2 = Math.max(dx * dx + dy * dy, 100);
            const f = (2200 / d2) * a;
            const d = Math.sqrt(d2);
            p.vx += (dx / d) * f;
            p.vy += (dy / d) * f;
            q.vx -= (dx / d) * f;
            q.vy -= (dy / d) * f;
          }
        }
        for (const e of edges) {
          const p = m.get(e.from);
          const q = m.get(e.to);
          if (!p || !q) continue;
          const dx = q.x - p.x;
          const dy = q.y - p.y;
          const d = Math.sqrt(dx * dx + dy * dy) || 1;
          const f = ((d - 90) / d) * 0.05 * a;
          p.vx += dx * f;
          p.vy += dy * f;
          q.vx -= dx * f;
          q.vy -= dy * f;
        }
        for (const [, p] of list) {
          p.vx += (W / 2 - p.x) * 0.005 * a;
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
        setSnap(Object.fromEntries(list.map(([id, p]) => [id, { x: p.x, y: p.y }])));
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [edges, H]);

  function toGraph(e: React.PointerEvent | React.WheelEvent) {
    const r = svgRef.current!.getBoundingClientRect();
    const sx = ((e.clientX - r.left) / r.width) * W;
    const sy = ((e.clientY - r.top) / r.height) * H;
    return { x: (sx - view.x) / view.k, y: (sy - view.y) / view.k, sx, sy };
  }

  function down(e: React.PointerEvent, id: string | null) {
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    const g = toGraph(e);
    drag.current = { id, startX: g.sx, startY: g.sy, moved: false, vx: view.x, vy: view.y };
    if (id) pos.current.get(id)!.pinned = true;
  }

  function move(e: React.PointerEvent) {
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

  function up() {
    const d = drag.current;
    drag.current = null;
    if (!d?.id) return;
    pos.current.get(d.id)!.pinned = false;
    if (!d.moved) {
      const n = nodes.find((x) => x.id === d.id);
      if (n) router.push(n.href);
    }
  }

  function wheel(e: React.WheelEvent) {
    const g = toGraph(e);
    setView((v) => {
      const k = Math.min(3, Math.max(0.4, v.k * (e.deltaY < 0 ? 1.12 : 1 / 1.12)));
      return { k, x: g.sx - ((g.sx - v.x) / v.k) * k, y: g.sy - ((g.sy - v.y) / v.k) * k };
    });
  }

  const color = cluster.color;
  const near = new Set<string>();
  if (hover) for (const e of edges) if (e.from === hover) near.add(e.to);
  else if (e.to === hover) near.add(e.from);

  return (
    <div className="relative overflow-hidden rounded-lg border border-[#f1f1ef] bg-[#fbfbfa]">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full cursor-grab touch-none select-none active:cursor-grabbing"
        onPointerDown={(e) => down(e, null)}
        onPointerMove={move}
        onPointerUp={up}
        onWheel={wheel}
        role="img"
        aria-label="Mapa de conceptos"
      >
        <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
          {edges.map((e) => {
            const p = snap[e.from];
            const q = snap[e.to];
            if (!p || !q) return null;
            const lit = hover === e.from || hover === e.to;
            return <line key={`${e.from}-${e.to}`} x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke={lit ? color : "#d8d3c9"} strokeWidth={lit ? 1.6 : 1} />;
          })}
          {nodes.map((n) => {
            const p = snap[n.id];
            if (!p) return null;
            const state = dotState(n, now);
            const r = (n.parentId ? (n.depth > 1 ? 6 : 8) : 10) * (hover === n.id ? 1.3 : 1);
            const dim = hover && hover !== n.id && !near.has(n.id);
            const current = n.id === currentId;
            return (
              <g
                key={n.id}
                transform={`translate(${p.x} ${p.y})`}
                opacity={dim ? 0.35 : 1}
                onPointerDown={(e) => down(e, n.id)}
                onPointerEnter={() => setHover(n.id)}
                onPointerLeave={() => setHover(null)}
                className="cursor-pointer"
                role="link"
                aria-label={n.title}
              >
                {current && <circle r={r + 6} fill="none" stroke={color} strokeWidth={1.5} opacity={0.4} />}
                <circle r={r} fill={state === "todo" ? "#fff" : color} stroke={color} strokeWidth={1.7} opacity={state === "fading" ? 0.35 : 1} />
                <text y={r + 13} textAnchor="middle" fontSize={current ? 12.5 : 11} fontWeight={current ? 600 : 400} fill={current ? "#37352f" : "#787774"} style={{ pointerEvents: "none" }}>
                  {hover === n.id || n.title.length <= 22 ? n.title : `${n.title.slice(0, 21)}…`}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
      {onAdd &&
        (adding ? (
          <form
            className="absolute top-2 left-2 flex flex-col gap-1"
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
              placeholder="Concepto…"
              aria-label="Nuevo concepto"
              className={`w-56 rounded-md bg-white px-2.5 py-1.5 text-sm shadow-sm outline-none ring-1 ring-border-subtle focus:ring-ink/30 ${adding.busy ? "animate-pulse" : ""}`}
            />
            {adding.error && <span className="max-w-56 text-xs text-red-500">{adding.error}</span>}
          </form>
        ) : (
          <button type="button" onClick={() => setAdding({ text: "", busy: false, error: null })} title="Añadir concepto" aria-label="Añadir concepto" className="absolute top-2 left-2 grid size-8 place-items-center rounded-md bg-white text-lg text-ink-muted shadow-sm hover:text-ink">
            +
          </button>
        ))}
      {(view.k !== 1 || view.x !== 0 || view.y !== 0) && (
        <button type="button" onClick={() => setView({ x: 0, y: 0, k: 1 })} title="Centrar" aria-label="Centrar" className="absolute right-2 bottom-2 grid size-8 place-items-center rounded-md bg-white text-ink-muted shadow-sm hover:text-ink">
          ⌖
        </button>
      )}
    </div>
  );
}
