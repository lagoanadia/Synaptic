"use client";

import { ChevronLeft, ChevronRight } from "@/app/icons";
import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";

// One PDF page at a time, scaled to fit the panel. ← / → flip pages
// while the pointer is over it.
export function PdfSlides({ src }: { src: string }) {
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
      const r = p.render({ canvasContext: c.getContext("2d")!, viewport });
      task = r;
      await r.promise.catch(() => {});
    })();
    return () => task?.cancel();
  }, [doc, page, size]);

  const total = doc?.numPages ?? 0;
  const go = (d: number) => setPage((p) => Math.min(Math.max(1, p + d), total || 1));

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
        {doc ? <canvas ref={canvas} className="shadow-lg" /> : <span className="text-sm text-white/60">Cargando…</span>}
      </div>
      {total > 0 && (
        <div className="flex items-center justify-center gap-3 bg-[#2a2a2a] pb-2 text-sm text-white">
          <button type="button" onClick={() => go(-1)} disabled={page === 1} className="rounded px-3 py-1 hover:bg-white/10 disabled:opacity-30" aria-label="Diapositiva anterior"><ChevronLeft size={18} /></button>
          <span className="tabular-nums">{page} / {total}</span>
          <button type="button" onClick={() => go(1)} disabled={page === total} className="rounded px-3 py-1 hover:bg-white/10 disabled:opacity-30" aria-label="Diapositiva siguiente"><ChevronRight size={18} /></button>
        </div>
      )}
    </div>
  );
}
