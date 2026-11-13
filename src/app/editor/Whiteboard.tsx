"use client";

import { useT } from "@/app/LangProvider";
import { useEffect, useRef, useState } from "react";
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";
import Image from "@tiptap/extension-image";
import { BOARD_COLORS, BOARD_H, BOARD_SRC, BOARD_W, attachTarget, bendFor, hitShape, lineGeometry, lineMiddle, moveShape, newShapeId, resizeShape, shapeBox, shapeSvg, tooSmall, type Arrow, type LineShape, type Shape } from "@/lib/whiteboard";
import { saveBoard } from "@/app/pursuits/[id]/boards";

type Tool = "select" | "pen" | "line" | "arrow" | "rect" | "ellipse" | "text";
const S = (d: string) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {d.split("|").map((x) => (
      <path key={x} d={x} />
    ))}
  </svg>
);
const TOOLS: { id: Tool; label: string; icon: React.ReactNode }[] = [
  { id: "select", label: "Seleccionar", icon: S("M5 3l14 8-6 2-2 6z") },
  { id: "pen", label: "Lápiz", icon: S("M4 20l4-1 11-11-3-3L5 16z|M14 6l3 3") },
  { id: "line", label: "Línea", icon: S("M5 19 19 5") },
  { id: "arrow", label: "Flecha", icon: S("M5 19 19 5|M11 5h8v8") },
  { id: "rect", label: "Rectángulo", icon: S("M5 6h14v12H5z") },
  { id: "ellipse", label: "Círculo", icon: S("M12 5c4.4 0 8 3.1 8 7s-3.6 7-8 7-8-3.1-8-7 3.6-7 8-7Z") },
  { id: "text", label: "Texto", icon: S("M5 6V4h14v2|M12 4v16|M9 20h6") },
];

