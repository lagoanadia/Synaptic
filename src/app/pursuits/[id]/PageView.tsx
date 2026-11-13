"use client";

import { useT } from "@/app/LangProvider";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckIcon, SlidesIcon } from "@/app/icons";
import { RichEditor } from "../../editor/RichEditor";
import { createBoard, generateMindMap } from "./boards";
import { splitTitle, withTitle } from "@/lib/text";
import { textToDoc } from "@/lib/richText";
import type { Editor } from "@tiptap/core";
import { uploadToBlob } from "@/lib/blobUpload";
import { SlidePanel } from "./SlidePanel";
import { ExportPdfDialog } from "./ExportPdfDialog";
import type { TermHint } from "@/lib/terms";
import {
  addToMap,
  askPursuit,
  cardFromSelection,
  deleteBrainDump,
  deleteNote,
  generateFlashcards,
  organizeDumps,
  reorganizeDump,
  updateBrainDump,
  structurePdfSelection, transcribeSlide,
  updateNote,
} from "./actions";

type Props = {
  pursuit: { id: string; title: string };
  crumbs: { label: string; href?: string }[];
  dump: { id: string; content: string; updatedAt: string } | null;
  note: { id: string; content: string; updatedAt: string } | null;
  slides: { decks: { name: string; url: string }[]; classroomCourseId: string | null; classroomUnit: string | null };
  // The handwritten version changed after it was organized.
  stale?: boolean;
  terms: TermHint[];
};

const SparklesIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden>
    <path d="M10 3.5 11.8 8l4.7 1.8-4.7 1.8L10 16l-1.8-4.4L3.5 9.8 8.2 8z" />
    <path d="M17.5 14l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z" />
  </svg>
);
const PencilIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden>
    <path d="M4 20h4L19 9l-4-4L4 16z" />
  </svg>
);
const SaveIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden>
    <path d="M5 4h11l3 3v13H5z" />
    <path d="M8 4v5h7V4M8 20v-6h8v6" />
  </svg>
);

