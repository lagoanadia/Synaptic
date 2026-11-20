"use client";

import { useT } from "@/app/LangProvider";
import { useEffect, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { SlidesIcon, XIcon } from "@/app/icons";
import { explicitUnit, isSlideTitle, slideSourceFor } from "@/lib/slides";
import { listClassroomFiles, saveSlideDeck } from "./actions";
import { PdfSlides } from "./PdfSlides";
import { deleteLocalPdf, getLocalPdf, saveLocalPdf } from "@/lib/localPdf";

// unit: from the Classroom post it came in ("UD2 · …"), when it says.
type Deck = { name: string; url: string; unit?: string | null };

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

// Slides and PDFs beside whatever you're writing (wraps the editor as
// children), as many as you like, in tabs: "+" adds one (yours, Classroom,
// a link or an upload; or drop a file on the panel), × closes it. Drag the
// divider to resize, collapse to a tab, or close. Remembers the open tabs
// and width per page.
export function SlidePanel({
  pursuitId,
  decks,
  classroomCourseId,
  classroomUnit = null,
  dumpId,
  onClose,
  request = null,
  onTranscribe,
  onAddText,
  children,
}: {
  pursuitId: string;
  decks: Deck[];
  classroomCourseId: string | null;
  // The page's unit maps to this Classroom unit ("UD2"): show only its slides.
  classroomUnit?: string | null;
  // Editing an existing page: uploads are attached to it.
  dumpId?: string;
  // Opened from a toggle elsewhere: no button of its own; ✕ hands back.
  onClose?: () => void;
  // Open this one now (a PDF card clicked in the page); `n` makes a repeat count.
  request?: { name: string; url: string; n: number } | null;
  // Selected part of a slide (JPEG data URL) → into the note; an error or null.
  onTranscribe?: (image: string, page: number) => Promise<string | null>;
  // Text selected in a PDF (lines with sizes) → structured into the note.
  onAddText?: (lines: string) => Promise<string | null>;
  children: React.ReactNode;
}) {
  const t = useT();
  const [showAllUnits, setShowAllUnits] = useState(false);
  // A copy of a Google file's PDF opened from this device (kept in the
  // browser, never uploaded), so its text can be selected. Keyed by link.
  const [local, setLocal] = useState<{ key: string; url: string } | null>(null);
  const localInput = useRef<HTMLInputElement>(null);
  const key = `synaptic.slides.${pursuitId}${dumpId ? `.${dumpId}` : ""}`;
  const [tabs, setTabs] = useState<Deck[]>([]);
  const [deck, setDeck] = useState<Deck | null>(null);
  const [dropping, setDropping] = useState(false);
  const [width, setWidth] = useState(WIDTHS.M);
  const [collapsed, setCollapsed] = useState(false);
  const [picking, setPicking] = useState(false);
  const [classroom, setClassroom] = useState<Deck[] | null>(null);
  const [link, setLink] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const row = useRef<HTMLDivElement>(null);

  // Browser storage, so only after mount. Nothing is saved until this has
  // read what was there (saving first would wipe the tabs).
  const loaded = useRef<string | null>(null);
  useEffect(() => {
    try {
      // This page's own tabs, else what the subject had open last (older
      // saves kept a single deck).
      const saved = JSON.parse(store.get(key) ?? "null") ?? JSON.parse(store.get(`synaptic.slides.${pursuitId}`) ?? "null");
      const list: Deck[] = Array.isArray(saved?.tabs) ? saved.tabs : saved?.deck ? [saved.deck] : [];
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTabs(list);
      if (list.length) setDeck(list.find((d) => d.url === saved?.active) ?? list[0]);
      if (saved?.width) setWidth(saved.width);
      if (saved?.collapsed && !onClose) setCollapsed(true);
      if (!list.length && onClose) startPicking();
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => {
    // The first run for a page comes before its saved tabs are in state.
    if (loaded.current !== key) {
      loaded.current = key;
      return;
    }
    store.set(key, JSON.stringify({ tabs, active: deck?.url ?? null, width, collapsed }));
  }, [key, tabs, deck, width, collapsed]);

  // After the saved tabs are read (the effect above runs first).
  const requestN = request?.n;
  useEffect(() => {
    if (request) open({ name: request.name, url: request.url });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestN]);

  function open(d: Deck) {
    if (!slideSourceFor(d.url)) return setStatus(t("Usa un enlace de Google Slides / Drive, un .pptx o un .pdf"));
    setTabs((ts) => (ts.some((x) => x.url === d.url) ? ts : [...ts, d]));
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
      setClassroom(
        (r.files ?? [])
          .filter((f) => isSlideTitle(f.title) && slideSourceFor(f.url))
          .map((f) => ({ name: f.title, url: f.url, unit: f.post ? explicitUnit(f.post) : null })),
      );
    }
  }

  async function uploadDeck(file: File) {
    setStatus("Subiendo…");
    try {
      const blob = await upload(`slides/${pursuitId}/${file.name}`, file, {
        access: "public",
        handleUploadUrl: "/api/blob-upload",
        clientPayload: JSON.stringify({ pursuitId, kind: "slides" }),
      });
      await saveSlideDeck(pursuitId, file.name, blob.url, file.size, dumpId);
      open({ name: file.name, url: blob.url });
    } catch {
      setStatus(t("No se ha podido subir (.pptx o .pdf)"));
    }
  }

  function closeTab(d: Deck) {
    const rest = tabs.filter((x) => x.url !== d.url);
    setTabs(rest);
    if (deck?.url === d.url) setDeck(rest[rest.length - 1] ?? null);
    if (!rest.length && onClose) onClose();
  }

  // Drag the divider to resize.
  const dragging = useRef(false);
  function onDividerMove(e: React.PointerEvent) {
    if (!dragging.current || !row.current) return;
    const r = row.current.getBoundingClientRect();
    setWidth(Math.min(70, Math.max(22, ((e.clientX - r.left) / r.width) * 100)));
  }

  const source = deck ? slideSourceFor(deck.url) : null;
  const deckUrl = deck?.url ?? null;
  useEffect(() => {
    if (!deckUrl) return;
    let made: string | null = null;
    let live = true;
    getLocalPdf(deckUrl).then((b) => {
      if (!live || !b) return;
      made = URL.createObjectURL(b);
      setLocal({ key: deckUrl, url: made });
    });
    return () => {
      live = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [deckUrl]);
  const localUrl = local && local.key === deckUrl ? local.url : null;
  const open_ = (deck || picking) && !collapsed;

  if (!deck && !picking) {
    if (onClose) return <>{children}</>;
    return (
      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={startPicking}
          className="flex items-center gap-2 self-start rounded-full bg-chip px-4 py-2 text-sm font-semibold text-ink-muted hover:text-ink"
        >
          <SlidesIcon />{" "}{t("Diapositivas")}
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
          className={`flex flex-col overflow-hidden rounded-2xl border bg-white lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)] ${dropping ? "border-[#2383e2] ring-2 ring-[#2383e2]/40" : "border-border-subtle"}`}
          aria-label={t("Diapositivas")}
          // Drop a PDF or .pptx anywhere on the panel to add it as a tab.
          onDragOver={(e) => {
            if (!e.dataTransfer.types.includes("Files")) return;
            e.preventDefault();
            setDropping(true);
          }}
          onDragLeave={() => setDropping(false)}
          onDrop={(e) => {
            setDropping(false);
            const files = [...e.dataTransfer.files].filter((f) => /\.(pdf|pptx)$/i.test(f.name));
            if (!files.length) return;
            e.preventDefault();
            files.forEach((f) => uploadDeck(f));
          }}
        >
          <div className="flex flex-wrap items-center gap-2 border-b border-border-subtle px-3 py-2 text-sm">
            <span className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto" role="tablist" aria-label={t("Documentos")}>
              {tabs.map((d) => (
                <span key={d.url} className={`group flex shrink-0 items-center rounded-md text-xs ${deck?.url === d.url ? "bg-chip font-semibold text-ink" : "text-ink-muted hover:bg-chip/60"}`}>
                  <button type="button" role="tab" aria-selected={deck?.url === d.url} onClick={() => open(d)} title={d.name} className="max-w-40 truncate py-1 pl-2">
                    {d.name}
                  </button>
                  <button type="button" onClick={() => closeTab(d)} aria-label={t("Cerrar {0}", { 0: d.name })} className="px-1.5 py-1 opacity-40 group-hover:opacity-100 hover:text-ink">
                    ×
                  </button>
                </span>
              ))}
              {!tabs.length && <span className="truncate font-semibold">{t("Diapositivas")}</span>}
              <button type="button" onClick={() => (picking ? setPicking(false) : startPicking())} aria-label={t("Añadir PDF o slides")} title={t("Añadir PDF o slides")} className={`shrink-0 rounded-md px-2 py-1 text-xs ${picking ? "bg-ink text-white" : "text-ink-muted hover:bg-chip"}`}>
                +
              </button>
            </span>
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
            {deck && !onClose && (
              <button type="button" onClick={() => setCollapsed(true)} className="rounded-full px-3 py-1 text-xs text-ink-muted hover:bg-chip">
                {t("Ocultar")}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setPicking(false);
                if (onClose) return onClose();
                setDeck(null);
                setTabs([]);
              }}
              aria-label={t("Cerrar diapositivas")}
              className="rounded-full px-2 py-1 text-ink-muted hover:bg-chip"
            >
              <XIcon />
            </button>
          </div>

          {picking && (
            <div className="flex flex-col gap-3 border-b border-border-subtle p-3 text-sm">
              {/* Yours and Classroom's together, one row per unit (UD1, UD2…),
                  without repeats, each chip a short name plus its type. */}
              {(() => {
                const seen = new Set<string>();
                const all = [...decks, ...(classroom ?? [])].filter((d) => {
                  const k = d.name.trim().toLowerCase();
                  if (seen.has(d.url) || seen.has(k)) return false;
                  seen.add(d.url);
                  seen.add(k);
                  return true;
                });
                const groups = new Map<string, Deck[]>();
                for (const d of all) {
                  // "UD1" in the file name wins; then the Classroom post's unit (a
                  // file can be posted again later). A topic ("T6") is not a
                  // unit, so it never makes one up: no unit → "Otros".
                  const u = explicitUnit(d.name) ?? d.unit ?? "";
                  if (classroomUnit && !showAllUnits && u !== classroomUnit) continue;
                  groups.set(u, [...(groups.get(u) ?? []), d]);
                }
                const units = [...groups.keys()].sort((x, y) => (x ? Number(x.slice(2)) : 999) - (y ? Number(y.slice(2)) : 999));
                return (
                  <div className="flex max-h-[45vh] flex-col gap-2.5 overflow-y-auto">
                    {classroomUnit && (
                      <button type="button" onClick={() => setShowAllUnits((v) => !v)} className="self-start rounded-full bg-chip px-2.5 py-0.5 text-xs text-ink-muted hover:text-ink">
                        {showAllUnits ? t("Solo {0}", { 0: classroomUnit }) : t("Ver todas las unidades")}
                      </button>
                    )}
                    {units.map((u) => (
                      <div key={u || "other"} className="flex gap-2">
                        <span className="w-12 shrink-0 pt-1 text-xs font-semibold text-ink-muted">{u || t("Otros")}</span>
                        <div className="flex min-w-0 flex-wrap gap-1.5">
                          {groups.get(u)!.map((d) => {
                            const ext = d.name.match(/\.(pdf|pptx?|key|odp)$/i)?.[1]?.toLowerCase();
                            const label = d.name.replace(/\.[a-z0-9]{2,5}$/i, "").replace(/^[A-Z]{2,5}[-_ ]?(?:UD|U|T)?\d{1,2}[-_ ]?/i, "").replace(/[-_]+/g, " ").trim() || d.name;
                            const on = tabs.some((x) => x.url === d.url);
                            return (
                              <button key={d.url} type="button" onClick={() => open(d)} title={d.name} className={`flex max-w-64 items-center gap-1.5 rounded-full px-3 py-1 text-xs ${on ? "bg-ink text-white" : "bg-chip hover:text-ink"}`}>
                                <span className="truncate">{label}</span>
                                {ext && <span className={`shrink-0 text-[10px] uppercase ${on ? "text-white/70" : "text-ink-faint"}`}>{ext}</span>}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                    {classroomCourseId && classroom === null && <span className="text-xs text-ink-faint">{t("Cargando Classroom…")}</span>}
                  </div>
                );
              })()}
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={fileInput}
                  type="file"
                  accept=".pptx,.pdf"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const files = [...(e.target.files ?? [])];
                    e.target.value = "";
                    files.forEach((f) => uploadDeck(f));
                  }}
                />
                <button type="button" onClick={() => fileInput.current?.click()} className="rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-white">
                  {t("Subir archivo")}
                </button>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (link.trim()) open({ name: "Diapositivas", url: link.trim() });
                  }}
                  className="flex min-w-48 flex-1 gap-1.5"
                >
                  <input
                    value={link}
                    onChange={(e) => setLink(e.target.value)}
                    placeholder={t("Enlace de Google Slides / Drive")}
                    aria-label={t("Enlace de diapositivas")}
                    className="flex-1 rounded-full border border-border-subtle px-3 py-1.5 text-xs"
                  />
                </form>
              </div>
              {status && <p className="text-xs text-ink-muted">{status}</p>}
            </div>
          )}

          {source && (
            <div className="min-h-[50vh] flex-1 bg-[#2a2a2a]">
              {source.kind === "pdf" || localUrl ? (
                <div className="flex h-full flex-col">
                  <div className="min-h-0 flex-1">
                    <PdfSlides key={localUrl ?? source.src} src={localUrl ?? source.src} onTranscribe={onTranscribe} onAddText={onAddText} />
                  </div>
                  {localUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        if (deckUrl) deleteLocalPdf(deckUrl);
                        setLocal(null);
                      }}
                      className="bg-white py-2 text-center text-xs text-ink-muted hover:text-ink"
                    >
                      {t("Volver a la vista de Google")}
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex h-full flex-col">
                  {/* Google's viewer can't share its text: a screenshot pasted
                      here becomes text (the AI reads it), or open the same
                      PDF from this device. */}
                  {onTranscribe && <SnipBar onTranscribe={onTranscribe} onLocal={() => localInput.current?.click()} />}
                  <input
                    ref={localInput}
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = "";
                      if (!f || !deckUrl) return;
                      saveLocalPdf(deckUrl, f);
                      setLocal({ key: deckUrl, url: URL.createObjectURL(f) });
                    }}
                  />
                  <iframe
                    key={source.src}
                    src={source.src}
                    title={deck?.name ?? t("Diapositivas")}
                    className="min-h-[50vh] w-full flex-1 border-0"
                    allow="fullscreen"
                    referrerPolicy="no-referrer"
                  />
                  {/* Safari (and other browsers that block third-party
                      cookies) can't show a private Drive file inside the
                      page: Google answers 400. Opening it there works. */}
                  {deck && (
                    <a href={deck.url} target="_blank" rel="noopener noreferrer" className="bg-white py-2 text-center text-xs text-ink-muted hover:text-ink">
                      {t("¿No se ve? Abrir en Google ↗")}
                    </a>
                  )}
                </div>
              )}
            </div>
          )}
        </section>
      ) : (
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          title={t("Mostrar diapositivas")}
          className="flex items-center justify-center gap-2 rounded-2xl bg-chip py-3 text-ink-muted hover:text-ink lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)] lg:flex-col"
        >
          <SlidesIcon size={18} />
        </button>
      )}

      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={t("Arrastra para cambiar el tamaño")}
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

// Over Google's viewer: paste a screenshot (Win+Shift+S / Cmd+Shift+4) and
// it goes into the page as text. Closable; remembered on this device.
const HIDE_KEY = "slides-snip-hidden";
function SnipBar({ onTranscribe, onLocal }: { onTranscribe: (image: string, page: number) => Promise<string | null>; onLocal: () => void }) {
  const t = useT();
  const [hidden, setHidden] = useState(() => {
    try {
      return typeof window !== "undefined" && localStorage.getItem(HIDE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [state, setState] = useState<"idle" | "wait" | "busy" | string>("idle");

  // A pasted (or clipboard) image → a JPEG small enough to send.
  const send = async (blob: Blob) => {
    setState("busy");
    try {
      const bmp = await createImageBitmap(blob);
      const k = Math.min(1, 1800 / Math.max(bmp.width, bmp.height));
      const c = document.createElement("canvas");
      c.width = Math.round(bmp.width * k);
      c.height = Math.round(bmp.height * k);
      c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
      const err = await onTranscribe(c.toDataURL("image/jpeg", 0.9), 0);
      setState(err ?? "done");
    } catch {
      setState(t("No he podido leer esa imagen"));
    }
  };

  // While waiting, Ctrl+V anywhere takes the image.
  useEffect(() => {
    if (state !== "wait") return;
    const onPaste = (e: ClipboardEvent) => {
      const file = [...(e.clipboardData?.files ?? [])].find((f) => f.type.startsWith("image/"));
      if (!file) return;
      e.preventDefault();
      e.stopPropagation();
      send(file);
    };
    window.addEventListener("paste", onPaste, true);
    return () => window.removeEventListener("paste", onPaste, true);
  });

  async function start() {
    // The screenshot is probably already on the clipboard: read it straight away.
    try {
      for (const item of await navigator.clipboard.read()) {
        const type = item.types.find((x) => x.startsWith("image/"));
        if (type) return send(await item.getType(type));
      }
    } catch {
      // No permission or no image: ask for Ctrl+V instead.
    }
    setState("wait");
  }

  if (hidden && state === "idle") {
    return (
      <button type="button" onClick={() => setHidden(false)} className="self-end bg-transparent px-2 py-0.5 text-[11px] text-white/60 hover:text-white">
        {t("Copiar texto")}
      </button>
    );
  }
  return (
    <div className="flex items-center gap-2 bg-white px-3 py-1.5 text-xs text-ink-muted">
      {state === "busy" ? (
        <span>{t("Leyendo la captura…")}</span>
      ) : state === "wait" ? (
        <span className="font-medium text-ink">{t("Ahora pega la captura (Ctrl+V)")}</span>
      ) : (
        <>
          <button type="button" onClick={start} className="rounded-md bg-ink px-2.5 py-1 font-semibold text-white hover:opacity-90" title={t("Haz una captura (Win+Mayús+S) y pulsa aquí: la paso a texto en tu página")}>
            {t("Pegar captura como texto")}
          </button>
          <span className="hidden truncate sm:inline">{state === "done" ? t("Añadido a tu página ✓") : state !== "idle" ? state : t("Win+Mayús+S para recortar")}</span>
          <button type="button" onClick={onLocal} className="ml-auto shrink-0 hover:text-ink">
            {t("Abrir PDF del ordenador")}
          </button>
        </>
      )}
      <button
        type="button"
        aria-label={t("Cerrar")}
        onClick={() => {
          setState("idle");
          setHidden(true);
          try {
            localStorage.setItem(HIDE_KEY, "1");
          } catch {}
        }}
        className={`grid size-6 shrink-0 place-items-center rounded hover:bg-chip ${state === "busy" || state === "wait" ? "ml-auto" : ""}`}
      >
        ×
      </button>
    </div>
  );
}
