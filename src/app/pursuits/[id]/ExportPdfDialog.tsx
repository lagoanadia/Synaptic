"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useT } from "@/app/LangProvider";
import { XIcon } from "@/app/icons";
import { COLORS, DEFAULT_STYLE, FONTS, RADII, printSheet, sheetCss, sheetHtml, type FontKey, type SheetStyle } from "@/lib/exportSheet";

const KEY = "synaptic.exportStyle";
const FONT_NAME: Record<FontKey, string> = { inter: "Inter", lora: "Lora", mono: "Mono" };
const A4 = { w: 794, pad: 76 };

function loadStyle(): SheetStyle {
  try {
    return { ...DEFAULT_STYLE, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    return DEFAULT_STYLE;
  }
}

// "Descargar PDF": an A4 preview of the page in Synaptic's look, with letter,
// colour, rounding and table stripes to choose. Export prints it as a PDF.
export function ExportPdfDialog({ title, content, onClose }: { title: string; content: string; onClose: () => void }) {
  const t = useT();
  const [st, setSt] = useState<SheetStyle>(DEFAULT_STYLE);
  const [busy, setBusy] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.6);
  const html = useMemo(() => sheetHtml(title, content), [title, content]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setSt(loadStyle()), []);
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(st));
    } catch {}
  }, [st]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setScale(Math.min(1, (e.contentRect.width - 32) / A4.w)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    if (document.getElementById("x-fonts")) return;
    const l = document.createElement("link");
    l.id = "x-fonts";
    l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Lora:wght@400;700&display=swap";
    document.head.appendChild(l);
  }, []);

  const set = (p: Partial<SheetStyle>) => setSt((s) => ({ ...s, ...p }));
  const pill = (on: boolean) => `rounded-full px-3 py-1 text-xs ${on ? "bg-ink text-white" : "bg-chip text-ink-muted hover:text-ink"}`;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-stretch justify-center bg-ink/30 p-0 sm:p-6" role="dialog" aria-modal="true" aria-label={t("Descargar PDF")} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="flex w-full max-w-5xl flex-col overflow-hidden bg-white shadow-2xl sm:rounded-2xl">
        <header className="flex items-center gap-3 border-b border-border-subtle px-5 py-3">
          <b className="flex-1 text-[15px]">{t("Descargar PDF")}</b>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await printSheet(html, st, title || t("Página"));
              } finally {
                setBusy(false);
              }
            }}
            className="rounded-lg bg-ink px-4 py-1.5 text-sm font-medium text-white disabled:opacity-60"
          >
            {busy ? t("Preparando…") : t("Exportar")}
          </button>
          <button type="button" onClick={onClose} aria-label={t("Cerrar")} className="rounded p-1 text-ink-muted hover:bg-chip">
            <XIcon size={18} className="block" />
          </button>
        </header>
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <div ref={wrap} className="min-h-0 flex-1 overflow-auto bg-[#eceae5] p-4">
            <style>{sheetCss(st)}</style>
            <div style={{ width: A4.w * scale, margin: "0 auto" }}>
              <div className="bg-white shadow-lg" style={{ width: A4.w, padding: A4.pad, transform: `scale(${scale})`, transformOrigin: "top left", minHeight: 1123 }} dangerouslySetInnerHTML={{ __html: html }} />
            </div>
          </div>
          <aside className="flex shrink-0 flex-col gap-5 border-t border-border-subtle p-5 md:w-60 md:border-t-0 md:border-l">
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold tracking-wide text-ink-faint uppercase">{t("Letra")}</span>
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(FONTS) as FontKey[]).map((f) => (
                  <button key={f} type="button" onClick={() => set({ font: f })} aria-pressed={st.font === f} className={pill(st.font === f)} style={{ fontFamily: FONTS[f] }}>
                    {FONT_NAME[f]}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold tracking-wide text-ink-faint uppercase">{t("Color")}</span>
              <div className="flex flex-wrap items-center gap-2">
                {COLORS.map((c) => (
                  <button key={c} type="button" onClick={() => set({ color: c })} aria-pressed={st.color === c} aria-label={c} className={`size-7 rounded-full ${st.color === c ? "outline-2 outline-offset-2 outline-ink outline-solid" : ""}`} style={{ background: c }} />
                ))}
                <label className="relative grid size-7 cursor-pointer place-items-center rounded-full border border-dashed border-ink-faint text-xs text-ink-muted" title={t("Otro color")}>
                  +
                  <input type="color" value={st.color} onChange={(e) => set({ color: e.target.value })} className="absolute inset-0 cursor-pointer opacity-0" aria-label={t("Otro color")} />
                </label>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold tracking-wide text-ink-faint uppercase">{t("Redondeo")}</span>
              <div className="flex gap-2">
                {RADII.map((r) => (
                  <button key={r} type="button" onClick={() => set({ radius: r })} aria-pressed={st.radius === r} aria-label={`${r}px`} className={`size-8 border-2 ${st.radius === r ? "border-ink" : "border-border-subtle"}`} style={{ borderRadius: r / 1.4, background: st.color + "22" }} />
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold tracking-wide text-ink-faint uppercase">{t("Filas de tablas")}</span>
              <div className="flex gap-1.5">
                <button type="button" onClick={() => set({ stripes: true })} className={pill(st.stripes)}>{t("Alternas")}</button>
                <button type="button" onClick={() => set({ stripes: false })} className={pill(!st.stripes)}>{t("Lisas")}</button>
              </div>
            </div>
            <p className="mt-auto text-xs text-ink-faint">{t("Se abre el diálogo de imprimir: elige «Guardar como PDF».")}</p>
          </aside>
        </div>
      </div>
    </div>,
    document.body,
  );
}
