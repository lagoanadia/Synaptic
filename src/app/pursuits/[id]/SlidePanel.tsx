"use client";

import { useEffect, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { SlidesIcon, XIcon } from "@/app/icons";
import { slideSourceFor } from "@/lib/slides";
import { listClassroomFiles, saveSlideDeck } from "./actions";
import { PdfSlides } from "./PdfSlides";

type Deck = { name: string; url: string };

// Width of the slides column, in % of the row.
const WIDTHS = { S: 32, M: 45, L: 60 };
const store = {
  get(key: string) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, v: string) {
    try {
      window.localStorage.setItem(key, v);
    } catch {}
  },
};

// Slides beside whatever you're writing (wraps the editor as children).
// Drag the divider to resize, collapse to a tab, or close. Remembers the
// deck and width per subject.
export function SlidePanel({
  pursuitId,
  decks,
  classroomCourseId,
  children,
}: {
  pursuitId: string;
  decks: Deck[];
  classroomCourseId: string | null;
  children: React.ReactNode;
}) {
  const key = `synaptic.slides.${pursuitId}`;
  const [deck, setDeck] = useState<Deck | null>(null);
  const [width, setWidth] = useState(WIDTHS.M);
  const [collapsed, setCollapsed] = useState(false);
  const [picking, setPicking] = useState(false);
  const [classroom, setClassroom] = useState<Deck[] | null>(null);
  const [link, setLink] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const row = useRef<HTMLDivElement>(null);

  // Browser storage, so only after mount.
  useEffect(() => {
    try {
      const saved = JSON.parse(store.get(key) ?? "null");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved?.deck) setDeck(saved.deck);
      if (saved?.width) setWidth(saved.width);
      if (saved?.collapsed) setCollapsed(true);
    } catch {}
  }, [key]);
  useEffect(() => {
    store.set(key, JSON.stringify({ deck, width, collapsed }));
  }, [key, deck, width, collapsed]);

  function open(d: Deck) {
    if (!slideSourceFor(d.url)) return setStatus("Use a Google Slides / Drive link, .pptx or .pdf");
    setDeck(d);
    setPicking(false);
    setCollapsed(false);
    setStatus(null);
  }

  async function startPicking() {
    setPicking(true);
    setCollapsed(false);
    if (classroomCourseId && !classroom) {
      const r = await listClassroomFiles(classroomCourseId);
      setClassroom((r.files ?? []).filter((f) => slideSourceFor(f.url)).map((f) => ({ name: f.title, url: f.url })));
    }
  }

  async function uploadDeck(file: File) {
    setStatus("Uploading…");
    try {
      const blob = await upload(`slides/${pursuitId}/${file.name}`, file, {
        access: "public",
        handleUploadUrl: "/api/blob-upload",
        clientPayload: JSON.stringify({ pursuitId, kind: "slides" }),
      });
      await saveSlideDeck(pursuitId, file.name, blob.url, file.size);
      open({ name: file.name, url: blob.url });
    } catch {
      setStatus("Couldn't upload that (.pptx or .pdf)");
    }
  }

  // Drag the divider to resize.
  const dragging = useRef(false);
  function onDividerMove(e: React.PointerEvent) {
    if (!dragging.current || !row.current) return;
    const r = row.current.getBoundingClientRect();
    setWidth(Math.min(70, Math.max(22, ((e.clientX - r.left) / r.width) * 100)));
  }

  const source = deck ? slideSourceFor(deck.url) : null;
  const open_ = (deck || picking) && !collapsed;

  if (!deck && !picking) {
    return (
      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={startPicking}
          className="flex items-center gap-2 self-start rounded-full bg-chip px-4 py-2 text-sm font-semibold text-ink-muted hover:text-ink"
        >
          <SlidesIcon /> Slides
        </button>
        {children}
      </div>
    );
  }

  return (
    <div
      ref={row}
      className="flex flex-col gap-4 lg:grid lg:items-start lg:gap-0"
      style={{ gridTemplateColumns: open_ ? `${width}% 14px minmax(0,1fr)` : "48px 14px minmax(0,1fr)" }}
    >
      {open_ ? (
        <section
          className="flex flex-col overflow-hidden rounded-2xl border border-border-subtle bg-white lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)]"
          aria-label="Slides"
        >
          <div className="flex flex-wrap items-center gap-2 border-b border-border-subtle px-3 py-2 text-sm">
            <span className="min-w-0 flex-1 truncate font-semibold">{deck?.name ?? "Slides"}</span>
            <span className="hidden rounded-full bg-chip p-0.5 text-xs lg:flex">
              {(Object.keys(WIDTHS) as (keyof typeof WIDTHS)[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setWidth(WIDTHS[k])}
                  aria-pressed={Math.round(width) === WIDTHS[k]}
                  className={`rounded-full px-2.5 py-0.5 ${Math.round(width) === WIDTHS[k] ? "bg-white shadow-sm" : "text-ink-muted"}`}
                >
                  {k}
                </button>
              ))}
            </span>
            <button type="button" onClick={() => (picking ? setPicking(false) : startPicking())} className="rounded-full px-3 py-1 text-xs text-ink-muted hover:bg-chip">
              {picking ? "Done" : "Change"}
            </button>
            {deck && (
              <button type="button" onClick={() => setCollapsed(true)} className="rounded-full px-3 py-1 text-xs text-ink-muted hover:bg-chip">
                Hide
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setDeck(null);
                setPicking(false);
              }}
              aria-label="Close slides"
              className="rounded-full px-2 py-1 text-ink-muted hover:bg-chip"
            >
              <XIcon />
            </button>
          </div>

          {picking && (
            <div className="flex flex-col gap-3 border-b border-border-subtle p-3 text-sm">
              {decks.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {decks.map((d) => (
                    <button key={d.url} type="button" onClick={() => open(d)} className="max-w-64 truncate rounded-full bg-chip px-3 py-1 hover:text-tile-sky">
                      {d.name}
                    </button>
                  ))}
                </div>
              )}
              {classroomCourseId && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-semibold text-ink-muted">Classroom</span>
                  {classroom === null ? (
                    <span className="text-xs text-ink-faint">…</span>
                  ) : (
                    classroom.map((d) => (
                      <button key={d.url} type="button" onClick={() => open(d)} className="max-w-64 truncate rounded-full bg-chip px-3 py-1 hover:text-tile-sky">
                        {d.name}
                      </button>
                    ))
                  )}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={fileInput}
                  type="file"
                  accept=".pptx,.pdf"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (f) uploadDeck(f);
                  }}
                />
                <button type="button" onClick={() => fileInput.current?.click()} className="rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-white">
                  Upload
                </button>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (link.trim()) open({ name: "Slides", url: link.trim() });
                  }}
                  className="flex min-w-48 flex-1 gap-1.5"
                >
                  <input
                    value={link}
                    onChange={(e) => setLink(e.target.value)}
                    placeholder="Google Slides / Drive link"
                    aria-label="Slides link"
                    className="flex-1 rounded-full border border-border-subtle px-3 py-1.5 text-xs"
                  />
                </form>
              </div>
              {status && <p className="text-xs text-ink-muted">{status}</p>}
            </div>
          )}

          {source && (
            <div className="min-h-[50vh] flex-1 bg-[#2a2a2a]">
              {source.kind === "pdf" ? (
                <PdfSlides src={source.src} />
              ) : (
                <iframe
                  key={source.src}
                  src={source.src}
                  title={deck?.name ?? "Slides"}
                  className="h-full min-h-[50vh] w-full border-0"
                  allow="fullscreen"
                  referrerPolicy="no-referrer"
                />
              )}
            </div>
          )}
        </section>
      ) : (
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          title="Show slides"
          className="flex items-center justify-center gap-2 rounded-2xl bg-chip py-3 text-ink-muted hover:text-ink lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)] lg:flex-col"
        >
          <SlidesIcon size={18} />
        </button>
      )}

      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Drag to resize the slides"
        onPointerDown={(e) => {
          if (!open_) return;
          (e.target as Element).setPointerCapture(e.pointerId);
          dragging.current = true;
        }}
        onPointerMove={onDividerMove}
        onPointerUp={() => (dragging.current = false)}
        className={`hidden h-[calc(100vh-2rem)] items-center justify-center lg:sticky lg:top-4 lg:flex ${open_ ? "cursor-col-resize" : ""}`}
      >
        {open_ && <span className="h-12 w-1 rounded-full bg-ink-faint/50" />}
      </div>

      <div className="min-w-0">{children}</div>
    </div>
  );
}
