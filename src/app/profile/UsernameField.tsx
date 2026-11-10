"use client";

import { useEffect, useState } from "react";
import { useT } from "@/app/LangProvider";
import { cleanHandle } from "@/lib/avatar";
import { checkUsername } from "./actions";

export type HandleStatus = "idle" | "checking" | "ok" | "taken" | "invalid";

// @usuario box with a live "available / taken" check as you type.
// `saved` is your current one (always fine for you).
export function UsernameField({
  value,
  saved,
  onChange,
  onStatus,
  error,
  big = false,
}: {
  value: string;
  saved: string | null;
  onChange: (v: string) => void;
  onStatus?: (s: HandleStatus) => void;
  error?: string | null;
  big?: boolean;
}) {
  const t = useT();
  const [status, setStatus] = useState<HandleStatus>("idle");
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const clean = cleanHandle(value);

  useEffect(() => {
    let live = true;
    const report = (s: HandleStatus, sug: string | null = null) => {
      if (!live) return;
      setStatus(s);
      setSuggestion(sug);
      onStatus?.(s);
    };
    if (!clean) return report("idle");
    if (clean === saved) return report("ok");
    report("checking");
    const timer = setTimeout(async () => {
      const r = await checkUsername(clean);
      report(r.status, r.suggestion ?? null);
    }, 350);
    return () => {
      live = false;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clean, saved]);

  const border = status === "ok" && clean !== saved ? "border-[#1e8e3e]" : status === "taken" || status === "invalid" ? "border-red-400" : "border-border-subtle";
  return (
    <div className="flex flex-col items-center gap-1">
      <span className={`flex items-center rounded-lg border bg-white px-2.5 ${big ? "text-base" : "text-sm"} focus-within:border-ink-faint ${border}`}>
        <span className="text-ink-faint">@</span>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\s/g, "").toLowerCase())}
          placeholder={t("tu_usuario")}
          aria-label={t("Tu @usuario")}
          autoComplete="off"
          spellCheck={false}
          className={`${big ? "w-48 py-2" : "w-36 py-1"} outline-none`}
        />
        <span className="w-4 text-center text-xs" aria-hidden>
          {status === "checking" ? <span className="inline-block size-3 animate-spin rounded-full border-2 border-ink/15 border-t-ink/60" /> : status === "ok" ? <span className="text-[#1e8e3e]">✓</span> : status === "taken" || status === "invalid" ? <span className="text-red-500">✗</span> : null}
        </span>
      </span>
      <span className="text-xs" aria-live="polite">
        {error ? (
          <span className="text-red-600">{t(error)}</span>
        ) : status === "taken" ? (
          <span className="text-red-600">
            {t("Ese ya está cogido.")}{" "}
            {suggestion && (
              <button type="button" onClick={() => onChange(suggestion)} className="font-medium text-ink underline">
                {t("¿Usar @{0}?", { 0: suggestion })}
              </button>
            )}
          </span>
        ) : status === "invalid" ? (
          <span className="text-red-600">{t("De 3 a 20: letras, números, punto o _")}</span>
        ) : status === "ok" && clean !== saved ? (
          <span className="text-[#1e8e3e]">{t("¡Está libre!")}</span>
        ) : (
          <span className="text-ink-faint">{t("Así te encuentran tus amigos")}</span>
        )}
      </span>
    </div>
  );
}
