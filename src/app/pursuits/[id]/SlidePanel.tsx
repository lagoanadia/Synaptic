"use client";

import { useEffect, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { slideSourceFor } from "@/lib/slides";
import { listClassroomFiles, saveSlideDeck } from "./actions";
import { PdfSlides } from "./PdfSlides";

type Deck = { name: string; url: string };

const HEIGHTS = { S: 220, M: 380, L: 560 };
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

// Slides docked above the editor: pick a deck (this subject's files,
// Classroom, an upload, a link), resize, hide or close it. Remembered per subject.
export function SlidePanel({
  pursuitId,
  decks,
  classroomCourseId,
}: {
  pursuitId: string;
  decks: Deck[];
  classroomCourseId: string | null;
}) {
  const key = `synaptic.slides.${pursuitId}`;
  const [deck, setDeck] = useState<Deck | null>(null);
  const [height, setHeight] = useState(HEIGHTS.M);
  const [collapsed, setCollapsed] = useState(false);
  const [picking, setPicking] = useState(false);
  const [classroom, setClassroom] = useState<Deck[] | null>(null);
  const [link, setLink] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // Restore what was open last time (browser storage, so after mount).
  useEffect(() => {
    try {
      const saved = JSON.parse(store.get(key) ?? "null");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved?.deck) setDeck(saved.deck);
      if (saved?.height) setHeight(saved.height);
      if (saved?.collapsed) setCollapsed(true);
    } catch {}
  }, [key]);
  useEffect(() => {
    store.set(key, JSON.stringify({ deck, height, collapsed }));
  }, [key, deck, height, collapsed]);

  function open(d: Deck) {
    if (!slideSourceFor(d.url)) return setStatus("That link can't be shown here (Google Slides, Drive, .pptx or .pdf only)");
    setDeck(d);
    setPicking(false);
    setCollapsed(false);
    setStatus(null);
  }

  async function loadClassroom() {
    if (!classroomCourseId || classroom) return;
    const r = await listClassroomFiles(classroomCourseId);
    setClassroom((r.files ?? []).filter((f) => slideSourceFor(f.url)).map((f) => ({ name: f.title, url: f.url })));
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
      setStatus("Couldn't upload that file — .pptx or .pdf");
    }
  }

  // Drag the bottom edge to resize.
  const drag = useRef<{ y: number; h: number } | null>(null);
  function onDragStart(e: React.PointerEvent) {
    (e.target as Element).setPointerCapture(e.pointerId);
    drag.current = { y: e.clientY, h: height };
  }
  function onDragMove(e: React.PointerEvent) {
    if (!drag.current) return;
    const max = Math.round(window.innerHeight * 0.8);
    setHeight(Math.min(max, Math.max(140, drag.current.h + e.clientY - drag.current.y)));
  }

  const source = deck ? slideSourceFor(deck.url) : null;

  if (!deck && !picking) {
    return (
      <button
        type="button"
        onClick={() => setPicking(true)}
        className="flex items-center gap-2 self-start rounded-full bg-chip px-4 py-2 text-sm font-semibold text-ink-muted hover:text-ink"
      >
        📊 Show slides while I write
      </button>
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-border-subtle bg-white" aria-label="Slides">
      <div className="flex flex-wrap items-center gap-2 border-b border-border-subtle px-3 py-2 text-sm">
        <span className="min-w-0 flex-1 truncate font-semibold">{deck?.name ?? "Pick slides"}</span>
        {deck && !collapsed && (
          <span className="flex rounded-full bg-chip p-0.5 text-xs">
            {(Object.keys(HEIGHTS) as (keyof typeof HEIGHTS)[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setHeight(HEIGHTS[k])}
                aria-pressed={height === HEIGHTS[k]}
                className={`rounded-full px-2.5 py-0.5 ${height === HEIGHTS[k] ? "bg-white shadow-sm" : "text-ink-muted"}`}
              >
                {k}
              </button>
            ))}
          </span>
        )}
        <button type="button" onClick={() => { setPicking((p) => !p); loadClassroom(); }} className="rounded-full px-3 py-1 text-xs text-ink-muted hover:bg-chip">
          {picking ? "Done" : "Change"}
        </button>
        {deck && (
          <button type="button" onClick={() => setCollapsed((c) => !c)} className="rounded-full px-3 py-1 text-xs text-ink-muted hover:bg-chip">
            {collapsed ? "Show" : "Hide"}
          </button>
        )}
        <button type="button" onClick={() => { setDeck(null); setPicking(false); }} aria-label="Close slides" className="rounded-full px-2 py-1 text-xs text-ink-muted hover:bg-chip">
          ✕
        </button>
      </div>

      {picking && (
        <div className="flex flex-col gap-3 border-b border-border-subtle p-3 text-sm">
          {decks.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-ink-muted">This subject</span>
              <div className="flex flex-wrap gap-1.5">
                {decks.map((d) => (
                  <button key={d.url} type="button" onClick={() => open(d)} className="max-w-64 truncate rounded-full bg-chip px-3 py-1 hover:text-tile-sky">{d.name}</button>
                ))}
              </div>
            </div>
          )}
          {classroomCourseId && (
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-ink-muted">From Classroom</span>
              {classroom === null ? (
                <span className="text-xs text-ink-faint">Loading…</span>
              ) : classroom.length === 0 ? (
                <span className="text-xs text-ink-faint">No slides found in this course.</span>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {classroom.map((d) => (
                    <button key={d.url} type="button" onClick={() => open(d)} className="max-w-64 truncate rounded-full bg-chip px-3 py-1 hover:text-tile-sky">{d.name}</button>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <input ref={fileInput} type="file" accept=".pptx,.pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) uploadDeck(f); }} />
            <button type="button" onClick={() => fileInput.current?.click()} className="rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-white">Upload .pptx / .pdf</button>
            <form onSubmit={(e) => { e.preventDefault(); if (link.trim()) open({ name: "Linked slides", url: link.trim() }); }} className="flex min-w-60 flex-1 gap-1.5">
              <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="…or paste a Google Slides / Drive link" aria-label="Slides link" className="flex-1 rounded-full border border-border-subtle px-3 py-1.5 text-xs" />
              <button type="submit" className="rounded-full bg-chip px-3 py-1.5 text-xs font-semibold">Open</button>
            </form>
          </div>
          {status && <p className="text-xs text-ink-muted">{status}</p>}
        </div>
      )}

      {source && !collapsed && (
        <>
          <div style={{ height }} className="bg-[#2a2a2a]">
            {source.kind === "pdf" ? (
              <PdfSlides src={source.src} />
            ) : (
              <iframe
                key={source.src}
                src={source.src}
                title={deck?.name ?? "Slides"}
                className="h-full w-full border-0"
                allow="fullscreen"
                referrerPolicy="no-referrer"
              />
            )}
          </div>
          <div
            role="separator"
            aria-orientation="horizontal"
            aria-label="Drag to resize the slides"
            onPointerDown={onDragStart}
            onPointerMove={onDragMove}
            onPointerUp={() => (drag.current = null)}
            className="flex h-3 cursor-row-resize touch-none items-center justify-center bg-chip hover:bg-accent-soft"
          >
            <span className="h-1 w-10 rounded-full bg-ink-faint" />
          </div>
        </>
      )}
    </section>
  );
}
