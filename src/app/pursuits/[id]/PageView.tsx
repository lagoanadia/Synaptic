"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckIcon, SlidesIcon } from "@/app/icons";
import { RichEditor } from "../../editor/RichEditor";
import { splitTitle, withTitle } from "@/lib/text";
import { uploadToBlob } from "@/lib/blobUpload";
import { SlidePanel } from "./SlidePanel";
import type { TermHint } from "@/lib/terms";
import {
  addToMap,
  askPursuit,
  cardFromSelection,
  deleteBrainDump,
  deleteNote,
  generateFlashcards,
  organizeDumps,
  updateBrainDump,
  updateNote,
} from "./actions";

type Props = {
  pursuit: { id: string; title: string };
  crumbs: { label: string; href?: string }[];
  dump: { id: string; content: string; updatedAt: string } | null;
  note: { id: string; content: string; updatedAt: string } | null;
  slides: { decks: { name: string; url: string }[]; classroomCourseId: string | null; classroomUnit: string | null };
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
export function PageView({ pursuit, crumbs, dump, note, slides, terms }: Props) {
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
  const versions = useRef({ organized: note?.updatedAt ?? "", original: dump?.updatedAt ?? "" });
  const [split, setSplit] = useState(false);
  const [saved, setSaved] = useState(false);
  const [menu, setMenu] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const back = `/pursuits/${pursuit.id}`;

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
    <article className="flex min-w-0 flex-col gap-4">
      <input
        value={titles[view]}
        onChange={(e) => {
          setTitles((t) => ({ ...t, [view]: e.target.value }));
          setDirty((d) => ({ ...d, [view]: true }));
        }}
        placeholder="Sin título"
        aria-label="Título"
        className="w-full bg-transparent text-[2.1rem] leading-tight font-bold tracking-tight outline-none placeholder:text-ink-faint/50"
      />
      <RichEditor
        key={view}
        bare
        initialText={content}
        onChange={(t) => {
          setDrafts((d) => ({ ...d, [view]: t }));
          setDirty((d) => ({ ...d, [view]: true }));
        }}
        onUploadImage={(file) => uploadToBlob(pursuit.id, file, file.name, "image")}
        onAsk={(text) => askPursuit(pursuit.id, `Explícame esto de forma sencilla: "${text}"`)}
        onCard={(text) => cardFromSelection(pursuit.id, text, note?.id ?? null)}
        onMap={async (text) => {
          const r = await addToMap(pursuit.id, { dumpId: dump?.id ?? null, noteId: note?.id ?? null }, text);
          if (!r.error) router.refresh();
          return r;
        }}
        terms={terms}
        placeholder="Escribe, o pulsa / para añadir un bloque"
      />
    </article>
  );

  return (
    <div className={`mx-auto flex w-full flex-1 flex-col gap-6 px-6 py-8 sm:px-12 ${split ? "max-w-[1800px]" : "max-w-[900px]"}`}>
      <header className="flex items-center gap-3">
        <nav className="min-w-0 flex-1 truncate text-sm text-ink-faint" aria-label="Ruta">
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
            <span className="flex rounded-lg bg-white p-0.5 shadow-[0_0_0_1px_rgba(15,15,15,.06),0_2px_6px_rgba(15,15,15,.06)]" role="tablist" aria-label="Versión">
              {(["organized", "original"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  role="tab"
                  aria-selected={view === v}
                  title={v === "organized" ? "Organizada" : "Original"}
                  aria-label={v === "organized" ? "Organizada" : "Original"}
                  onClick={() => setView(v)}
                  className={`grid size-7 place-items-center rounded-md ${view === v ? "bg-chip text-ink" : "text-ink-faint hover:text-ink"}`}
                >
                  {v === "organized" ? <SparklesIcon /> : <PencilIcon />}
                </button>
              ))}
            </span>
          ) : (
            dump && (
              <button type="button" disabled={pending} onClick={() => run(() => organizeDumps(pursuit.id, [dump.id]))} title="Organizar" aria-label="Organizar" className={icon}>
                <SparklesIcon />
              </button>
            )
          )}
          <button
            type="button"
            onClick={() => setSplit((s) => !s)}
            aria-pressed={split}
            title="Diapositivas al lado"
            aria-label="Diapositivas al lado"
            className={`${icon} ${split ? "bg-accent-soft text-accent hover:bg-accent-soft hover:text-accent" : ""}`}
          >
            <SlidesIcon size={17} />
          </button>
          <button type="button" onClick={save} disabled={!dirty[view] || pending} title="Guardar (Ctrl+S)" aria-label="Guardar" className={icon}>
            <SaveIcon />
          </button>
          <span className={`grid size-7 place-items-center rounded-full bg-[#e8f3ec] text-[#448361] transition-opacity duration-300 ${saved ? "opacity-100" : "opacity-0"}`} aria-live="polite">
            {saved && <CheckIcon size={14} className="block" />}
            <span className="sr-only">{saved ? "Guardado" : ""}</span>
          </span>
          <button type="button" onClick={() => setMenu((m) => !m)} aria-label="Más" title="Más" className={icon}>
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
                    }, "Tarjetas añadidas");
                  }}
                  className="block w-full rounded-md px-2.5 py-1.5 text-left hover:bg-chip"
                >
                  Crear tarjetas
                </button>
              )}
              <a
                href={`/pursuits/${pursuit.id}/print?${dump ? `dump=${dump.id}` : `note=${note!.id}`}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-md px-2.5 py-1.5 hover:bg-chip"
              >
                Descargar PDF
              </a>
              <button
                type="button"
                onClick={() => {
                  if (!window.confirm("¿Eliminar esta página? No se puede deshacer.")) return;
                  start(async () => {
                    if (dump) await deleteBrainDump(pursuit.id, dump.id);
                    else if (note) await deleteNote(pursuit.id, note.id);
                    router.push(back);
                  });
                }}
                className="block w-full rounded-md px-2.5 py-1.5 text-left text-red-600 hover:bg-chip"
              >
                Eliminar
              </button>
            </div>
          )}
        </div>
      </header>
      {message && <p className="text-sm text-ink-muted">{message}</p>}

      {split ? (
        <SlidePanel
          pursuitId={pursuit.id}
          decks={slides.decks}
          classroomCourseId={slides.classroomCourseId}
          classroomUnit={slides.classroomUnit}
          dumpId={dump?.id}
          onClose={() => setSplit(false)}
        >
          <div className="lg:pl-6">{page}</div>
        </SlidePanel>
      ) : (
        page
      )}
    </div>
  );
}
