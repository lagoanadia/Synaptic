"use client";

import { useT } from "@/app/LangProvider";
import { SlidesIcon } from "@/app/icons";
import { useRef, useState, useTransition } from "react";
import { importSlides } from "./actions";
import { readPptx, slidesToText } from "@/lib/pptx";

// The teacher's PowerPoint → a page + its AI summary, in one click.
export function ImportSlides({ pursuitId, sectionId }: { pursuitId: string; sectionId: string | null }) {
  const t = useT();
  const input = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handle(file: File) {
    setError(null);
    startTransition(async () => {
      setStatus("Leyendo diapositivas…");
      let text = "";
      try {
        const slides = readPptx(new Uint8Array(await file.arrayBuffer()));
        text = slidesToText(slides, file.name.replace(/\.pptx$/i, ""));
      } catch {
        setStatus(null);
        return setError(t("No he podido leer ese archivo — tiene que ser un .pptx (en Google Slides: Archivo → Descargar → .pptx)"));
      }
      setStatus("Resumiendo…");
      const r = await importSlides(pursuitId, sectionId, text);
      setStatus(null);
      if (r.error) setError(r.error);
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <input
        ref={input}
        type="file"
        accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) handle(f);
        }}
      />
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={isPending}
        className="self-start rounded-md px-3 py-1.5 text-sm text-ink-muted transition-colors hover:bg-chip hover:text-ink disabled:opacity-60"
      >
        {isPending ? (status ?? t("Trabajando…")) : <><SlidesIcon />{" "}{t("Importar")}</>}
      </button>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
