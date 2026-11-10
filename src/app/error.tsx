"use client";

import { useT } from "@/app/LangProvider";
import Link from "next/link";
import { BrokenThread, errorButton } from "./BrokenThread";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Kind = "offline" | "update" | "busy" | "unknown";

// What probably happened, from what the browser can see. Server errors
// arrive here without their message in production (only a digest), so
// those fall back to "unknown", which is usually fixed by retrying.
function kindOf(error: Error): Kind {
  if (typeof navigator !== "undefined" && !navigator.onLine) return "offline";
  const m = `${error.name} ${error.message}`;
  if (/ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module|Failed to find Server Action/i.test(m)) return "update";
  if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return "offline";
  if (/too many|connection|timeout|ECONN|P20(37|24)/i.test(m)) return "busy";
  return "unknown";
}

const COPY: Record<Kind, { title: string; text: string }> = {
  offline: { title: "Sin conexión.", text: "Parece que te has quedado sin internet. Cuando vuelvas a tener conexión, pulsa Reintentar." },
  update: { title: "Hay una versión nueva.", text: "Synaptic se ha actualizado mientras tenías la página abierta. Recarga para usar la nueva." },
  busy: { title: "Va un poco lento.", text: "El servidor está ocupado ahora mismo. Espera unos segundos y pulsa Reintentar." },
  unknown: { title: "Se ha roto un hilo.", text: "Algo no ha cargado bien. Tus apuntes están a salvo: inténtalo otra vez." },
};

// Any page that fails: what happened in plain words, what to do, and the
// technical details tucked away for a bug report. Nothing is lost.
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const kind = kindOf(error);
  const copy = COPY[kind];

  useEffect(() => {
    console.error(error);
  }, [error]);

  // Re-fetch the page's data, not just re-draw the same failure.
  const retry = () =>
    kind === "update"
      ? window.location.reload()
      : start(() => {
          router.refresh();
          reset();
        });

  return (
    <BrokenThread title={t(copy.title)} text={t(copy.text)}>
      <button type="button" onClick={retry} disabled={pending} className={errorButton}>
        {kind === "update" ? t("↻ Recargar") : pending ? t("Reintentando…") : t("↻ Reintentar")}
      </button>
      <Link href="/" className="rounded-full px-5 py-3.5 text-[15px] font-medium text-white/90 hover:text-white">
        {t("Ir al inicio")}
      </Link>
      <div className="basis-full">
        <button type="button" onClick={() => setOpen((o) => !o)} className="mt-4 text-xs text-white/70 hover:text-white">
          {open ? t("Ocultar detalles") : t("Detalles")}
        </button>
        {open && (
          <pre className="mx-auto mt-2 max-w-md overflow-x-auto rounded-md bg-white/15 px-3 py-2 text-left text-[11px] whitespace-pre-wrap">
            {error.message || t("Error sin mensaje")}
            {error.digest && t("\nCódigo: {0}", { 0: error.digest })}
          </pre>
        )}
      </div>
    </BrokenThread>
  );
}
