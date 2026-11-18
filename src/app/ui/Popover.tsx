"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// The app's own floating surface: white card, hairline ring, soft shadow
// (the same look as the right-click EditMenu). Used instead of the browser's
// native pop-ups so dates, times and pickers look like Synaptic.
export const PANEL =
  "pop-panel rounded-xl bg-white text-ink shadow-[0_0_0_1px_rgba(15,15,15,.06),0_12px_32px_rgba(15,15,15,.16)] animate-[pop-in_120ms_ease-out]";

// A panel anchored under (or above, if there's no room) its trigger. Rendered
// in a portal so overflow-hidden parents don't clip it. Clicking outside or
// pressing Escape closes it; scrolling and resizing keep it attached.
export function Popover({
  anchor,
  open,
  onClose,
  children,
  matchWidth,
  align = "start",
  className = "",
  label,
}: {
  anchor: React.RefObject<HTMLElement | null>;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  matchWidth?: boolean;
  align?: "start" | "end";
  className?: string;
  label?: string;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number; minWidth?: number } | null>(null);
  // Latest onClose without re-subscribing every render.
  const closeRef = useRef(onClose);
  useLayoutEffect(() => {
    closeRef.current = onClose;
  });

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const a = anchor.current?.getBoundingClientRect();
      const p = panel.current;
      if (!a || !p) return;
      const w = p.offsetWidth;
      const h = p.offsetHeight;
      const gap = 6;
      let left = align === "end" ? a.right - w : a.left;
      left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
      let top = a.bottom + gap;
      if (top + h > window.innerHeight - 8 && a.top - gap - h > 8) top = a.top - gap - h;
      top = Math.max(8, Math.min(top, window.innerHeight - h - 8));
      setPos({ left, top, minWidth: matchWidth ? a.width : undefined });
    };
    const down = (e: PointerEvent) => {
      const t = e.target as Node;
      if (panel.current?.contains(t) || anchor.current?.contains(t)) return;
      closeRef.current();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeRef.current();
        anchor.current?.focus();
      }
    };
    place();
    const ro = new ResizeObserver(place);
    if (panel.current) ro.observe(panel.current);
    document.addEventListener("pointerdown", down, true);
    document.addEventListener("keydown", key, true);
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      ro.disconnect();
      document.removeEventListener("pointerdown", down, true);
      document.removeEventListener("keydown", key, true);
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, anchor, align, matchWidth]);

  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div
      ref={panel}
      role="dialog"
      aria-label={label}
      className={`fixed z-[200] ${PANEL} ${className}`}
      style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999, minWidth: pos?.minWidth, visibility: pos ? "visible" : "hidden" }}
    >
      {children}
    </div>,
    document.body,
  );
}

export const Chevron = ({ dir = "down", size = 12 }: { dir?: "down" | "left" | "right" | "up"; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ rotate: { down: "0deg", up: "180deg", left: "90deg", right: "-90deg" }[dir] }}>
    <path d="m6 9 6 6 6-6" />
  </svg>
);

export const CalendarIcon = ({ size = 13 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <rect x="3.5" y="5" width="17" height="15" rx="2" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
  </svg>
);
