"use client";

import { ArrowRight } from "@/app/icons";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createConceptMap } from "./actions";
import { pdfToText } from "@/lib/pdfText";
import { readPptx, slidesToText } from "@/lib/pptx";

type Kind = "text" | "pdf" | "pptx" | "notes" | "repo";

const KINDS: { kind: Kind; label: string }[] = [
  { kind: "pptx", label: "PowerPoint" },
  { kind: "pdf", label: "PDF" },
  { kind: "text", label: "Paste" },
  { kind: "notes", label: "My notes" },
  { kind: "repo", label: "GitHub" },
];

const LANGUAGES = ["English", "Español", "Deutsch", "Français"];

export function NewMapForm({ pursuitId, hasNotes }: { pursuitId: string; hasNotes: boolean }) {
  const router = useRouter();
  const [kind, setKind] = useState<Kind>("pptx");
  const [text, setText] = useState("");
  const [ref, setRef] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [language, setLanguage] = useState("English");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const ready =
    (kind === "text" && text.trim().length >= 40) ||
    ((kind === "pdf" || kind === "pptx") && !!file) ||
    (kind === "notes" && hasNotes) ||
    (kind === "repo" && ref.trim().includes("/"));

  function submit() {
    setError(null);
    startTransition(async () => {
      let body = text;
      if (kind === "pdf" && file) {
        setStatus("Reading the PDF…");
        try {
          body = await pdfToText(file);
        } catch {
          setError("Couldn't read that PDF");
          setStatus(null);
          return;
        }
        if (body.replace(/\[p\d+\]/g, "").trim().length < 40) {
          setError("That PDF has no selectable text (it's probably scanned).");
          setStatus(null);
          return;
        }
      }
      if (kind === "pptx" && file) {
        try {
          body = slidesToText(readPptx(new Uint8Array(await file.arrayBuffer())));
        } catch {
          setError("Couldn't read that file — it needs to be a .pptx");
          setStatus(null);
          return;
        }
      }
      setStatus(kind === "repo" ? "Reading the repo and mapping it…" : "Breaking it into concepts…");
      const result = await createConceptMap(pursuitId, {
        kind,
        text: body,
        ref: kind === "repo" ? ref : file?.name,
        language,
      });
      setStatus(null);
      if (result.error !== null) {
        setError(result.error);
        return;
      }
      router.push(`/pursuits/${pursuitId}/learn/${result.mapId}`);
    });
  }

  return (
    <div className="flex flex-col gap-4 rounded-3xl bg-white p-6 shadow-[0_1px_2px_rgba(13,13,13,0.06)]">
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Source">
        {KINDS.map((k) => {
          const disabled = k.kind === "notes" && !hasNotes;
          return (
            <button
              key={k.kind}
              type="button"
              role="radio"
              aria-checked={kind === k.kind}
              disabled={disabled}
              title={disabled ? "No organized notes in this subject yet" : undefined}
              onClick={() => setKind(k.kind)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-40 ${
                kind === k.kind ? "bg-ink text-white" : "bg-chip text-ink-muted hover:text-ink"
              }`}
            >
              {k.label}
            </button>
          );
        })}
      </div>

      {kind === "text" && (
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          placeholder="Paste text, code or a long AI answer…"
          aria-label="Material to break down"
          className="rounded-2xl border border-border-subtle px-4 py-3 font-mono text-xs"
        />
      )}
      {(kind === "pdf" || kind === "pptx") && (
        <input
          key={kind}
          type="file"
          accept={kind === "pdf" ? "application/pdf" : ".pptx"}
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          aria-label={kind === "pdf" ? "PDF file" : "PowerPoint file"}
          className="rounded-2xl border border-dashed border-border-subtle px-4 py-6 text-sm"
        />
      )}
      {kind === "repo" && (
        <input
          value={ref}
          onChange={(e) => setRef(e.target.value)}
          placeholder="github.com/owner/repo (public)"
          aria-label="GitHub repository"
          className="rounded-2xl border border-border-subtle px-4 py-3 text-sm"
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-ink-muted">
          Explain in
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="rounded-full border border-border-subtle bg-white px-3 py-1.5 text-sm text-ink"
          >
            {LANGUAGES.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={submit}
          disabled={!ready || isPending}
          className="rounded-full bg-ink px-6 py-3 text-sm font-bold text-white transition-transform hover:-translate-y-0.5 disabled:opacity-40 disabled:hover:translate-y-0"
        >
          {isPending ? (status ?? "Working…") : <>Map it <ArrowRight /></>}
        </button>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
