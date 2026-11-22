"use client";

import { useT } from "@/app/LangProvider";
import { ChevronLeft, ChevronRight } from "@/app/icons";
import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { SEGMENT_LABEL, classifyArea, segmentsToDoc, toSegments, type Kind, type SelectionInfo } from "@/lib/pdfSelection";

// Where each PDF was left (page and zoom), so switching tabs or coming
// back later opens it there instead of on page 1. Kept for this visit and
// in the browser (best effort: private windows may not keep it).
const KEY = "synaptic:pdf-at:";
const leftAt = new Map<string, { page: number; zoom: number }>();
function readLeftAt(src: string): { page: number; zoom: number } {
  const mem = leftAt.get(src);
  if (mem) return mem;
  try {
    const v = JSON.parse(localStorage.getItem(KEY + src) ?? "null");
    if (v && Number.isInteger(v.page) && v.page >= 1 && typeof v.zoom === "number" && v.zoom >= 0.5 && v.zoom <= 4) return v;
  } catch {
    // no storage: start at the top
  }
  return { page: 1, zoom: 1 };
}
function saveLeftAt(src: string, at: { page: number; zoom: number }) {
  leftAt.set(src, at);
  try {
    localStorage.setItem(KEY + src, JSON.stringify(at));
  } catch {
    // no storage: kept for this visit only
  }
}

// How a selection can be pasted; "auto" is what was detected.
const KINDS: { id: Kind; label: string }[] = [
  { id: "auto", label: "Auto" },
  { id: "text", label: "Texto" },
  { id: "title", label: "Título" },
  { id: "list", label: "Lista" },
  { id: "table", label: "Tabla" },
];

type Box = { x0: number; y0: number; x1: number; y1: number };

