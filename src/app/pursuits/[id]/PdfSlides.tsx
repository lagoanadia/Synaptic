"use client";

import { ChevronLeft, ChevronRight } from "@/app/icons";
import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";

type Box = { x0: number; y0: number; x1: number; y1: number };

// One PDF page at a time, scaled to fit the panel. ← / → flip pages
// while the pointer is over it. With onTranscribe: "Seleccionar", drag a
// box over part of the slide (or take it whole) and send that image off
// to be written into the note.
export function PdfSlides({ src, onTranscribe }: { src: string; onTranscribe?: (image: string, page: number) => Promise<string | null> }) {
  const [selecting, setSelecting] = useState(false);
  const [sel, setSel] = useState<Box | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const [cssH, setCssH] = useState(0);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
        const d = await pdfjs.getDocument(src).promise;
        if (!cancelled) setDoc(d);
      } catch {
        if (!cancelled) setError(true);
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
    (async () => {
      const p = await doc.getPage(page);
      const base = p.getViewport({ scale: 1 });
      const scale = Math.min(size.w / base.width, (size.h - 8) / base.height) * (window.devicePixelRatio || 1);
      const viewport = p.getViewport({ scale });
      const c = canvas.current!;
      c.width = viewport.width;
      c.height = viewport.height;
      c.style.width = `${viewport.width / (window.devicePixelRatio || 1)}px`;
      c.style.height = `${viewport.height / (window.devicePixelRatio || 1)}px`;
      setCssH(viewport.height / (window.devicePixelRatio || 1));
      const r = p.render({ canvasContext: c.getContext("2d")!, viewport });
      task = r;
      await r.promise.catch(() => {});
    })();
    return () => task?.cancel();
  }, [doc, page, size]);

  const total = doc?.numPages ?? 0;
  const go = (d: number) => {
    setSel(null);
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

  if (error) return <p className="p-4 text-sm text-ink-muted">No he podido abrir ese PDF.</p>;

  return (
    <div
      className="relative flex h-full flex-col"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") go(1);
        if (e.key === "ArrowLeft") go(-1);
      }}
      aria-label="Diapositivas"
    >
      <div ref={box} className="flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-[#2a2a2a]">
        {doc ? (
          <div className="relative">
            <canvas ref={canvas} className="block shadow-lg" />
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
                {!sel && <span className="pointer-events-none absolute top-2 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-[11px] whitespace-nowrap text-white">Arrastra sobre lo que quieras copiar</span>}
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
                    {busy ? "Transcribiendo…" : "Transcribir"}
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          <span className="text-sm text-white/60">Cargando…</span>
        )}
      </div>
      {total > 0 && (
        <div className="flex items-center justify-center gap-3 bg-[#2a2a2a] pb-2 text-sm text-white">
          <button type="button" onClick={() => go(-1)} disabled={page === 1} className="rounded px-3 py-1 hover:bg-white/10 disabled:opacity-30" aria-label="Diapositiva anterior"><ChevronLeft size={18} /></button>
          <span className="tabular-nums">{page} / {total}</span>
          <button type="button" onClick={() => go(1)} disabled={page === total} className="rounded px-3 py-1 hover:bg-white/10 disabled:opacity-30" aria-label="Diapositiva siguiente"><ChevronRight size={18} /></button>
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
                Seleccionar
              </button>
              {selecting && (
                <button type="button" onClick={() => transcribe(null)} disabled={busy} className="rounded-full bg-white/10 px-3 py-1 hover:bg-white/20 disabled:opacity-50">
                  {busy && !big ? "Transcribiendo…" : "Toda la diapositiva"}
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
