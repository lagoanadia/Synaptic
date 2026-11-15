"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useT } from "@/app/LangProvider";
import { PANEL } from "./Popover";

// ── Dialogs ────────────────────────────────────────────────────────────────
// Synaptic's own confirm / alert / prompt, instead of the browser's grey
// boxes. They return promises: `if (!(await ask.confirm("¿…?"))) return;`.

type Dialog = {
  kind: "confirm" | "alert" | "prompt";
  message: string;
  danger?: boolean;
  ok?: string;
  initial?: string;
  resolve: (v: unknown) => void;
  id: number;
};

let current: Dialog | null = null;
const listeners = new Set<() => void>();
const set = (d: Dialog | null) => {
  current = d;
  listeners.forEach((l) => l());
};
let seq = 0;
function open<T>(d: Omit<Dialog, "resolve" | "id">) {
  return new Promise<T>((resolve) => {
    // A new dialog replaces one still open, which counts as cancelled.
    current?.resolve(current.kind === "prompt" ? null : current.kind === "alert" ? undefined : false);
    set({ ...d, id: ++seq, resolve: resolve as (v: unknown) => void });
  });
}

export const ask = {
  confirm: (message: string, o: { danger?: boolean; ok?: string } = {}) => open<boolean>({ kind: "confirm", message, ...o }),
  alert: (message: string) => open<void>({ kind: "alert", message }),
  prompt: (message: string, initial = "") => open<string | null>({ kind: "prompt", message, initial }),
};

function DialogLayer() {
  const d = useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => current,
    () => null,
  );
  return d ? <DialogBox key={d.id} d={d} /> : null;
}

