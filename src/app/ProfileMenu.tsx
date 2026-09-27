"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { signOutAction } from "./actions";

const MENU_WIDTH = 220;

export function ProfileMenu({
  name,
  email,
  image,
}: {
  name: string | null | undefined;
  email: string | null | undefined;
  image: string | null | undefined;
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  function updatePosition() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setCoords({ top: rect.bottom + 8, left: rect.right - MENU_WIDTH });
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
  }, [open]);

  const initial = (name ?? email ?? "?").trim().charAt(0).toUpperCase();

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-[#2383e2] text-sm font-bold text-white transition-transform hover:-translate-y-0.5 hover:shadow-md"
        aria-label="Account menu"
      >
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" className="h-full w-full object-cover" />
        ) : (
          initial
        )}
      </button>

      {open &&
        coords &&
        createPortal(
          <div
            ref={menuRef}
            style={{ top: coords.top, left: coords.left, width: MENU_WIDTH }}
            className="fixed z-[100] rounded-2xl bg-white p-2 shadow-[0_24px_48px_-12px_rgba(13,13,13,0.22),0_8px_16px_rgba(13,13,13,0.08)]"
          >
            <div className="truncate px-3.5 py-2 text-sm">
              <p className="font-semibold text-[#0d0d0d]">{name ?? "Your account"}</p>
              {email && <p className="truncate text-xs text-[#6b6b6b]">{email}</p>}
            </div>
            <div className="my-1 h-px bg-black/5" />
            <form action={signOutAction}>
              <button
                type="submit"
                className="w-full rounded-lg px-3.5 py-2.5 text-left text-sm font-medium text-[#0d0d0d] transition-colors hover:bg-[#f2f1ee]"
              >
                Sign out
              </button>
            </form>
          </div>,
          document.body,
        )}
    </>
  );
}
