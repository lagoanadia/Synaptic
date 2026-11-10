"use client";

import { useEffect, useRef, useState } from "react";
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";
import Image from "@tiptap/extension-image";
import { BOARD_COLORS, BOARD_H, BOARD_SRC, BOARD_W, shapeSvg, type Shape } from "@/lib/whiteboard";
import { saveBoard } from "@/app/pursuits/[id]/boards";

type Tool = "pen" | "line" | "rect" | "ellipse" | "text";
const S = (d: string) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {d.split("|").map((x) => (
      <path key={x} d={x} />
    ))}
  </svg>
);
const TOOLS: { id: Tool; label: string; icon: React.ReactNode }[] = [
  { id: "pen", label: "Lápiz", icon: S("M4 20l4-1 11-11-3-3L5 16z|M14 6l3 3") },
  { id: "line", label: "Línea", icon: S("M5 19 19 5") },
  { id: "rect", label: "Rectángulo", icon: S("M5 6h14v12H5z") },
  { id: "ellipse", label: "Círculo", icon: S("M12 5c4.4 0 8 3.1 8 7s-3.6 7-8 7-8-3.1-8-7 3.6-7 8-7Z") },
  { id: "text", label: "Texto", icon: S("M5 6V4h14v2|M12 4v16|M9 20h6") },
];

// A whiteboard inside a page: draw with pen, line, rectangle, circle or
// text in four colours; saves itself a moment after each change.
function Board({ id }: { id: string }) {
  const [shapes, setShapes] = useState<Shape[] | null>(null);
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState(0);
  const [draft, setDraft] = useState<Shape | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const saveTimer = useRef<number | null>(null);

  useEffect(() => {
    fetch(`/api/boards/${id}?json=1`)
      .then((r) => (r.ok ? r.json() : []))
      .then((s: Shape[]) => setShapes(s))
      .catch(() => setShapes([]));
  }, [id]);

  const commit = (next: Shape[]) => {
    setShapes(next);
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => saveBoard(id, next), 600);
  };
  const at = (e: React.PointerEvent): [number, number] => {
    const r = svg.current!.getBoundingClientRect();
    return [Math.round(((e.clientX - r.left) / r.width) * BOARD_W), Math.round(((e.clientY - r.top) / r.height) * BOARD_H)];
  };

  if (!shapes) return <div className="h-40 animate-pulse rounded-xl bg-chip" />;
  const all = draft ? [...shapes, draft] : shapes;

  return (
    <div className="relative my-2 overflow-hidden rounded-xl border border-border-subtle bg-white" contentEditable={false} data-board>
      <div className="absolute top-2 left-2 z-10 flex flex-col items-center gap-1 rounded-xl border border-border-subtle bg-white p-1.5 shadow-sm" data-no-print>
        {TOOLS.map((t) => (
          <button key={t.id} type="button" title={t.label} aria-label={t.label} aria-pressed={tool === t.id} onClick={() => setTool(t.id)} className={`grid size-8 place-items-center rounded-lg ${tool === t.id ? "bg-chip text-ink" : "text-ink-muted hover:text-ink"}`}>
            {t.icon}
          </button>
        ))}
        <span className="my-1 h-px w-5 bg-border-subtle" />
        {BOARD_COLORS.map((c, i) => (
          <button key={c} type="button" aria-label={`Color ${i + 1}`} aria-pressed={color === i} onClick={() => setColor(i)} className={`m-0.5 size-4 rounded-full ${color === i ? "ring-2 ring-ink ring-offset-2" : ""}`} style={{ background: c }} />
        ))}
        <span className="my-1 h-px w-5 bg-border-subtle" />
        <button type="button" title="Deshacer" aria-label="Deshacer" disabled={!shapes.length} onClick={() => commit(shapes.slice(0, -1))} className="grid size-8 place-items-center rounded-lg text-ink-muted hover:text-ink disabled:opacity-30">
          {S("M9 14 4 9l5-5|M4 9h10a6 6 0 0 1 0 12h-3")}
        </button>
      </div>
      <svg
        ref={svg}
        viewBox={`0 0 ${BOARD_W} ${BOARD_H}`}
        className="block w-full touch-none select-none"
        style={{ aspectRatio: `${BOARD_W}/${BOARD_H}`, backgroundImage: "radial-gradient(#dcdad5 1px, transparent 1px)", backgroundSize: "18px 18px", cursor: tool === "text" ? "text" : "crosshair" }}
        onPointerDown={(e) => {
          const p = at(e);
          if (tool === "text") {
            const s = window.prompt("Texto");
            if (s?.trim()) commit([...shapes, { t: "text", c: color, a: p, s: s.trim().slice(0, 120) }]);
            return;
          }
          (e.target as Element).setPointerCapture?.(e.pointerId);
          setDraft(tool === "pen" ? { t: "pen", c: color, p: [p] } : { t: tool, c: color, a: p, b: p });
        }}
        onPointerMove={(e) => {
          if (!draft) return;
          const p = at(e);
          setDraft(draft.t === "pen" ? { ...draft, p: [...draft.p, p] } : draft.t === "text" ? draft : { ...draft, b: p });
        }}
        onPointerUp={() => {
          if (draft) commit([...shapes, draft]);
          setDraft(null);
        }}
        dangerouslySetInnerHTML={{ __html: all.map(shapeSvg).join("") }}
      />
    </div>
  );
}

function ImageOrBoard({ node }: NodeViewProps) {
  const src = String(node.attrs.src ?? "");
  const m = BOARD_SRC.exec(src);
  return (
    <NodeViewWrapper>
      {m ? (
        <Board id={m[1]} />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="max-w-full rounded-md" />
      )}
    </NodeViewWrapper>
  );
}

// Images, where "/api/boards/<id>" ones are whiteboards you can draw on.
export const ImageWithBoards = Image.extend({
  addNodeView() {
    return ReactNodeViewRenderer(ImageOrBoard);
  },
});
