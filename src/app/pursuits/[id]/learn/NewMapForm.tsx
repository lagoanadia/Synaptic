"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createConceptMap } from "./actions";
import { pdfToText } from "@/lib/pdfText";
import { readPptx, slidesToText } from "@/lib/pptx";

type Kind = "text" | "pdf" | "pptx" | "notes" | "repo";

const KINDS: { kind: Kind; label: string; hint: string }[] = [
  { kind: "text", label: "Paste", hint: "Text, code, a long AI answer…" },
  { kind: "pptx", label: "PowerPoint", hint: "Your teacher's slides (.pptx)" },
  { kind: "pdf", label: "PDF", hint: "A chapter, an assignment" },
  { kind: "notes", label: "My notes", hint: "Everything organized in this subject" },
  { kind: "repo", label: "GitHub repo", hint: "A public repository" },
];

const LANGUAGES = ["English", "Español", "Deutsch", "Français"];

export function NewMapForm({ pursuitId, hasNotes }: { pursuitId: string; hasNotes: boolean }) {
  const router = useRouter();
  const [kind, setKind] = useState<Kind>("text");
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
      <div>
        <h2 className="text-lg font-extrabold">New concept map</h2>
        <p className="text-sm text-ink-muted">
          Give it something you want to actually understand. It gets split into small concepts you can
          explore in any order.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {KINDS.map((k) => (
          <button
            key={k.kind}
            type="button"
            onClick={() => setKind(k.kind)}
            aria-pressed={kind === k.kind}
            className={`flex flex-col rounded-2xl border-2 px-3 py-2.5 text-left transition-colors ${
              kind === k.kind ? "border-tile-sky bg-accent-soft" : "border-border-subtle hover:border-tile-sky"
            }`}
          >
            <span className="text-sm font-bold">{k.label}</span>
            <span className="text-xs text-ink-muted">{k.hint}</span>
          </button>
        ))}
      </div>

      {kind === "text" && (
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          placeholder="Paste anything here…"
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
      {kind === "notes" && (
        <p className="rounded-2xl bg-callout px-4 py-3 text-sm text-ink-muted">
          {hasNotes
            ? "Uses every organized note in this subject."
            : "This subject has no organized notes yet — write and Organize a page first."}
        </p>
      )}
      {kind === "repo" && (
        <input
          value={ref}
          onChange={(e) => setRef(e.target.value)}
          placeholder="github.com/owner/repo"
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
          {isPending ? (status ?? "Working…") : "Map it →"}
        </button>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
