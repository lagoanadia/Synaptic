"use client";

import { useState, useTransition } from "react";
import { useT } from "./LangProvider";
import { setTheme } from "./actions";

type Theme = "light" | "dark" | "system";

// Light · Dark · Auto. Switches at once, then saves the cookie.
export function ThemePicker({ initial }: { initial: Theme }) {
  const t = useT();
  const [theme, set] = useState<Theme>(initial);
  const [pending, start] = useTransition();
  const pick = (next: Theme) => {
    set(next);
    const dark = next === "dark" || (next === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
    start(() => setTheme(next));
  };
  return (
    <span className={`flex rounded-md bg-black/5 p-0.5 text-[11px] font-semibold ${pending ? "opacity-60" : ""}`} role="radiogroup" aria-label={t("Tema")}>
      {(
        [
          ["light", t("Claro")],
          ["dark", t("Oscuro")],
          ["system", t("Auto")],
        ] as const
      ).map(([k, label]) => (
        <button key={k} type="button" role="radio" aria-checked={theme === k} onClick={() => theme !== k && pick(k)} className={`rounded px-2 py-0.5 ${theme === k ? "bg-white text-ink shadow-sm" : "text-ink-faint hover:text-ink"}`}>
          {label}
        </button>
      ))}
    </span>
  );
}