// A whiteboard inside a page: draw with pen, line, rectangle, circle or
// text in four colours; saves itself a moment after each change.
function Board({ id }: { id: string }) {
  const t = useT();
  const [shapes, setShapes] = useState<Shape[] | null>(null);
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState(0);
  const [draft, setDraft] = useState<Shape | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  // Select tool: the chosen shape, and what a drag on it does.
  const [selected, setSelected] = useState<number | null>(null);
  const [moving, setMoving] = useState<{ kind: "move" | "resize" | "endA" | "endB" | "bend"; from: [number, number]; orig: Shape; live: Shape } | null>(null);
  // A line end over a shape it would stick to (highlighted while drawing).
  const [snap, setSnap] = useState<number | null>(null);
  // Typing on the board, Canva-style: a box right where you clicked.
  // `edit` = index of the text being changed (it's hidden meanwhile).
  const [typing, setTypingState] = useState<{ x: number; y: number; value: string; c: number; edit: number | null; k: number } | null>(null);
  // Mirrors `typing` so a click outside and the box's blur save it only once.
  const typingRef = useRef(typing);
  const setTyping = (v: typeof typing) => {
    typingRef.current = v;
    setTypingState(v);
  };
  const saveTimer = useRef<number | null>(null);

  useEffect(() => {
    fetch(`/api/boards/${id}?json=1`)
      .then((r) => (r.ok ? r.json() : []))
      .then((s: Shape[]) => setShapes(s))
      .catch(() => setShapes([]));
  }, [id]);

  // A line end dropped on a box/circle/text sticks to it (the shape gets an id).
  const stick = (list: Shape[], line: LineShape, end: "a" | "b", p: [number, number]): { list: Shape[]; line: LineShape } => {
    const key = end === "a" ? "fa" : "fb";
    const other = end === "a" ? line.fb : line.fa;
    const i = attachTarget(list, p);
    const target = i >= 0 ? list[i] : null;
    const { [key]: _old, ...rest } = line;
    void _old;
    if (!target || target.t === "line" || target.t === "pen") return { list, line: rest };
    let id = "id" in target ? target.id : undefined;
    if (id && id === other) return { list, line: rest };
    if (!id) {
      id = newShapeId();
      list = list.map((sh, j) => (j === i ? ({ ...sh, id } as Shape) : sh));
    }
    return { list, line: { ...rest, [key]: id } };
  };

  const commit = (next: Shape[]) => {
    setShapes(next);
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => saveBoard(id, next), 600);
  };
  const at = (e: React.PointerEvent): [number, number] => {
    const r = svg.current!.getBoundingClientRect();
    return [Math.round(((e.clientX - r.left) / r.width) * BOARD_W), Math.round(((e.clientY - r.top) / r.height) * BOARD_H)];
  };

  const finishTyping = () => {
    const typing = typingRef.current;
    if (!typing || !shapes) return;
    typingRef.current = null;
    const value = typing.value.trim().slice(0, 120);
    const rest = typing.edit === null ? shapes : shapes.filter((_, i) => i !== typing.edit);
    const at = typing.edit === null ? rest.length : typing.edit;
    const next = value ? [...rest.slice(0, at), { t: "text" as const, c: typing.c, a: [typing.x, typing.y] as [number, number], s: value }, ...rest.slice(at)] : rest;
    setTyping(null);
    if (value || typing.edit !== null) commit(next);
  };

  if (!shapes) return <div className="h-40 animate-pulse rounded-xl bg-chip" />;
  const visible = typing?.edit != null ? shapes.filter((_, i) => i !== typing.edit) : shapes;
  const shown = moving && selected !== null ? visible.map((sh, i) => (i === selected ? moving.live : sh)) : visible;
  const all = draft ? [...shown, draft] : shown;
  const sel = selected !== null ? shown[selected] : undefined;
  const box = sel ? shapeBox(sel, shown) : null;
  const geo = sel?.t === "line" ? lineGeometry(sel, shown) : null;
  const middle = sel?.t === "line" ? lineMiddle(sel, shown) : null;
  const snapBox = snap !== null && shapes[snap] ? shapeBox(shapes[snap]) : null;
  const pct = (v: number, of: number) => `${(v / of) * 100}%`;

  return (
    <div className="relative my-2 overflow-hidden rounded-xl border border-border-subtle bg-white" contentEditable={false} data-board>
      <div className="absolute top-2 left-2 z-10 flex flex-col items-center gap-1 rounded-xl border border-border-subtle bg-white p-1.5 shadow-sm" data-no-print>
        {TOOLS.map((item) => (
          <button key={item.id} type="button" title={t(item.label)} aria-label={t(item.label)} aria-pressed={tool === item.id} onClick={() => {
              setTool(item.id);
              if (item.id !== "select") setSelected(null);
            }} className={`grid size-8 place-items-center rounded-lg ${tool === item.id ? "bg-chip text-ink" : "text-ink-muted hover:text-ink"}`}>
            {item.icon}
          </button>
        ))}
        <span className="my-1 h-px w-5 bg-border-subtle" />
        {BOARD_COLORS.map((c, i) => (
          <button key={c} type="button" aria-label={t("Color {0}", { 0: i + 1 })} aria-pressed={color === i} onClick={() => {
              setColor(i);
              if (selected !== null && shapes[selected]) commit(shapes.map((sh, j) => (j === selected ? { ...sh, c: i } : sh)));
            }} className={`m-0.5 size-4 rounded-full ${color === i ? "ring-2 ring-ink ring-offset-2" : ""}`} style={{ background: c }} />
        ))}
        <span className="my-1 h-px w-5 bg-border-subtle" />
        <button type="button" title={t("Deshacer")} aria-label={t("Deshacer")} disabled={!shapes.length} onClick={() => commit(shapes.slice(0, -1))} className="grid size-8 place-items-center rounded-lg text-ink-muted hover:text-ink disabled:opacity-30">
          {S("M9 14 4 9l5-5|M4 9h10a6 6 0 0 1 0 12h-3")}
        </button>
      </div>
      <svg
        ref={svg}
        viewBox={`0 0 ${BOARD_W} ${BOARD_H}`}
        className="block w-full touch-none select-none"
        style={{ aspectRatio: `${BOARD_W}/${BOARD_H}`, backgroundImage: "radial-gradient(#dcdad5 1px, transparent 1px)", backgroundSize: "18px 18px", cursor: tool === "text" ? "text" : tool === "select" ? (moving ? "grabbing" : "default") : "crosshair" }}
        onPointerDown={(e) => {
          const p = at(e);
          if (tool === "select") {
            // On the corner handle: resize. On a shape: pick it and move it.
            const cur = selected !== null ? shapes[selected] : null;
            if (cur?.t === "line") {
              const g = lineGeometry(cur, shapes);
              const m = lineMiddle(cur, shapes);
              const near = (q: [number, number]) => Math.hypot(p[0] - q[0], p[1] - q[1]) <= 12;
              const kind = near(m) ? "bend" : near(g.B) ? "endB" : near(g.A) ? "endA" : null;
              if (kind) {
                (e.target as Element).setPointerCapture?.(e.pointerId);
                return setMoving({ kind, from: p, orig: cur, live: cur });
              }
            }
            if (cur && cur.t !== "line") {
              const b = shapeBox(cur);
              if (cur.t !== "text" && Math.hypot(p[0] - b.x1, p[1] - b.y1) <= 14) {
                (e.target as Element).setPointerCapture?.(e.pointerId);
                return setMoving({ kind: "resize", from: p, orig: cur, live: cur });
              }
            }
            const hit = hitShape(shapes, p);
            setSelected(hit >= 0 ? hit : null);
            if (hit >= 0) {
              (e.target as Element).setPointerCapture?.(e.pointerId);
              setMoving({ kind: "move", from: p, orig: shapes[hit], live: shapes[hit] });
            }
            return;
          }
          if (tool === "text") {
            e.preventDefault();
            if (typingRef.current) return finishTyping();
            const k = svg.current!.getBoundingClientRect().width / BOARD_W;
            // On an existing text: edit it. Elsewhere: a new one.
            const hit = shapes.findIndex((sh) => sh.t === "text" && p[0] >= sh.a[0] - 6 && p[0] <= sh.a[0] + sh.s.length * 11 + 6 && p[1] >= sh.a[1] - 22 && p[1] <= sh.a[1] + 6);
            const old = hit >= 0 ? shapes[hit] : null;
            if (old && old.t === "text") setTyping({ x: old.a[0], y: old.a[1], value: old.s, c: old.c, edit: hit, k });
            else setTyping({ x: p[0], y: p[1] + 7, value: "", c: color, edit: null, k });
            return;
          }
          (e.target as Element).setPointerCapture?.(e.pointerId);
          setDraft(tool === "pen" ? { t: "pen", c: color, p: [p] } : tool === "line" || tool === "arrow" ? { t: "line", c: color, a: p, b: p, ...(tool === "arrow" ? { arrow: "end" as const } : {}) } : { t: tool, c: color, a: p, b: p });
        }}
        onPointerMove={(e) => {
          if (moving) {
            const p = at(e);
            const o = moving.orig;
            let live: Shape = o;
            if (moving.kind === "move") live = moveShape(o, p[0] - moving.from[0], p[1] - moving.from[1]);
            else if (moving.kind === "resize") live = resizeShape(o, p);
            else if (o.t === "line" && moving.kind === "bend") live = { ...o, bend: bendFor(o, shapes, p) };
            else if (o.t === "line") {
              const { fa, fb, ...free } = o;
              live = moving.kind === "endA" ? { ...free, ...(fb ? { fb } : {}), a: p } : { ...free, ...(fa ? { fa } : {}), b: p };
            }
            if (moving.kind === "endA" || moving.kind === "endB") setSnap(attachTarget(shapes, p) >= 0 ? attachTarget(shapes, p) : null);
            return setMoving({ ...moving, live });
          }
          if (!draft) return;
          const p = at(e);
          if (draft.t === "line") setSnap(attachTarget(shapes, p) >= 0 ? attachTarget(shapes, p) : null);
          setDraft(draft.t === "pen" ? { ...draft, p: [...draft.p, p] } : draft.t === "text" ? draft : { ...draft, b: p });
        }}
        onPointerUp={() => {
          setSnap(null);
          if (moving && selected !== null) {
            let list = shapes;
            let live = moving.live;
            if (live.t === "line" && (moving.kind === "endA" || moving.kind === "endB")) {
              const end = moving.kind === "endA" ? "a" : "b";
              const r = stick(list, live, end, live[end]);
              list = r.list;
              live = r.line;
            }
            if (live !== moving.orig) commit(list.map((sh, i) => (i === selected ? live : sh)));
            setMoving(null);
            return;
          }
          if (draft && !tooSmall(draft)) {
            if (draft.t === "line") {
              let r = stick(shapes, draft, "a", draft.a);
              r = stick(r.list, r.line, "b", draft.b);
              if (!tooSmall(r.line) || r.line.fa || r.line.fb) commit([...r.list, r.line]);
            } else commit([...shapes, draft]);
          }
          setDraft(null);
        }}
        dangerouslySetInnerHTML={{ __html: all.map((sh) => shapeSvg(sh, all)).join("") }}
      />
      {snapBox && (
        <span
          className="pointer-events-none absolute rounded-md bg-[#2383e2]/10 ring-2 ring-[#2383e2]"
          style={{ left: pct(snapBox.x0 - 6, BOARD_W), top: pct(snapBox.y0 - 6, BOARD_H), width: pct(snapBox.x1 - snapBox.x0 + 12, BOARD_W), height: pct(snapBox.y1 - snapBox.y0 + 12, BOARD_H) }}
        />
      )}
      {box && !draft && (
        <>
          <span
            className={`pointer-events-none absolute rounded-sm border-[1.5px] border-dashed border-[#2383e2] ${sel?.t === "line" ? "hidden" : ""}`}
            style={{ left: pct(box.x0 - 6, BOARD_W), top: pct(box.y0 - 6, BOARD_H), width: pct(box.x1 - box.x0 + 12, BOARD_W), height: pct(box.y1 - box.y0 + 12, BOARD_H) }}
          />
          {geo && middle && (
            <>
              {[geo.A, geo.B].map((q, i) => (
                <span key={i} className="pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#2383e2] bg-white" style={{ left: pct(q[0], BOARD_W), top: pct(q[1], BOARD_H) }} />
              ))}
              <span className="pointer-events-none absolute size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[#2383e2] shadow" style={{ left: pct(middle[0], BOARD_W), top: pct(middle[1], BOARD_H) }} title={t("Arrastra para curvar")} />
            </>
          )}
          {sel?.t !== "text" && sel?.t !== "line" && <span className="pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-sm border-2 border-[#2383e2] bg-white" style={{ left: pct(box.x1, BOARD_W), top: pct(box.y1, BOARD_H) }} />}
          {!moving && (
            <span className="absolute flex -translate-x-1/2 items-center gap-0.5 rounded-full border border-border-subtle bg-white p-0.5 shadow-sm" style={{ left: pct((box.x0 + box.x1) / 2, BOARD_W), top: `calc(${pct(box.y0 - 6, BOARD_H)} - 36px)` }}>
              {sel?.t === "line" &&
                ([
                  [undefined, t("Sin flecha"), "M4 12h16"],
                  ["end", t("Flecha al final"), "M4 12h15|M14 7l5 5-5 5"],
                  ["both", t("Flecha en los dos lados"), "M5 12h14|M10 7l-5 5 5 5|M14 7l5 5-5 5"],
                ] as [Arrow | undefined, string, string][]).map(([a, label, d]) => (
                  <button
                    key={label}
                    type="button"
                    title={label}
                    aria-label={label}
                    aria-pressed={sel.arrow === a}
                    onClick={() => {
                      const { arrow: _x, ...rest } = sel;
                      void _x;
                      commit(shapes.map((sh, i) => (i === selected ? { ...rest, ...(a ? { arrow: a } : {}) } : sh)));
                    }}
                    className={`grid size-7 place-items-center rounded-full ${sel.arrow === a ? "bg-chip text-ink" : "text-ink-muted hover:text-ink"}`}
                  >
                    {S(d)}
                  </button>
                ))}
            <button
              type="button"
              title={t("Eliminar")}
              aria-label={t("Eliminar")}
              onClick={() => {
                const gone = shapes[selected!];
                const goneId = gone && "id" in gone ? gone.id : undefined;
                commit(
                  shapes
                    .filter((_, i) => i !== selected)
                    .map((sh) => {
                      if (sh.t !== "line" || !goneId || (sh.fa !== goneId && sh.fb !== goneId)) return sh;
                      // Lines stuck to it stay where they were drawn, loose.
                      const g = lineGeometry(sh, shapes);
                      const { fa, fb, ...free } = sh;
                      return { ...free, ...(fa && fa !== goneId ? { fa } : {}), ...(fb && fb !== goneId ? { fb } : {}), a: [Math.round(g.A[0]), Math.round(g.A[1])] as [number, number], b: [Math.round(g.B[0]), Math.round(g.B[1])] as [number, number] };
                    }),
                );
                setSelected(null);
              }}
              className="grid size-7 place-items-center rounded-full text-ink-muted hover:text-red-600"
            >
              {S("M4 7h16|M10 11v6|M14 11v6|M6 7l1 13h10l1-13|M9 7V4h6v3")}
            </button>
            </span>
          )}
        </>
      )}
      {typing && (
        <input
          autoFocus
          value={typing.value}
          maxLength={120}
          placeholder={t("Escribe…")}
          onChange={(e) => setTyping({ ...typing, value: e.target.value })}
          onBlur={finishTyping}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") finishTyping();
            if (e.key === "Escape") {
              typingRef.current = null;
              setTypingState(null);
            }
          }}
          className="absolute z-20 rounded-sm bg-transparent p-0 outline-2 outline-offset-4 outline-[#2383e2] outline-dashed placeholder:text-ink-faint/60"
          style={{
            left: `${(typing.x / BOARD_W) * 100}%`,
            top: `${((typing.y - 20 * 0.82) / BOARD_H) * 100}%`,
            fontSize: 20 * typing.k,
            lineHeight: 1,
            fontFamily: "Inter, system-ui, sans-serif",
            color: BOARD_COLORS[typing.c],
            width: `${Math.max(4, typing.value.length + 2)}ch`,
            maxWidth: `${100 - (typing.x / BOARD_W) * 100}%`,
          }}
        />
      )}
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
