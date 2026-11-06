"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowUpRight, TrashIcon, XIcon } from "@/app/icons";
import { RichContent } from "./RichContent";
import { RichEditor } from "../../editor/RichEditor";
import { DeleteButton } from "../DeleteButton";
import {
  addPageFile,
  deleteBrainDump,
  deleteNote,
  generateFlashcards,
  organizeDumps,
  removeAttachment,
  updateNote,
} from "./actions";

type Props = {
  pursuit: { id: string; title: string };
  title: string;
  unit: string | null;
  date: string;
  dump: { id: string; content: string } | null;
  note: { id: string; content: string; updatedAt: string; flashcards: number } | null;
  files: { id: string; name: string; url: string }[];
};

// One page: its organized version and its original (switch between them),
// its files and its actions, all in one place.
export function PageView({ pursuit, title, unit, date, dump, note, files }: Props) {
  const router = useRouter();
  const [view, setView] = useState<"organized" | "original">(note ? "organized" : "original");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note?.content ?? "");
  const [link, setLink] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  // Files panel: closed when there's nothing in it; your choice is remembered.
  const [filesOpen, setFilesOpen] = useState(files.length > 0);
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("synaptic.page.files");
      // Browser storage, so only after mount.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved !== null) setFilesOpen(saved === "1");
    } catch {}
  }, []);
  function toggleFiles() {
    setFilesOpen((o) => {
      try {
        window.localStorage.setItem("synaptic.page.files", o ? "0" : "1");
      } catch {}
      return !o;
    });
  }
  const back = `/pursuits/${pursuit.id}?tab=pages`;

  function run(fn: () => Promise<{ error: string | null } | void>, ok?: string) {
    setMessage(null);
    startTransition(async () => {
      const r = await fn();
      if (r && r.error) setMessage(r.error);
      else {
        if (ok) setMessage(ok);
        router.refresh();
      }
    });
  }

  const content = view === "organized" ? note?.content : dump?.content;

  return (
    <div className="mx-auto flex w-full max-w-[1800px] flex-1 flex-col gap-6 px-6 py-8 lg:px-14">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <Link href={back} className="flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
            <ArrowLeft /> {pursuit.title}
          </Link>
          <h1 className="text-3xl font-extrabold text-balance">{title}</h1>
          <div className="flex items-center gap-2 text-xs text-ink-muted">
            {unit && <span className="rounded-full bg-tile-sky px-2.5 py-0.5 font-semibold text-white">{unit}</span>}
            <span>{date}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {note && dump && (
            <span className="flex rounded-full bg-chip p-1 text-sm font-semibold" role="tablist" aria-label="Versión">
              {(["organized", "original"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  role="tab"
                  aria-selected={view === v}
                  onClick={() => {
                    setView(v);
                    setEditing(false);
                  }}
                  className={`rounded-full px-4 py-1.5 capitalize ${view === v ? "bg-white shadow-sm" : "text-ink-muted"}`}
                >
                  {v === "organized" ? "Organizada" : "Original"}
                </button>
              ))}
            </span>
          )}
          {!note && dump && (
            <button
              type="button"
              disabled={isPending}
              onClick={() => run(() => organizeDumps(pursuit.id, [dump.id]))}
              className="rounded-full bg-tile-blue px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {isPending ? "Organizando…" : "Organizar"}
            </button>
          )}
          {view === "original" && dump ? (
            <Link href={`/pursuits/${pursuit.id}/dump/${dump.id}/edit`} className="rounded-full bg-chip px-4 py-2 text-sm font-semibold">
              Editar
            </Link>
          ) : (
            note && (
              <button type="button" onClick={() => setEditing((e) => !e)} className="rounded-full bg-chip px-4 py-2 text-sm font-semibold">
                {editing ? "Cancelar" : "Editar"}
              </button>
            )
          )}
          {note && (
            <button
              type="button"
              disabled={isPending}
              onClick={() =>
                run(async () => {
                  const r = await generateFlashcards(pursuit.id, note.id);
                  return r.error ? r : { error: null };
                }, "Tarjetas añadidas")
              }
              className="rounded-full bg-chip px-4 py-2 text-sm font-semibold disabled:opacity-50"
            >
              Tarjetas{note.flashcards > 0 ? ` · ${note.flashcards}` : ""}
            </button>
          )}
          <button
            type="button"
            onClick={toggleFiles}
            aria-expanded={filesOpen}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${filesOpen ? "bg-ink text-white" : "bg-chip"}`}
          >
            Archivos{files.length > 0 ? ` · ${files.length}` : ""}
          </button>
          <a
            href={`/pursuits/${pursuit.id}/print?${dump ? `dump=${dump.id}` : `note=${note!.id}`}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full bg-chip px-4 py-2 text-sm font-semibold"
          >
            PDF
          </a>
          <DeleteButton
            action={async () => {
              if (dump) await deleteBrainDump(pursuit.id, dump.id);
              if (note && !dump) await deleteNote(pursuit.id, note.id);
            }}
            onSuccess={() => router.push(back)}
            confirmMessage="¿Eliminar esta página? No se puede deshacer."
            className="rounded-full p-2 text-ink-faint hover:bg-chip hover:text-red-600"
          >
            <TrashIcon size={16} title="Eliminar página" />
          </DeleteButton>
        </div>
      </header>
      {message && <p className="text-sm text-ink-muted">{message}</p>}

      <div className={`grid grid-cols-1 gap-6 ${filesOpen ? "lg:grid-cols-[minmax(0,1fr)_300px]" : ""}`}>
        <article className="min-w-0 rounded-3xl bg-white p-6 shadow-[0_1px_2px_rgba(13,13,13,0.06)] sm:p-10">
          {editing && note ? (
            <div className="flex flex-col gap-3">
              <RichEditor initialText={note.content} onChange={setDraft} autofocus />
              <button
                type="button"
                disabled={isPending}
                onClick={() =>
                  run(async () => {
                    const r = await updateNote(pursuit.id, note.id, draft, note.updatedAt);
                    if (!r.error) setEditing(false);
                    return r;
                  })
                }
                className="self-end rounded-full bg-ink px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Guardar
              </button>
            </div>
          ) : content ? (
            <RichContent content={content} paragraphClassName="text-base leading-relaxed whitespace-pre-line" />
          ) : (
            <p className="text-sm text-ink-muted">Página vacía.</p>
          )}
        </article>

        {filesOpen && (
        <aside className="flex flex-col gap-3 self-start" aria-label="Archivos">
          {files.map((f) => (
            <div key={f.id} className="group flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm shadow-[0_1px_2px_rgba(13,13,13,0.04)]">
              <a href={f.url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate font-semibold hover:text-accent">
                {f.name} <ArrowUpRight size={12} />
              </a>
              <button
                type="button"
                onClick={() => run(() => removeAttachment(pursuit.id, f.id))}
                aria-label={`Quitar ${f.name}`}
                className="text-ink-faint opacity-0 group-hover:opacity-100 hover:text-red-600 focus:opacity-100"
              >
                <XIcon size={14} />
              </button>
            </div>
          ))}
          {dump && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const url = link.trim();
                if (!url) return;
                setLink("");
                run(() => addPageFile(pursuit.id, dump.id, "", url));
              }}
              className="flex gap-2"
            >
              <input
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="+ Enlace (Drive, Classroom…)"
                aria-label="Añadir un enlace"
                className="min-w-0 flex-1 rounded-2xl border border-border-subtle bg-white px-4 py-2.5 text-sm"
              />
            </form>
          )}
        </aside>
        )}
      </div>
    </div>
  );
}
