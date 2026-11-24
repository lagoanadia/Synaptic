"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import { useT } from "./LangProvider";
import { setTheme } from "./actions";

type Theme = "light" | "dark" | "system";

const Sun = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);
const Moon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
    <path d="M17 3v3M15.5 4.5h3" />
  </svg>
);

// ☀ ─● ☾ switch, plus "Auto" (follow the device). Switches at once, then
// saves the cookie.
export function ThemePicker({ initial }: { initial: Theme }) {
  const t = useT();
  const [theme, set] = useState<Theme>(initial);
  const [pending, start] = useTransition();
  // The device's own setting, read only in the browser (no mismatch on load).
  const deviceDark = useSyncExternalStore(
    (cb) => {
      const m = matchMedia("(prefers-color-scheme: dark)");
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => matchMedia("(prefers-color-scheme: dark)").matches,
    () => false,
  );
  const isDark = theme === "dark" || (theme === "system" && deviceDark);
  const pick = (next: Theme) => {
    set(next);
    const dark = next === "dark" || (next === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
    start(() => setTheme(next));
  };
  return (
    <span className={`flex items-center gap-2.5 ${pending ? "opacity-70" : ""}`}>
      <button type="button" onClick={() => pick("light")} aria-label={t("Claro")} title={t("Claro")} className={`transition-colors ${theme === "light" ? "text-[#eda100]" : "text-ink-faint hover:text-ink"}`}>
        <Sun />
      </button>
      <button
        type="button"
        role="switch"
        aria-checked={isDark}
        aria-label={t("Tema")}
        onClick={() => pick(isDark ? "light" : "dark")}
        className={`relative h-7 w-[52px] rounded-full shadow-[inset_0_1px_3px_rgba(0,0,0,.25)] transition-colors duration-300 ${isDark ? "bg-[#2b2d42]" : "bg-[#e4e3df]"}`}
      >
        <span className={`absolute top-1 size-5 rounded-full shadow-[0_1px_3px_rgba(0,0,0,.3)] transition-all duration-300 ${isDark ? "left-[28px] bg-[#8d90b0]" : "left-1 bg-white"}`} />
      </button>
      <button type="button" onClick={() => pick("dark")} aria-label={t("Oscuro")} title={t("Oscuro")} className={`transition-colors ${theme === "dark" ? "text-[#8d90ff]" : "text-ink-faint hover:text-ink"}`}>
        <Moon />
      </button>
      <span className="mx-0.5 h-4 w-px bg-border-subtle" />
      <button
        type="button"
        onClick={() => pick("system")}
        aria-pressed={theme === "system"}
        aria-label={t("Auto")}
        title={t("Como tu dispositivo")}
        className={`grid size-7 place-items-center rounded-lg transition-colors ${theme === "system" ? "bg-chip text-ink" : "text-ink-faint hover:text-ink"}`}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M3 5h18v11H3z" />
          <path d="M9 20h6M12 16v4" />
        </svg>
      </button>
    </span>
  );
}
