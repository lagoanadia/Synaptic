"use client";

import Link from "next/link";
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
  offline: { title: "Sin conexión", text: "Parece que te has quedado sin internet. Cuando vuelvas a tener conexión, pulsa Reintentar." },
  update: { title: "Hay una versión nueva", text: "Synaptic se ha actualizado mientras tenías la página abierta. Recarga para usar la nueva." },
  busy: { title: "Va un poco lento", text: "El servidor está ocupado ahora mismo. Espera unos segundos y pulsa Reintentar." },
  unknown: { title: "Esta página no ha cargado", text: "Algo ha fallado al cargarla. Suele arreglarse al reintentar; si no, vuelve al inicio." },
};

// Any page that fails: what happened in plain words, what to do, and the
// technical details tucked away for a bug report. Nothing is lost.
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
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
    <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6 py-24 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-chip text-xl text-ink-muted" aria-hidden>
        {kind === "offline" ? "⌁" : kind === "update" ? "↻" : "!"}
      </span>
      <div className="flex max-w-sm flex-col gap-2">
        <h1 className="text-xl font-semibold text-ink">{copy.title}</h1>
        <p className="text-sm leading-relaxed text-ink-muted">{copy.text}</p>
        <p className="text-xs text-ink-faint">Tus apuntes están a salvo.</p>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={retry} disabled={pending} className="rounded-md bg-ink px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50">
          {kind === "update" ? "Recargar" : pending ? "Reintentando…" : "Reintentar"}
        </button>
        <Link href="/pursuits" className="rounded-md px-4 py-2 text-sm text-ink-muted hover:bg-chip hover:text-ink">
          Ir al inicio
        </Link>
      </div>
      <button type="button" onClick={() => setOpen((o) => !o)} className="text-xs text-ink-faint hover:text-ink-muted">
        {open ? "Ocultar detalles" : "Detalles"}
      </button>
      {open && (
        <pre className="max-w-md overflow-x-auto rounded-md bg-chip px-3 py-2 text-left text-[11px] whitespace-pre-wrap text-ink-muted">
          {error.message || "Error sin mensaje"}
          {error.digest && `\nCódigo: ${error.digest}`}
        </pre>
      )}
    </div>
  );
}
