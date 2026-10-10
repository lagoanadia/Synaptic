"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { signOutAction } from "./actions";
import { setLocale } from "./pursuits/actions";
import { LOCALES, type Locale } from "@/lib/i18n";

const MENU_WIDTH = 220;

const PLAN_LABEL: Record<string, string> = {
  FREE: "Free plan",
  PRO: "Student Pro",
  TEAM: "Team",
};

export function ProfileMenu({
  name,
  email,
  image,
  plan,
  locale,
}: {
  name: string | null | undefined;
  email: string | null | undefined;
  image: string | null | undefined;
  plan: string;
  // Only the onboarding tour's text actually changes with this today —
  // see src/lib/i18n.ts. Optional so existing callers that don't fetch a
  // viewer's locale (there are none left, but nothing requires it) don't
  // break; defaults to English.
  locale?: Locale;
}) {
  const router = useRouter();
  const [isChangingLocale, startLocaleTransition] = useTransition();
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
              <p className="mt-1 text-xs font-medium text-[#2383e2]">
                {PLAN_LABEL[plan] ?? plan}
              </p>
            </div>
            <div className="my-1 h-px bg-black/5" />
            <div className="flex items-center justify-between px-3.5 py-2">
              <span className="text-xs font-medium text-[#6b6b6b]">🌐 Language</span>
              <select
                value={locale ?? "en"}
                disabled={isChangingLocale}
                onChange={(e) => {
                  const next = e.target.value as Locale;
                  startLocaleTransition(async () => {
                    await setLocale(next);
                    router.refresh();
                  });
                }}
                className="rounded-md border border-black/10 bg-white px-1.5 py-1 text-xs text-[#0d0d0d] disabled:opacity-50"
              >
                {LOCALES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="my-1 h-px bg-black/5" />
            <a
              href="/billing"
              className="block w-full rounded-lg px-3.5 py-2.5 text-left text-sm font-medium text-[#0d0d0d] transition-colors hover:bg-[#f2f1ee]"
            >
              Billing
            </a>
            <a
              href="/settings/api-keys"
              className="block w-full rounded-lg px-3.5 py-2.5 text-left text-sm font-medium text-[#0d0d0d] transition-colors hover:bg-[#f2f1ee]"
            >
              API keys
            </a>
            <a
              href="/"
              className="block w-full rounded-lg px-3.5 py-2.5 text-left text-sm font-medium text-[#0d0d0d] transition-colors hover:bg-[#f2f1ee]"
            >
              Landing page
            </a>
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
