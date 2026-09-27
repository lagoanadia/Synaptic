"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { signInWithGithub, signInWithGoogle } from "./actions";

const providerButtonClass =
  "flex w-full items-center gap-2.5 whitespace-nowrap rounded-lg px-3.5 py-2.5 text-left text-sm font-medium text-[#0d0d0d] transition-colors hover:bg-[#f2f1ee]";

const MENU_WIDTH = 240;

// A single trigger that opens a small "choose a provider" popover, reused
// for every CTA on the landing page — one component instead of repeating
// a two-button choice at each of the six places a CTA appears.
//
// The menu is rendered through a portal straight into <body>, positioned
// with `fixed` from the trigger's own bounding box. Several triggers sit
// inside a Reveal wrapper, whose scroll-in animation applies a CSS
// `transform` — and `transform` on an ancestor creates a new stacking
// context that traps any z-index set on a normal-flow descendant, so a
// plain `position: absolute` dropdown nested in the tree kept rendering
// underneath later siblings (the hero's floating cards) no matter how
// high its own z-index was set. Escaping to the body sidesteps that
// entirely instead of fighting it with more z-index values.
export function AuthMenu({
  children,
  triggerClassName,
  align = "center",
  block = false,
}: {
  children: ReactNode;
  triggerClassName: string;
  align?: "left" | "right" | "center";
  block?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  function updatePosition() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const left =
      align === "left"
        ? rect.left
        : align === "right"
          ? rect.right - MENU_WIDTH
          : rect.left + rect.width / 2 - MENU_WIDTH / 2;
    setCoords({ top: rect.bottom + 10, left });
  }

  useEffect(() => {
    if (!open) return;
    updatePosition();

    function handlePointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    }
    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`${triggerClassName} ${block ? "block w-full" : ""}`}
      >
        {children}
      </button>

      {open &&
        coords &&
        createPortal(
          <div
            ref={menuRef}
            style={{ top: coords.top, left: coords.left, width: MENU_WIDTH }}
            className="fixed z-[100] rounded-2xl bg-white p-2 shadow-[0_24px_48px_-12px_rgba(13,13,13,0.22),0_8px_16px_rgba(13,13,13,0.08)]"
          >
            <form action={signInWithGithub}>
              <button type="submit" className={providerButtonClass}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.57.1.78-.25.78-.55 0-.27-.01-1.16-.02-2.11-3.2.7-3.87-1.36-3.87-1.36-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.7.08-.7 1.17.08 1.78 1.2 1.78 1.2 1.03 1.77 2.71 1.26 3.37.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.02 11.02 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.64 1.59.24 2.76.12 3.05.74.81 1.18 1.83 1.18 3.09 0 4.41-2.69 5.39-5.25 5.67.41.36.78 1.06.78 2.15 0 1.55-.01 2.8-.01 3.18 0 .3.2.66.79.55A10.51 10.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
                </svg>
                Continue with GitHub
              </button>
            </form>
            <form action={signInWithGoogle}>
              <button type="submit" className={providerButtonClass}>
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.63h6.48a5.55 5.55 0 0 1-2.4 3.64v3h3.89c2.28-2.1 3.55-5.2 3.55-8.82Z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.89-3c-1.08.73-2.46 1.15-4.06 1.15-3.12 0-5.77-2.11-6.72-4.94H1.26v3.1A12 12 0 0 0 12 24Z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.3a7.2 7.2 0 0 1 0-4.6v-3.1H1.26a12 12 0 0 0 0 10.8l4.02-3.1Z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.76 0 3.35.61 4.6 1.8l3.45-3.45C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.26 6.6l4.02 3.1C6.23 6.86 8.88 4.75 12 4.75Z"
                  />
                </svg>
                Continue with Google
              </button>
            </form>
          </div>,
          document.body,
        )}
    </>
  );
}
