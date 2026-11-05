"use client";

import { useRef, useState, useTransition } from "react";
import { importSlides } from "./actions";
import { readPptx, slidesToText } from "@/lib/pptx";

// The teacher's PowerPoint → a page + its AI summary, in one click.
export function ImportSlides({ pursuitId, sectionId }: { pursuitId: string; sectionId: string | null }) {
  const input = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handle(file: File) {
    setError(null);
    startTransition(async () => {
      setStatus("Reading slides…");
      let text = "";
      try {
        const slides = readPptx(new Uint8Array(await file.arrayBuffer()));
        text = slidesToText(slides, file.name.replace(/\.pptx$/i, ""));
      } catch {
        setStatus(null);
        return setError("Couldn't read that file — it needs to be a .pptx (in Google Slides: File → Download → .pptx)");
      }
      setStatus("Summarizing…");
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
        className="self-start rounded-full border-2 border-tile-sky px-4 py-2 text-sm font-semibold text-tile-sky transition-colors hover:bg-accent-soft disabled:opacity-60"
      >
        {isPending ? (status ?? "Working…") : "📊 Import slides → summary"}
      </button>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