function DialogBox({ d }: { d: Dialog }) {
  const t = useT();
  const input = useRef<HTMLInputElement>(null);
  const okBtn = useRef<HTMLButtonElement>(null);
  const [text, setText] = useState(d.initial ?? "");

  useEffect(() => {
    const back = document.activeElement as HTMLElement | null;
    requestAnimationFrame(() => (d.kind === "prompt" ? input.current?.select() : okBtn.current?.focus()));
    const key = (e: KeyboardEvent) => e.key === "Escape" && close(false);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      back?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d]);

  function close(ok: boolean) {
    if (current !== d) return;
    set(null);
    d.resolve(d.kind === "prompt" ? (ok ? text : null) : d.kind === "alert" ? undefined : ok);
  }

  return (
    <div className="fixed inset-0 z-[210] grid place-items-center bg-black/20 p-4 animate-[fade-in_120ms_ease-out]" onPointerDown={(e) => e.target === e.currentTarget && close(false)}>
      <form
        role="alertdialog"
        aria-modal
        aria-label={d.message}
        onSubmit={(e) => {
          e.preventDefault();
          close(true);
        }}
        className={`${PANEL} flex w-full max-w-sm flex-col gap-4 p-5`}
      >
        <p className="text-[14.5px] leading-relaxed whitespace-pre-line text-ink">{d.message}</p>
        {d.kind === "prompt" && (
          <input ref={input} value={text} onChange={(e) => setText(e.target.value)} className="rounded-lg border border-border-subtle bg-transparent px-3 py-2 text-sm outline-none focus:border-accent" />
        )}
        <div className="flex justify-end gap-2 text-sm">
          {d.kind !== "alert" && (
            <button type="button" onClick={() => close(false)} className="rounded-lg px-3 py-1.5 text-ink-muted hover:bg-hover hover:text-ink">
              {t("Cancelar")}
            </button>
          )}
          <button
            ref={okBtn}
            type="submit"
            className={`rounded-lg px-3.5 py-1.5 font-medium text-white outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${d.danger ? "bg-[#e03e3e] hover:bg-[#c93535] focus-visible:ring-[#e03e3e]/50" : "bg-accent hover:brightness-95 focus-visible:ring-accent/50"}`}
          >
            {d.ok ?? (d.kind === "alert" ? t("Vale") : t("Confirmar"))}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Tooltips ───────────────────────────────────────────────────────────────
// Every `title="…"` in the app shows as a small Synaptic tooltip instead of
// the browser's yellow box: on hover the title is moved aside (so the native
// one doesn't also appear) and put back when the pointer leaves.

function TooltipLayer() {
  const [tip, setTip] = useState<{ text: string; x: number; y: number; below: boolean } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const [left, setLeft] = useState<number | null>(null);

  useEffect(() => {
    let el: HTMLElement | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let warm = false; // once one tooltip showed, the next shows at once
    let cool: ReturnType<typeof setTimeout> | undefined;

    const restore = () => {
      clearTimeout(timer);
      if (el?.dataset.tip !== undefined) {
        if (!el.hasAttribute("title")) el.setAttribute("title", el.dataset.tip);
        delete el.dataset.tip;
      }
      el = null;
      setTip(null);
      clearTimeout(cool);
      cool = setTimeout(() => (warm = false), 400);
    };
    const show = (target: HTMLElement) => {
      const text = target.dataset.tip;
      if (!text || !target.isConnected) return;
      const r = target.getBoundingClientRect();
      const below = r.bottom + 40 < window.innerHeight;
      setLeft(null);
      setTip({ text, x: r.left + r.width / 2, y: below ? r.bottom + 6 : r.top - 6, below });
      warm = true;
    };
    const enter = (target: Element | null, delay: number) => {
      const t = (target as HTMLElement | null)?.closest?.<HTMLElement>("[title]");
      if (t === el) return;
      restore();
      if (!t || !(t instanceof HTMLElement)) return;
      const text = t.getAttribute("title");
      if (!text) return;
      el = t;
      t.dataset.tip = text;
      t.removeAttribute("title");
      clearTimeout(cool);
      timer = setTimeout(() => show(t), warm ? 0 : delay);
    };

    const over = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      const target = e.target as Element;
      if (el && el.contains(target)) return;
      enter(target, 450);
    };
    const out = (e: PointerEvent) => {
      if (el && !(e.relatedTarget instanceof Node && el.contains(e.relatedTarget))) restore();
    };
    const focus = (e: FocusEvent) => {
      const target = e.target as Element;
      if (target instanceof HTMLElement && target.matches(":focus-visible")) enter(target, 0);
    };
    document.addEventListener("pointerover", over);
    document.addEventListener("pointerout", out);
    document.addEventListener("focusin", focus);
    document.addEventListener("focusout", restore);
    document.addEventListener("pointerdown", restore, true);
    window.addEventListener("scroll", restore, true);
    return () => {
      restore();
      document.removeEventListener("pointerover", over);
      document.removeEventListener("pointerout", out);
      document.removeEventListener("focusin", focus);
      document.removeEventListener("focusout", restore);
      document.removeEventListener("pointerdown", restore, true);
      window.removeEventListener("scroll", restore, true);
    };
  }, []);

  // Keep it inside the window once its width is known.
  useEffect(() => {
    if (!tip || !box.current) return;
    const w = box.current.offsetWidth;
    setLeft(Math.max(8, Math.min(tip.x - w / 2, window.innerWidth - w - 8)));
  }, [tip]);

  if (!tip) return null;
  return (
    <div
      ref={box}
      role="tooltip"
      className="pointer-events-none fixed z-[220] max-w-64 rounded-md bg-ink px-2 py-1 text-[11.5px] leading-snug font-medium text-white shadow-[0_4px_14px_rgba(15,15,15,.18)] animate-[tip-in_100ms_ease-out]"
      style={{ left: left ?? -9999, top: tip.y, translate: tip.below ? undefined : "0 -100%" }}
    >
      {tip.text}
    </div>
  );
}

export function PopupHost() {
  return (
    <>
      <TooltipLayer />
      <DialogLayer />
    </>
  );
}