// One PDF page at a time, fitted to the panel's width (zoom with − / +
// or Ctrl + wheel; scroll around when zoomed in), drawn sharp at the
// screen's pixel density. ← / → flip pages
// while the pointer is over it. With onTranscribe: "Seleccionar", drag a
// box over part of the slide (or take it whole) and send that image off
// to be written into the note.
// Dragging a box over the page takes the text inside it (the words light up
// as the box covers them) and offers "Añadir a la página": it's pasted as
// it looks in the PDF (titles, lists, tables, paragraphs — lib/pdfSelection),
// with a chip to paste it as another kind instead.
export function PdfSlides({
  src,
  onTranscribe,
  onAddText,
  onFail,
}: {
  src: string;
  onTranscribe?: (image: string, page: number) => Promise<string | null>;
  onAddText?: (blocks: ReturnType<typeof segmentsToDoc>) => void;
  onFail?: () => void;
}) {
  const t = useT();
  const [selecting, setSelecting] = useState(false);
  const [sel, setSel] = useState<Box | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const [cssH, setCssH] = useState(0);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(() => (typeof window === "undefined" ? 1 : readLeftAt(src).page));
  // 1 = fit the width; up to 4×.
  const [zoom, setZoom] = useState(() => (typeof window === "undefined" ? 1 : readLeftAt(src).zoom));
  useEffect(() => {
    saveLeftAt(src, { page, zoom });
  }, [src, page, zoom]);
  const [error, setError] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const textLayer = useRef<HTMLDivElement>(null);
  const holder = useRef<HTMLDivElement>(null);
  const [pick, setPick] = useState<{ x: number; y: number; info: SelectionInfo; kind: Kind } | null>(null);
  // The box being drawn over the text (CSS px inside the page) and the
  // words it covers, lit up while dragging.
  const [area, setArea] = useState<Box | null>(null);
  const [areaDrag, setAreaDrag] = useState(false);
  const [marks, setMarks] = useState<{ x: number; y: number; w: number; h: number }[]>([]);
  const words = useRef<{ x: number; y: number; w: number; h: number }[]>([]);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
        const d = await pdfjs.getDocument(src).promise;
        if (cancelled) return;
        setDoc(d);
        // A PDF that got shorter since: stay inside it.
        setPage((p) => Math.min(p, d.numPages));
      } catch {
        if (!cancelled) {
          setError(true);
          onFail?.();
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [src]);

  // Re-render when the panel is resized.
  useEffect(() => {
    if (!box.current) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(box.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!doc || !canvas.current || size.w === 0) return;
    let task: { cancel: () => void } | null = null;
    // This pass's text layer: cancelled if the page is redrawn before it's
    // done (otherwise two passes both fill it and the text comes out twice).
    let layerTask: { cancel: () => void } | null = null;
    let dead = false;
    (async () => {
      const p = await doc.getPage(page);
      if (dead) return;
      const base = p.getViewport({ scale: 1 });
      const dpr = Math.max(window.devicePixelRatio || 1, 2);
      // Fit the width (less a margin), times the zoom; keep the canvas under
      // ~24M pixels so big zooms don't run out of memory.
      const css = ((size.w - 24) / base.width) * zoom;
      const scale = Math.min(css * dpr, Math.sqrt(24e6 / (base.width * base.height)));
      const viewport = p.getViewport({ scale });
      const c = canvas.current!;
      c.width = viewport.width;
      c.height = viewport.height;
      c.style.width = `${base.width * css}px`;
      c.style.height = `${base.height * css}px`;
      setCssH(base.height * css);
      const r = p.render({ canvasContext: c.getContext("2d")!, viewport });
      task = r;
      // Invisible text on top, so it can be selected.
      const layer = textLayer.current;
      if (layer) {
        layer.replaceChildren();
        const view = p.getViewport({ scale: css });
        layer.style.setProperty("--scale-factor", String(view.scale));
        const pdfjs = await import("pdfjs-dist");
        if (dead) return;
        const tl = new pdfjs.TextLayer({ textContentSource: p.streamTextContent(), container: layer, viewport: view });
        layerTask = tl;
        tl.render().catch(() => {});
      }
      await r.promise.catch(() => {});
    })();
    return () => {
      dead = true;
      task?.cancel();
      try {
        layerTask?.cancel();
      } catch {
        // already finished
      }
    };
  }, [doc, page, size, zoom]);

  const clearArea = () => {
    setArea(null);
    setMarks([]);
    setPick(null);
  };
  const inBox = (b: Box) => {
    const [l, r, top, bottom] = [Math.min(b.x0, b.x1), Math.max(b.x0, b.x1), Math.min(b.y0, b.y1), Math.max(b.y0, b.y1)];
    const hit = words.current.filter((w) => w.x + w.w / 2 >= l && w.x + w.w / 2 <= r && w.y + w.h / 2 >= top && w.y + w.h / 2 <= bottom);
    // One smooth bar per run of words on a line, not a box per word.
    const bars: { x: number; y: number; w: number; h: number }[] = [];
    for (const w of [...hit].sort((a, b) => a.y - b.y || a.x - b.x)) {
      const bar = bars.find((b) => Math.abs(b.y + b.h / 2 - (w.y + w.h / 2)) < w.h / 2 && w.x - (b.x + b.w) < w.h);
      if (bar) {
        const right = Math.max(bar.x + bar.w, w.x + w.w);
        bar.y = Math.min(bar.y, w.y);
        bar.h = Math.max(bar.h, w.h);
        bar.w = right - bar.x;
      } else bars.push({ ...w });
    }
    return bars;
  };
  function areaDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const h = holder.current!.getBoundingClientRect();
    // Where every word is, once per drag (the page doesn't move meanwhile).
    words.current = [...(textLayer.current?.querySelectorAll<HTMLElement>("span") ?? [])]
      .filter((sp) => sp.textContent?.trim() && !sp.classList.contains("markedContent"))
      .map((sp) => {
        const r = sp.getBoundingClientRect();
        return { x: r.left - h.left, y: r.top - h.top, w: r.width, h: r.height };
      });
    const x = e.clientX - h.left;
    const y = e.clientY - h.top;
    setPick(null);
    setAdded(false);
    setMarks([]);
    setArea({ x0: x, y0: y, x1: x, y1: y });
    setAreaDrag(true);
  }
  function areaMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!areaDrag || !area) return;
    const h = holder.current!.getBoundingClientRect();
    const next = { ...area, x1: Math.min(Math.max(0, e.clientX - h.left), h.width), y1: Math.min(Math.max(0, e.clientY - h.top), h.height) };
    setArea(next);
    setMarks(inBox(next));
  }
  function areaUp() {
    if (!areaDrag || !area) return;
    setAreaDrag(false);
    const layer = textLayer.current;
    const h = holder.current!.getBoundingClientRect();
    const [l, r, top, bottom] = [Math.min(area.x0, area.x1), Math.max(area.x0, area.x1), Math.min(area.y0, area.y1), Math.max(area.y0, area.y1)];
    const info = layer && r - l > 6 && bottom - top > 6 ? classifyArea(layer, { left: h.left + l, right: h.left + r, top: h.top + top, bottom: h.top + bottom }) : null;
    if (!info) return clearArea();
    setPick({ x: Math.max(4, l), y: Math.min(bottom + 8, h.height - 34), info, kind: "auto" });
  }

  function addText() {
    if (!onAddText || !pick || added) return;
    onAddText(segmentsToDoc(toSegments(pick.info, pick.kind)));
    setAdded(true);
    setTimeout(clearArea, 900);
  }
  const kindLabel = (p: NonNullable<typeof pick>) =>
    p.kind === "auto"
      ? `Auto · ${[...new Set(p.info.segments.map((x) => t(SEGMENT_LABEL[x.type])))].slice(0, 4).join(" + ")}`
      : t(KINDS.find((k) => k.id === p.kind)!.label);

  // Ctrl/⌘ + wheel zooms (also a trackpad pinch, which arrives the same way).
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      setZoom((z) => Math.min(4, Math.max(0.5, z * (e.deltaY < 0 ? 1.1 : 1 / 1.1))));
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, []);
  const zoomBy = (f: number) => setZoom((z) => Math.min(4, Math.max(0.5, Math.round(z * f * 100) / 100)));

  const total = doc?.numPages ?? 0;
  const go = (d: number) => {
    setSel(null);
    clearArea();
    setPage((p) => Math.min(Math.max(1, p + d), total || 1));
  };

  // Mouse position inside the canvas, in CSS pixels.
  function at(e: React.PointerEvent) {
    const r = canvas.current!.getBoundingClientRect();
    return { x: Math.min(Math.max(0, e.clientX - r.left), r.width), y: Math.min(Math.max(0, e.clientY - r.top), r.height) };
  }

  // The box (or the whole slide) as a JPEG, at most 1600px wide.
  function crop(box: Box | null): string {
    const c = canvas.current!;
    const k = c.width / c.clientWidth;
    const [x, y, w, h] = box
      ? [Math.min(box.x0, box.x1) * k, Math.min(box.y0, box.y1) * k, Math.abs(box.x1 - box.x0) * k, Math.abs(box.y1 - box.y0) * k]
      : [0, 0, c.width, c.height];
    const out = document.createElement("canvas");
    const f = Math.min(1, 1600 / w);
    out.width = Math.round(w * f);
    out.height = Math.round(h * f);
    out.getContext("2d")!.drawImage(c, x, y, w, h, 0, 0, out.width, out.height);
    return out.toDataURL("image/jpeg", 0.85);
  }

  async function transcribe(box: Box | null) {
    if (!onTranscribe || busy) return;
    setBusy(true);
    setErr(null);
    const e = await onTranscribe(crop(box), page);
    setBusy(false);
    if (e) return setErr(e);
    setSel(null);
    setSelecting(false);
  }
  const big = sel && Math.abs(sel.x1 - sel.x0) > 12 && Math.abs(sel.y1 - sel.y0) > 12 ? sel : null;

  if (error) return <p className="p-4 text-sm text-ink-muted">{t("No he podido abrir ese PDF.")}</p>;

  return (
    <div
      className="relative flex h-full flex-col"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") go(1);
        if (e.key === "ArrowLeft") go(-1);
      }}
      aria-label={t("Diapositivas")}
    >
      <div ref={box} className="flex min-h-0 flex-1 overflow-auto bg-[#2a2a2a] p-3">
        {doc ? (
          <div ref={holder} className="relative m-auto">
            <canvas ref={canvas} className="block shadow-lg" />
            <div ref={textLayer} className="textLayer" />
            {onAddText && !selecting && (
              <div
                className="absolute inset-0 cursor-crosshair touch-none select-none"
                onPointerDown={areaDown}
                onPointerMove={areaMove}
                onPointerUp={areaUp}
                onPointerCancel={areaUp}
                onKeyDown={(e) => e.key === "Escape" && clearArea()}
              >
                {marks.map((m, k) => (
                  <span key={k} className="pointer-events-none absolute rounded-[3px] bg-[#2383e2]/20" style={{ left: m.x - 2, top: m.y - 1, width: m.w + 4, height: m.h + 2 }} />
                ))}
                {area && (
                  <span
                    className={`pointer-events-none absolute rounded-md border-[1.5px] border-[#2383e2] ${areaDrag ? "bg-[#2383e2]/[.06]" : "border-dashed bg-transparent"}`}
                    style={{ left: Math.min(area.x0, area.x1), top: Math.min(area.y0, area.y1), width: Math.abs(area.x1 - area.x0), height: Math.abs(area.y1 - area.y0) }}
                  />
                )}
                {!area && !pick && (
                  <span className="pointer-events-none absolute top-2 left-1/2 -translate-x-1/2 rounded-full bg-black/55 px-3 py-1 text-[11px] whitespace-nowrap text-white opacity-0 transition-opacity [div:hover>&]:opacity-100">
                    {t("Arrastra un recuadro sobre lo que quieras pasar")}
                  </span>
                )}
              </div>
            )}
            {pick && !selecting && (
              <span
                className="absolute z-10 flex items-center gap-1 rounded-lg bg-[#2383e2] p-0.5 text-xs font-semibold whitespace-nowrap text-white shadow-lg"
                style={{ left: pick.x, top: pick.y }}
                onMouseDown={(e) => e.preventDefault()}
              >
                {!added && (
                  <button
                    type="button"
                    onClick={() => setPick((p) => p && { ...p, kind: KINDS[(KINDS.findIndex((k) => k.id === p.kind) + 1) % KINDS.length].id })}
                    title={t("Cambiar cómo se pega (título, lista, tabla, texto)")}
                    className="rounded-md bg-white/15 px-2 py-1 hover:bg-white/25"
                  >
                    {kindLabel(pick)}
                  </button>
                )}
                <button type="button" onClick={addText} className="rounded-md px-2.5 py-1 hover:bg-white/10">
                  {added ? t("✓ Añadido") : t("+ Añadir a la página")}
                </button>
              </span>
            )}
            {selecting && (
              <div
                className="absolute inset-0 cursor-crosshair"
                onPointerDown={(e) => {
                  (e.target as Element).setPointerCapture(e.pointerId);
                  const p = at(e);
                  setDrag(p);
                  setSel({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
                }}
                onPointerMove={(e) => {
                  if (!drag) return;
                  const p = at(e);
                  setSel({ x0: drag.x, y0: drag.y, x1: p.x, y1: p.y });
                }}
                onPointerUp={() => setDrag(null)}
              >
                {!sel && <span className="pointer-events-none absolute top-2 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-[11px] whitespace-nowrap text-white">{t("Arrastra sobre lo que quieras copiar")}</span>}
                {sel && (
                  <span
                    className="pointer-events-none absolute rounded-sm border-2 border-[#2383e2] bg-[#2383e2]/10"
                    style={{ left: Math.min(sel.x0, sel.x1), top: Math.min(sel.y0, sel.y1), width: Math.abs(sel.x1 - sel.x0), height: Math.abs(sel.y1 - sel.y0) }}
                  />
                )}
                {big && !drag && (
                  <button
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => transcribe(big)}
                    disabled={busy}
                    className="absolute rounded-lg bg-[#2383e2] px-3 py-1.5 text-xs font-semibold text-white shadow-lg disabled:opacity-70"
                    style={{ left: Math.min(big.x0, big.x1), top: Math.min(Math.max(big.y0, big.y1) + 6, cssH - 30) }}
                  >
                    {busy ? t("Transcribiendo…") : t("Transcribir")}
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          <span className="text-sm text-white/60">{t("Cargando…")}</span>
        )}
      </div>
      {total > 0 && (
        <div className="flex items-center justify-center gap-3 bg-[#2a2a2a] pb-2 text-sm text-white">
          <button type="button" onClick={() => go(-1)} disabled={page === 1} className="rounded px-3 py-1 hover:bg-white/10 disabled:opacity-30" aria-label={t("Diapositiva anterior")}><ChevronLeft size={18} /></button>
          <span className="tabular-nums">{page} / {total}</span>
          <button type="button" onClick={() => go(1)} disabled={page === total} className="rounded px-3 py-1 hover:bg-white/10 disabled:opacity-30" aria-label={t("Diapositiva siguiente")}><ChevronRight size={18} /></button>
          <span className="ml-2 flex items-center gap-0.5 rounded-full bg-white/10 text-xs">
            <button type="button" onClick={() => zoomBy(1 / 1.25)} className="rounded-full px-2.5 py-1 hover:bg-white/15" aria-label={t("Alejar")}>−</button>
            <button type="button" onClick={() => setZoom(1)} className="min-w-12 tabular-nums hover:underline" title={t("Ajustar al ancho")}>{Math.round(zoom * 100)}%</button>
            <button type="button" onClick={() => zoomBy(1.25)} className="rounded-full px-2.5 py-1 hover:bg-white/15" aria-label={t("Acercar")}>+</button>
          </span>
          {onTranscribe && (
            <span className="ml-3 flex items-center gap-1 text-xs">
              <button
                type="button"
                onClick={() => {
                  setSelecting((v) => !v);
                  setSel(null);
                  setErr(null);
                }}
                aria-pressed={selecting}
                className={`rounded-full px-3 py-1 ${selecting ? "bg-[#2383e2] text-white" : "bg-white/10 hover:bg-white/20"}`}
              >
                {t("Seleccionar")}
              </button>
              {selecting && (
                <button type="button" onClick={() => transcribe(null)} disabled={busy} className="rounded-full bg-white/10 px-3 py-1 hover:bg-white/20 disabled:opacity-50">
                  {busy && !big ? t("Transcribiendo…") : t("Toda la diapositiva")}
                </button>
              )}
            </span>
          )}
        </div>
      )}
      {err && <p className="bg-[#2a2a2a] px-3 pb-2 text-center text-xs text-[#ff9b94]">{err}</p>}
    </div>
  );
}