// A page, editable in place. Top right, icons only: organized ✦ /
// original ✎, the slides split, save (Ctrl+S; a ✓ shows for a moment),
// and ⋯ for the rest.
export function PageView({ pursuit, crumbs, dump, note, slides, terms, stale: staleAtLoad = false }: Props) {
  const t = useT();
  const router = useRouter();
  const [view, setView] = useState<"organized" | "original">(note ? "organized" : "original");
  // The title has its own field; the editor holds the rest. Stored as the
  // content's first "# " line, like before.
  const [parts] = useState(() => ({ organized: splitTitle(note?.content ?? ""), original: splitTitle(dump?.content ?? "") }));
  const [drafts, setDrafts] = useState({ organized: parts.organized.body, original: parts.original.body });
  const [titles, setTitles] = useState({
    organized: parts.organized.title ?? parts.original.title ?? "",
    original: parts.original.title ?? parts.organized.title ?? "",
  });
  const [dirty, setDirty] = useState({ organized: false, original: false });
  const editorRef = useRef<Editor | null>(null);
  const versions = useRef({ organized: note?.updatedAt ?? "", original: dump?.updatedAt ?? "" });
  const [split, setSplit] = useState(false);
  const [saved, setSaved] = useState(false);
  const [menu, setMenu] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  // The handwritten version has changes the organized one doesn't have yet.
  const [stale, setStale] = useState(staleAtLoad);
  // Bumped to reload the editor after the organized text changes on the server.
  const [rev, setRev] = useState(0);

  // ✦ while it glows: add what's new in the handwritten version to the
  // organized one, keeping everything that was already there.
  function addNew() {
    if (!dump || !note) return;
    if (dirty.original || dirty.organized) return setMessage(t("Guarda primero (Ctrl+S) y vuelve a pulsar ✦"));
    setMessage(null);
    start(async () => {
      const r = await reorganizeDump(pursuit.id, dump.id);
      if (r.error || r.content === undefined) return setMessage(r.error ?? t("Inténtalo de nuevo"));
      const fresh = splitTitle(r.content);
      setDrafts((d) => ({ ...d, organized: fresh.body }));
      setTitles((tt) => ({ ...tt, organized: fresh.title ?? tt.organized }));
      if (r.updatedAt) versions.current.organized = r.updatedAt;
      setStale(false);
      setView("organized");
      setRev((n) => n + 1);
      setMessage(r.added ? t("Añadido lo nuevo a la versión organizada") : t("No había nada nuevo que añadir"));
    });
  }
  const [pending, start] = useTransition();
  const back = `/pursuits/${pursuit.id}`;

  // The note's saved version, kept in step with a newly arrived note.
  useEffect(() => {
    if (note) versions.current.organized = note.updatedAt;
  }, [note?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Organizing with AI creates the note after this page loaded: when it
  // arrives (or another note replaces it), load it and show it.
  const [noteId, setNoteId] = useState(note?.id ?? null);
  if ((note?.id ?? null) !== noteId) {
    setNoteId(note?.id ?? null);
    if (note) {
      const fresh = splitTitle(note.content);
      setDrafts((d) => ({ ...d, organized: fresh.body }));
      setTitles((t) => ({ ...t, organized: fresh.title ?? t.original }));
      setDirty((d) => ({ ...d, organized: false }));
      setView("organized");
    }
  }

  function save() {
    if (!dirty[view] || pending) return;
    const v = view;
    const text = withTitle(titles[v], drafts[v]);
    setMessage(null);
    start(async () => {
      let r: { error: string | null; updatedAt?: string };
      if (v === "organized" && note) r = await updateNote(pursuit.id, note.id, text, versions.current.organized);
      else if (dump) {
        const fd = new FormData();
        fd.set("content", text);
        fd.set("expectedUpdatedAt", versions.current.original);
        r = await updateBrainDump(pursuit.id, dump.id, { error: null }, fd);
      } else return;
      if (r.error) return setMessage(r.error);
      if (r.updatedAt) versions.current[v] = r.updatedAt;
      setDirty((d) => ({ ...d, [v]: false }));
      setSaved(true);
      if (v === "original" && note) setStale(true);
      // Lines typed or pasted as "- item" in a paragraph become a real list
      // (with their indentation) as soon as you save.
      const ed = editorRef.current;
      if (ed && v === view && /(^|\n)[ \t]*([-*•]|\d+[.)])\s+\S/.test(drafts[v])) {
        const doc = textToDoc(drafts[v]);
        if (JSON.stringify(doc.content?.map((n) => n.type)) !== JSON.stringify(ed.getJSON().content?.map((n) => n.type))) ed.commands.setContent(doc, { emitUpdate: false });
      }
    });
  }

  // The ✓ shows for a moment after each save.
  useEffect(() => {
    if (!saved) return;
    const t = window.setTimeout(() => setSaved(false), 1600);
    return () => window.clearTimeout(t);
  }, [saved]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        save();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Leaving with unsaved changes asks first.
  const anyDirty = dirty.organized || dirty.original;
  useEffect(() => {
    if (!anyDirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [anyDirty]);

  function run(fn: () => Promise<{ error: string | null } | void>, ok?: string) {
    setMessage(null);
    start(async () => {
      const r = await fn();
      if (r && r.error) setMessage(r.error);
      else {
        if (ok) setMessage(ok);
        router.refresh();
      }
    });
  }

  const icon = "grid size-8 place-items-center rounded-md text-ink-muted hover:bg-chip hover:text-ink disabled:opacity-40";
  const content = drafts[view];

  const page = (
    <article data-print-root className="flex min-w-0 flex-col gap-4">
      <input
        value={titles[view]}
        onChange={(e) => {
          setTitles((t) => ({ ...t, [view]: e.target.value }));
          setDirty((d) => ({ ...d, [view]: true }));
        }}
        placeholder={t("Sin título")}
        aria-label={t("Título")}
        className="w-full bg-transparent text-[2.1rem] leading-tight font-bold tracking-tight outline-none placeholder:text-ink-faint/50"
      />
      <RichEditor
        key={`${view}-${rev}`}
        editorRef={editorRef}
        bare
        initialText={content}
        onChange={(t) => {
          setDrafts((d) => ({ ...d, [view]: t }));
          setDirty((d) => ({ ...d, [view]: true }));
        }}
        onUploadImage={(file) => uploadToBlob(pursuit.id, file, file.name, "image")}
        onAsk={(text) => askPursuit(pursuit.id, t("Explícame esto de forma sencilla: \"{0}\"", { 0: text }))}
        onCard={(text) => cardFromSelection(pursuit.id, text, note?.id ?? null)}
        onMap={async (text) => {
          const r = await addToMap(pursuit.id, { dumpId: dump?.id ?? null, noteId: note?.id ?? null }, text);
          if (!r.error) router.refresh();
          return r;
        }}
        terms={terms}
        onBoard={() => createBoard(pursuit.id)}
        onMindMap={() => generateMindMap(pursuit.id, `${titles[view]}\n${drafts[view]}`)}
        placeholder={t("Escribe, o pulsa / para añadir un bloque")}
      />
    </article>
  );

  return (
    <div className={`mx-auto flex w-full flex-1 flex-col gap-6 px-6 py-8 sm:px-12 ${split ? "max-w-[1800px]" : "max-w-[900px]"}`}>
      <header className="flex items-center gap-3">
        <nav className="min-w-0 flex-1 truncate text-sm text-ink-faint" aria-label={t("Ruta")}>
          {crumbs.map((c, i) => (
            <span key={i}>
              {i > 0 && <span className="mx-1.5">/</span>}
              {c.href ? (
                <Link href={c.href} className="hover:text-ink hover:underline">
                  {c.label}
                </Link>
              ) : (
                <span className="text-ink-muted">{c.label}</span>
              )}
            </span>
          ))}
        </nav>
        <div className="relative flex items-center gap-1.5">
          {note && dump ? (
            <span className="flex rounded-lg bg-white p-0.5 shadow-[0_0_0_1px_rgba(15,15,15,.06),0_2px_6px_rgba(15,15,15,.06)]" role="tablist" aria-label={t("Versión")}>
              {(["organized", "original"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  role="tab"
                  aria-selected={view === v}
                  title={v === "organized" ? (stale ? t("Hay cambios: pulsa para añadir lo nuevo a la versión organizada") : t("Organizada")) : "Original"}
                  aria-label={v === "organized" ? t("Organizada") : "Original"}
                  onClick={() => (v === "organized" && stale ? addNew() : setView(v))}
                  className={`relative grid size-7 place-items-center rounded-md ${v === "organized" && stale ? "animate-pulse bg-accent-soft text-accent shadow-[inset_0_0_0_1.5px_var(--color-accent)]" : view === v ? "bg-chip text-ink" : "text-ink-faint hover:text-ink"}`}
                >
                  {v === "organized" ? <SparklesIcon /> : <PencilIcon />}
                </button>
              ))}
            </span>
          ) : (
            dump && (
              <button type="button" disabled={pending} onClick={() => run(() => organizeDumps(pursuit.id, [dump.id]))} title={t("Organizar")} aria-label={t("Organizar")} className={icon}>
                <SparklesIcon />
              </button>
            )
          )}
          <button
            type="button"
            onClick={() => setSplit((s) => !s)}
            aria-pressed={split}
            title={t("Diapositivas al lado")}
            aria-label={t("Diapositivas al lado")}
            className={`${icon} ${split ? "bg-accent-soft text-accent hover:bg-accent-soft hover:text-accent" : ""}`}
          >
            <SlidesIcon size={17} />
          </button>
          <button type="button" onClick={save} disabled={!dirty[view] || pending} title={t("Guardar (Ctrl+S)")} aria-label={t("Guardar")} className={icon}>
            <SaveIcon />
          </button>
          <span className={`grid size-7 place-items-center rounded-full bg-[#e8f3ec] text-[#448361] transition-opacity duration-300 ${saved ? "opacity-100" : "opacity-0"}`} aria-live="polite">
            {saved && <CheckIcon size={14} className="block" />}
            <span className="sr-only">{saved ? "Guardado" : ""}</span>
          </span>
          <button type="button" onClick={() => setMenu((m) => !m)} aria-label={t("Más")} title={t("Más")} className={icon}>
            ⋯
          </button>
          {menu && (
            <div className="absolute top-full right-0 z-20 mt-1 w-52 rounded-lg bg-white p-1 text-sm shadow-[0_0_0_1px_rgba(15,15,15,.05),0_10px_26px_rgba(15,15,15,.16)]">
              {note && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    setMenu(false);
                    run(async () => {
                      const r = await generateFlashcards(pursuit.id, note.id);
                      return r.error ? r : { error: null };
                    }, t("Tarjetas añadidas"));
                  }}
                  className="block w-full rounded-md px-2.5 py-1.5 text-left hover:bg-chip"
                >
                  {t("Crear tarjetas")}
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  // A styled A4 preview; Export prints it as a PDF.
                  setMenu(false);
                  setExporting(true);
                }}
                className="block w-full rounded-md px-2.5 py-1.5 text-left hover:bg-chip"
              >
                {t("Descargar PDF")}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!window.confirm(t("¿Eliminar esta página? No se puede deshacer."))) return;
                  start(async () => {
                    if (dump) await deleteBrainDump(pursuit.id, dump.id);
                    else if (note) await deleteNote(pursuit.id, note.id);
                    router.push(back);
                  });
                }}
                className="block w-full rounded-md px-2.5 py-1.5 text-left text-red-600 hover:bg-chip"
              >
                {t("Eliminar")}
              </button>
            </div>
          )}
        </div>
      </header>
      {message && <p className="text-sm text-ink-muted">{message}</p>}
      {exporting && <ExportPdfDialog title={titles[view].trim()} content={drafts[view]} onClose={() => setExporting(false)} />}

      {split ? (
        <SlidePanel
          pursuitId={pursuit.id}
          decks={slides.decks}
          classroomCourseId={slides.classroomCourseId}
          classroomUnit={slides.classroomUnit}
          dumpId={dump?.id}
          onClose={() => setSplit(false)}
          onTranscribe={async (image) => {
            const r = await transcribeSlide(pursuit.id, image);
            if (r.error || !r.text) return r.error ?? t("Inténtalo de nuevo");
            // Into the note where the cursor is (the end if it never was in it).
            editorRef.current?.chain().focus().insertContent(textToDoc(r.text).content ?? []).run();
            return null;
          }}
          onAddText={async (lines) => {
            const r = await structurePdfSelection(pursuit.id, lines);
            if (r.error || !r.text) return r.error ?? t("Inténtalo de nuevo");
            editorRef.current?.chain().focus().insertContent(textToDoc(r.text).content ?? []).run();
            return null;
          }}
        >
          <div className="lg:pl-6">{page}</div>
        </SlidePanel>
      ) : (
        page
      )}
    </div>
  );
}
