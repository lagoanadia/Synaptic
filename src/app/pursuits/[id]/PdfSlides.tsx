"use client";

import { useT } from "@/app/LangProvider";
import { ChevronLeft, ChevronRight } from "@/app/icons";
import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { SEGMENT_LABEL, classifySelection, segmentsToDoc, toSegments, type Kind, type SelectionInfo } from "@/lib/pdfSelection";

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
// Selecting text on the page offers "Añadir a la página": it's pasted as it
// looks in the PDF (titles, lists, tables, paragraphs — lib/pdfSelection),
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
  const [page, setPage] = useState(1);
  // 1 = fit the width; up to 4×.
  const [zoom, setZoom] = useState(1);
  const [error, setError] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const textLayer = useRef<HTMLDivElement>(null);
  const holder = useRef<HTMLDivElement>(null);
  const [pick, setPick] = useState<{ x: number; y: number; text: string; info: SelectionInfo; kind: Kind } | null>(null);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
        const d = await pdfjs.getDocument(src).promise;
        if (!cancelled) setDoc(d);
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

  // A text selection inside the page → the button, and the lines it covers.
  useEffect(() => {
    if (!onAddText) return;
    const check = () => {
      const s = window.getSelection();
      const layer = textLayer.current;
      if (!s || s.isCollapsed || !layer || !layer.contains(s.anchorNode) || !layer.contains(s.focusNode)) return setPick(null);
      const info = classifySelection(layer, s);
      if (!info) return setPick(null);
      const text = s.toString();
      const r = s.getRangeAt(0).getBoundingClientRect();
      const h = holder.current!.getBoundingClientRect();
      setAdded(false);
      // The same selection keeps the kind picked for it.
      setPick((cur) => ({ x: Math.max(4, r.left - h.left), y: Math.min(r.bottom - h.top + 6, h.height - 34), text, info, kind: cur?.text === text ? cur.kind : "auto" }));
    };
    document.addEventListener("mouseup", check);
    document.addEventListener("keyup", check);
    document.addEventListener("touchend", check);
    return () => {
      document.removeEventListener("mouseup", check);
      document.removeEventListener("keyup", check);
      document.removeEventListener("touchend", check);
    };
  }, [onAddText]);

  function addText() {
    if (!onAddText || !pick || added) return;
    onAddText(segmentsToDoc(toSegments(pick.info, pick.kind)));
    setAdded(true);
    window.getSelection()?.removeAllRanges();
    setTimeout(() => setPick(null), 900);
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
    setPick(null);
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
