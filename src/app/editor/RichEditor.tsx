"use client";

import { ask } from "@/app/ui/PopupHost";
import { useT } from "@/app/LangProvider";
import type { T } from "@/lib/i18n";
import { ArrowDown, CardsIcon, CheckIcon, ImageIcon, LinkIcon, MapIcon, QuoteIcon, SparkIcon, TrashIcon, XIcon } from "@/app/icons";
import { BlockMoves, blockAt, deleteBlock, dropBlock, endDrag, moveBlock, startDrag } from "./blocks";
import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import { Extension, wrappingInputRule } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Node as PmNode } from "@tiptap/pm/model";
import StarterKit from "@tiptap/starter-kit";
import { CodeHighlight } from "./codeHighlight";
import { OrderedList } from "@tiptap/extension-list";
import { TableKit } from "@tiptap/extension-table";
import { ImageWithBoards } from "./Whiteboard";
import { TEXT_COLORS, TextColor } from "./textColor";
import { Column, Columns, convertBlock, setColumns, unsetColumns, type BlockKind } from "./columns";
import { Placeholder } from "@tiptap/extensions";
import { PdfCard, pdfTitle } from "./pdfCard";
import { Callout } from "./callout";
import { Indentation } from "./indentation";
import { docToText, textToDoc } from "@/lib/richText";
import { termMatches, type TermHint } from "@/lib/terms";

// Ordered lists can be numbered (1. 2.) or lettered (a. b.) — the stored
// format has both, so the editor needs to tell them apart.
const LetterableOrderedList = OrderedList.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      kind: {
        default: "decimal",
        parseHTML: (el) => (el.getAttribute("type") === "a" ? "alpha" : "decimal"),
        renderHTML: (attrs) => (attrs.kind === "alpha" ? { type: "a" } : {}),
      },
    };
  },
});

// Blockquotes are shown and stored as callouts; typing "! " starts one,
// same shortcut as before.
const CalloutShortcut = Extension.create({
  name: "calloutShortcut",
  addInputRules() {
    return [wrappingInputRule({ find: /^!\s$/, type: this.editor.schema.nodes.blockquote })];
  },
});

// Key terms: the first time each one appears gets a dotted underline
// (not stored; recomputed as you type or when the terms change).
type TermsState = { terms: string[]; decos: DecorationSet };
const termsKey = new PluginKey<TermsState>("keyTerms");
function termDecorations(doc: PmNode, terms: string[]) {
  if (terms.length === 0) return DecorationSet.empty;
  const seen = new Set<number>();
  const decos: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (node.type.name === "codeBlock" || node.type.name === "heading") return false;
    if (!node.isText || !node.text) return;
    for (const m of termMatches(node.text, terms, seen)) {
      decos.push(Decoration.inline(pos + m.from, pos + m.to, { class: "key-term", "data-term": String(m.index) }));
    }
  });
  return DecorationSet.create(doc, decos);
}
// The terms arrive with a transaction (meta) whenever they change.
const KeyTerms = Extension.create({
  name: "keyTerms",
  addProseMirrorPlugins() {
    return [
      new Plugin<TermsState>({
        key: termsKey,
        state: {
          init: () => ({ terms: [], decos: DecorationSet.empty }),
          apply: (tr, old) => {
            const terms = (tr.getMeta(termsKey) as string[] | undefined) ?? old.terms;
            return tr.docChanged || terms !== old.terms ? { terms, decos: termDecorations(tr.doc, terms) } : old;
          },
        },
        props: { decorations: (state) => termsKey.getState(state)?.decos },
      }),
    ];
  },
});

const CODE_LANGUAGES = [
  { value: "", label: "Texto", short: "Aa", color: "#8a8986" },
  { value: "js", label: "JavaScript", short: "JS", color: "#c9a300" },
  { value: "ts", label: "TypeScript", short: "TS", color: "#3178c6" },
  { value: "python", label: "Python", short: "PY", color: "#3a75a8" },
  { value: "java", label: "Java", short: "JV", color: "#c4542a" },
  { value: "sql", label: "SQL", short: "SQL", color: "#2f8f6b" },
];

// The code block's language: a chip that opens a small list.
function CodeLangMenu({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [open]);
  const cur = CODE_LANGUAGES.find((l) => l.value === value) ?? CODE_LANGUAGES[0];
  const badge = (l: (typeof CODE_LANGUAGES)[number]) => (
    <span className="grid h-[18px] min-w-[22px] place-items-center rounded px-1 font-mono text-[9px] font-bold text-white" style={{ background: l.color }}>
      {l.short}
    </span>
  );
  return (
    <span ref={box} className="relative">
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((o) => !o)}
        aria-label={t("Lenguaje del código")}
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-md bg-chip py-1 pr-1.5 pl-1 text-xs font-medium text-ink hover:bg-[#e7e5e0]"
      >
        {badge(cur)}
        {t(cur.label)}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden className="text-ink-faint">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <span role="listbox" className="absolute top-full left-0 z-30 mt-1.5 flex w-44 flex-col rounded-xl border border-border-subtle bg-white p-1 shadow-[0_12px_32px_-8px_rgba(0,0,0,.25)]">
          {CODE_LANGUAGES.map((l) => (
            <button
              key={l.value}
              type="button"
              role="option"
              aria-selected={l.value === value}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(l.value);
                setOpen(false);
              }}
              className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] ${l.value === value ? "bg-chip font-medium" : "hover:bg-chip"}`}
            >
              {badge(l)}
              <span className="flex-1">{t(l.label)}</span>
              {l.value === value && <CheckIcon size={13} className="text-ink" />}
            </button>
          ))}
        </span>
      )}
    </span>
  );
}

// WYSIWYG editor with markdown shortcuts ("# ", "- ", "1. ", "! ", "**b**").
// Reads and writes the stored text format (lib/richText.ts).
export function RichEditor({
  initialText,
  onChange,
  onUploadImage,
  onUploadPdf,
  placeholder: placeholderProp,
  editorRef,
  toolbarExtras,
  autofocus = false,
  bare = false,
  onAsk,
  onCard,
  onMap,
  onRewrite,
  terms = [],
  onBoard,
  onMindMap,
  onImageToText,
}: {
  initialText: string;
  onChange: (text: string) => void;
  // Uploads an image and returns its URL; enables paste/drop/button.
  onUploadImage?: (file: File) => Promise<string>;
  // A PDF → its URL; it goes in as a card that opens beside the page.
  onUploadPdf?: (file: File) => Promise<string>;
  placeholder?: string;
  // Lets the parent insert things (voice transcripts, PDF pages).
  editorRef?: React.RefObject<Editor | null>;
  toolbarExtras?: React.ReactNode;
  autofocus?: boolean;
  // Notion-style: no fixed toolbar; "/" opens a block menu and selecting
  // text shows formatting plus "Preguntar a la IA" / "Crear tarjeta".
  bare?: boolean;
  onAsk?: (text: string) => Promise<{ error: string | null; answer?: string }>;
  onCard?: (text: string) => Promise<{ error: string | null }>;
  // "Añadir al mapa" on a selection; returns the new concept's link.
  onMap?: (text: string) => Promise<{ error: string | null; href?: string }>;
  // The AI rewrites the selected text (better, corrected, shorter, simpler).
  onRewrite?: (text: string, mode: RewriteMode) => Promise<{ error: string | null; text?: string }>;
  // Words that name a concept on a map: underlined, with a card on hover.
  terms?: TermHint[];
  // "/ Pizarra": makes a board and returns its image URL.
  onBoard?: () => Promise<string>;
  // Toolbar mind map: the AI maps the page into a board (its URL) or an error.
  onMindMap?: () => Promise<{ error: string | null; src?: string }>;
  // A pasted screenshot can be turned into text: the image (a JPEG data
  // URL) → its text, or an error.
  onImageToText?: (image: string) => Promise<{ error: string | null; text?: string }>;
}) {
  const t = useT();
  const placeholder = placeholderProp ?? t("Escribe, o usa # para un título, - para una lista, ! para un aviso…");
  const [hint, setHint] = useState<{ i: number; top: number; left: number } | null>(null);
  // The ⋮⋮ handle next to the block under the mouse (drag it, or click for ↑ ↓ 🗑).
  const [handle, setHandle] = useState<{ pos: number; dom: HTMLElement; top: number; left: number } | null>(null);
  const [blockMenu, setBlockMenu] = useState(false);
  const hideHint = useRef<number | null>(null);
  const uploadRef = useRef(onUploadImage);
  const toTextRef = useRef(onImageToText);
  // A screenshot just pasted: offer to write it out as text.
  const [offer, setOffer] = useState<{ src: string; file: File } | null>(null);
  const pdfRef = useRef(onUploadPdf);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    uploadRef.current = onUploadImage;
    toTextRef.current = onImageToText;
    pdfRef.current = onUploadPdf;
    onChangeRef.current = onChange;
  });
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const [slash, setSlash] = useState<Slash | null>(null);
  const [sel, setSel] = useState<Sel | null>(null);
  // Cursor in a table: its little bar (header on/off, rows, columns).
  const [tbl, setTbl] = useState<{ top: number; left: number; header: boolean } | null>(null);
  const dismissed = useRef<number | null>(null);
  // Set below, once the editor exists; the editor's callbacks read them.
  const refreshRef = useRef<(e: Editor) => void>(() => {});
  const keyRef = useRef<(e: KeyboardEvent) => boolean>(() => false);

  // What can be dropped/pasted/picked in: images, and PDFs when there's a place for them.
  function accepted(f: File) {
    return (f.type.startsWith("image/") && !!uploadRef.current) || (isPdf(f) && !!pdfRef.current);
  }
  // Images and PDFs (as cards), in the order given.
  async function insertImages(editor: Editor, files: File[], pasted = false) {
    setUploading(true);
    try {
      for (const file of files) {
        if (isPdf(file)) {
          if (!pdfRef.current) continue;
          const url = await pdfRef.current(file);
          editor.chain().focus().insertContent({ type: "pdfCard", attrs: { src: url, title: pdfTitle(file.name), cover: "" } }).run();
        } else if (uploadRef.current) {
          const url = await uploadRef.current(file);
          editor.chain().focus().setImage({ src: url }).run();
          if (pasted && files.length === 1 && toTextRef.current) setOffer({ src: url, file });
        }
      }
    } finally {
      setUploading(false);
    }
  }

  const editor = useEditor({
    immediatelyRender: false,
    autofocus,
    extensions: [
      StarterKit.configure({
        orderedList: false,
        blockquote: false,
        link: { openOnClick: false, autolink: true, defaultProtocol: "https" },
        heading: { levels: [1, 2, 3] },
      }),
      LetterableOrderedList,
      Callout,
      CalloutShortcut,
      TableKit.configure({ table: { resizable: false } }),
      ImageWithBoards,
      PdfCard,
      Indentation,
      Columns,
      Column,
      TextColor,
      Placeholder.configure({ placeholder }),
      KeyTerms,
      BlockMoves,
      CodeHighlight,
    ],
    content: textToDoc(initialText),
    editorProps: {
      attributes: { class: "rich-editor", "aria-label": t("Contenido de la página") },
      handleKeyDown: (_view, event) => keyRef.current(event),
      handlePaste: (view, event) => {
        const files = [...(event.clipboardData?.files ?? [])].filter(accepted);
        if (files.length && editorInstance.current) {
          insertImages(editorInstance.current, files, true);
          return true;
        }
        // Plain text with "- ", "1. ", "# " lines (notes, ChatGPT, a .txt):
        // paste it as real lists and headings, nesting from the indentation.
        const plain = event.clipboardData?.getData("text/plain") ?? "";
        const html = event.clipboardData?.getData("text/html") ?? "";
        const structured = /^[ \t]*([-*•]|\d+[.)]|#{1,3})\s+\S/m.test(plain) && plain.includes("\n");
        if (!structured || /<(ul|ol|h[1-3])[\s>]/i.test(html) || view.state.selection.$from.parent.type.name === "codeBlock" || !editorInstance.current) return false;
        editorInstance.current.chain().focus().insertContent(textToDoc(plain.replace(/\r\n?/g, "\n").replace(/^([ \t]*)•\s+/gm, "$1- ")).content ?? []).run();
        return true;
      },
      handleDrop: (view, event) => {
        if (dropBlock(view, event)) return true;
        const files = [...(event.dataTransfer?.files ?? [])].filter(accepted);
        if (files.length === 0 || !editorInstance.current) return false;
        insertImages(editorInstance.current, files);
        return true;
      },
    },
    onUpdate: ({ editor }) => {
      setHandle(null);
      setBlockMenu(false);
      onChangeRef.current(docToText(editor.getJSON()));
      refreshRef.current(editor);
    },
    onSelectionUpdate: ({ editor }) => refreshRef.current(editor),
  });
  const editorInstance = useRef<Editor | null>(null);
  useEffect(() => {
    editorInstance.current = editor;
    if (editorRef) editorRef.current = editor;
  }, [editor, editorRef]);

  const termKey = terms.map((t) => t.term).join("\u0000");
  useEffect(() => {
    if (editor && !editor.isDestroyed) editor.view.dispatch(editor.state.tr.setMeta(termsKey, termKey ? termKey.split("\u0000") : []));
  }, [editor, termKey]);

  function overTerm(e: React.MouseEvent) {
    const el = (e.target as HTMLElement).closest?.(".key-term");
    if (!el || !wrap.current) return;
    if (hideHint.current) window.clearTimeout(hideHint.current);
    const box = wrap.current.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    setHint({ i: Number(el.getAttribute("data-term")), top: r.bottom - box.top + 6, left: Math.max(0, r.left - box.left) });
  }
  function leaveTerm() {
    if (hideHint.current) window.clearTimeout(hideHint.current);
    hideHint.current = window.setTimeout(() => setHint(null), 250);
  }
  const hinted = hint ? terms[hint.i] : undefined;

  function placeHandle(pos: number, dom: HTMLElement, item: boolean) {
    if (!wrap.current) return;
    const box = wrap.current.getBoundingClientRect();
    const r = dom.getBoundingClientRect();
    const line = Math.min(r.height, dom.matches("h1,h2,h3") ? 40 : 26);
    setHandle({ pos, dom, top: r.top - box.top + line / 2 - 12, left: item ? r.left - box.left - 40 : -30 });
  }
  function overBlock(e: React.MouseEvent) {
    if (!editor || blockMenu) return;
    const b = blockAt(editor.view, e.target as HTMLElement);
    if (b && b.pos !== handle?.pos) placeHandle(b.pos, b.dom, b.item);
  }
  function moveFromMenu(dir: -1 | 1) {
    if (!editor || !handle) return;
    const to = moveBlock(editor, handle.pos, dir);
    if (to === null) return;
    const dom = editor.view.nodeDOM(to);
    if (dom instanceof HTMLElement) placeHandle(to, dom, dom.tagName === "LI");
    setBlockMenu(true);
  }

  const items = slash ? slashItems(t, !!onUploadImage, !!onBoard, !!onUploadPdf).filter((it) => fold(it.label).split(" ").some((w) => w.startsWith(fold(slash.query)))) : [];
  const pick = (it: SlashItem) => {
    if (!slash || !editor) return;
    const to = editor.state.selection.from;
    it.run(editor.chain().focus().deleteRange({ from: slash.from, to }));
    if (it.image) fileInput.current?.click();
    if (it.board && onBoard) onBoard().then((src) => editor.chain().focus().setImage({ src }).createParagraphNear().run());
    setSlash(null);
  };

  // Where things sit, relative to the editor box.
  useEffect(() => {
  refreshRef.current = (e) => {
    if (!bare || !wrap.current) return;
    const box = wrap.current.getBoundingClientRect();
    const { from, to, empty, $from } = e.state.selection;
    const at = e.view.domAtPos(from).node;
    const table = (at instanceof HTMLElement ? at : at.parentElement)?.closest("table");
    if (table && e.isActive("table")) {
      const r = (table.parentElement ?? table).getBoundingClientRect();
      setTbl({ top: r.top - box.top - 30, left: r.left - box.left, header: !!table.querySelector("tr:first-child th") });
    } else setTbl(null);
    if (!empty) {
      const text = e.state.doc.textBetween(from, to, " ").trim();
      const a = e.view.coordsAtPos(from);
      const z = e.view.coordsAtPos(to);
      // Under the selection (never over the toolbar above it).
      setSel(text ? { text, top: Math.max(a.bottom, z.bottom) - box.top, left: Math.max(0, Math.min(a.left - box.left, box.width - 260)) } : null);
      setSlash(null);
      return;
    }
    setSel(null);
    const before = $from.parent.type.name === "codeBlock" ? "" : $from.parent.textBetween(0, $from.parentOffset, undefined, "\ufffc");
    const m = /(?:^|\s)\/([\p{L}\d]*)$/u.exec(before);
    const start = m ? from - m[1].length - 1 : -1;
    if (!m || dismissed.current === start) return setSlash(null);
    const c = e.view.coordsAtPos(from);
    setSlash((old) => ({ from: start, query: m[1], top: c.bottom - box.top + 6, left: c.left - box.left, index: old?.from === start ? old.index : 0 }));
  };
  keyRef.current = (ev) => {
    if (!slash || items.length === 0) return false;
    if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
      const d = ev.key === "ArrowDown" ? 1 : -1;
      setSlash({ ...slash, index: (slash.index + d + items.length) % items.length });
      return true;
    }
    if (ev.key === "Enter" || ev.key === "Tab") {
      pick(items[Math.min(slash.index, items.length - 1)]);
      return true;
    }
    if (ev.key === "Escape") {
      dismissed.current = slash.from;
      setSlash(null);
      return true;
    }
    return false;
  };
  });

  if (!editor) {
    return <div className="min-h-64 rounded-2xl bg-white" aria-busy="true" />;
  }

  if (bare) {
    return (
      <>
      {/* Same formatting bar as the full editor, so a page edits the same way. */}
      <Toolbar editor={editor} pdf={!!onUploadPdf} onImage={onUploadImage || onUploadPdf ? () => fileInput.current?.click() : undefined} onBoard={onBoard ? () => onBoard().then((src) => editor.chain().focus().setImage({ src }).createParagraphNear().run()) : undefined} onMindMap={onMindMap ? async () => { const r = await onMindMap(); if (r.src) editor.chain().focus("end").setImage({ src: r.src }).createParagraphNear().run(); return r.error; } : undefined} uploading={uploading} extras={toolbarExtras} bare />
      <div
        ref={wrap}
        className="relative"
        onMouseOver={overTerm}
        onMouseMove={overBlock}
        onMouseLeave={() => !blockMenu && setHandle(null)}
        onMouseOut={(e) => (e.target as HTMLElement).closest?.(".key-term") && leaveTerm()}
      >
        <input
          ref={fileInput}
          type="file"
          accept={onUploadPdf ? "image/*,application/pdf" : "image/*"}
          multiple
          className="hidden"
          onChange={(e) => {
            const files = [...(e.target.files ?? [])];
            e.target.value = "";
            if (files.length) insertImages(editor, files);
          }}
        />
        {/* The handle sits left of the text, outside this box: this strip
            keeps the mouse "inside" on its way there, so it doesn't vanish. */}
        <div className="absolute inset-y-0 -left-12 w-12" aria-hidden />
        <EditorContent editor={editor} />
        {handle && (
          <div className="absolute z-10" style={{ top: handle.top, left: handle.left }}>
            <button
              type="button"
              draggable
              onDragStart={(e) => {
                setBlockMenu(false);
                startDrag(editor.view, handle.pos, handle.dom, e.nativeEvent);
              }}
              onDragEnd={() => {
                endDrag();
                setHandle(null);
              }}
              onClick={() => setBlockMenu((m) => !m)}
              title={t("Arrastra para mover · clic: ↑ ↓")}
              aria-label={t("Mover bloque")}
              className="grid h-6 w-5 cursor-grab place-items-center rounded text-ink-faint/70 hover:bg-chip hover:text-ink active:cursor-grabbing"
            >
              <GripIcon />
            </button>
            {blockMenu && <BlockMenu editor={editor} pos={handle.pos} onMove={moveFromMenu} onDone={() => {
                setHandle(null);
                setBlockMenu(false);
              }} />}
          </div>
        )}
        {tbl && (
          <div className="absolute z-10 flex items-center gap-0.5 rounded-lg bg-white p-0.5 text-xs text-ink-muted shadow-[0_0_0_1px_rgba(15,15,15,.06),0_4px_12px_rgba(15,15,15,.08)]" style={{ top: tbl.top, left: tbl.left }} onMouseDown={(e) => e.preventDefault()}>
            <Btn on={tbl.header} onClick={() => editor.chain().focus().toggleHeaderRow().run()} title={t("Primera fila como cabecera")}>{t("Cabecera")}</Btn>
            <Btn onClick={() => editor.chain().focus().addRowAfter().run()} title={t("Añadir fila")}>{t("+fila")}</Btn>
            <Btn onClick={() => editor.chain().focus().addColumnAfter().run()} title={t("Añadir columna")}>{t("+col")}</Btn>
            <Btn onClick={() => editor.chain().focus().deleteRow().run()} title={t("Eliminar fila")}>{t("−fila")}</Btn>
            <Btn onClick={() => editor.chain().focus().deleteColumn().run()} title={t("Eliminar columna")}>{t("−col")}</Btn>
            <Btn onClick={() => editor.chain().focus().deleteTable().run()} title={t("Eliminar tabla")}><TrashIcon size={13} /></Btn>
          </div>
        )}
        {slash && items.length > 0 && (
          <div
            className="absolute z-20 flex w-60 flex-col rounded-lg bg-white p-1 text-sm shadow-[0_0_0_1px_rgba(15,15,15,.05),0_10px_26px_rgba(15,15,15,.16)]"
            style={{ top: slash.top, left: slash.left }}
            role="listbox"
            aria-label={t("Bloques")}
          >
            {items.map((it, i) => (
              <button
                key={it.label}
                type="button"
                role="option"
                aria-selected={i === slash.index}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(it)}
                className={`flex items-center gap-2.5 rounded-md px-2 py-1.5 text-left ${i === slash.index ? "bg-chip" : "hover:bg-chip"}`}
              >
                <span className="grid size-7 place-items-center rounded-md border border-border-subtle text-xs text-ink-muted">{it.icon}</span>
                {t(it.label)}
              </button>
            ))}
          </div>
        )}
        {sel && <SelectionBar key={`${sel.top}-${sel.left}`} editor={editor} sel={sel} onAsk={onAsk} onCard={onCard} onMap={onMap} onRewrite={onRewrite} />}
        {hint && hinted && !sel && (
          <div
            className="absolute z-20 flex w-72 flex-col gap-1 rounded-lg bg-white p-3 text-sm shadow-[0_0_0_1px_rgba(15,15,15,.05),0_10px_26px_rgba(15,15,15,.16)]"
            style={{ top: hint.top, left: hint.left }}
            onMouseEnter={() => hideHint.current && window.clearTimeout(hideHint.current)}
            onMouseLeave={leaveTerm}
          >
            <span className="font-semibold">{hinted.title}</span>
            {hinted.summary && <p className="text-ink-muted">{hinted.summary}</p>}
            {/* Full prefetch: the card is up for a moment before the click,
                enough to have the concept page ready when it comes. */}
            <Link href={hinted.href} prefetch className="mt-1 flex items-center gap-1.5 self-start text-xs text-accent hover:underline">
              <MapIcon size={14} /> {hinted.where}
            </Link>
          </div>
        )}
        {uploading && <span className="absolute top-0 right-0 text-xs text-ink-faint">{t("Subiendo…")}</span>}
        {offer && onImageToText && <ImageToText editor={editor} wrap={wrap} offer={offer} onImageToText={onImageToText} onDone={() => setOffer(null)} />}
      </div>
      </>
    );
  }

  return (
    <div className="flex flex-col rounded-2xl border border-border-subtle bg-white">
      <Toolbar
        editor={editor}
        pdf={!!onUploadPdf}
        onImage={onUploadImage || onUploadPdf ? () => fileInput.current?.click() : undefined}
        onBoard={onBoard ? () => onBoard().then((src) => editor.chain().focus().setImage({ src }).createParagraphNear().run()) : undefined} onMindMap={onMindMap ? async () => { const r = await onMindMap(); if (r.src) editor.chain().focus("end").setImage({ src: r.src }).createParagraphNear().run(); return r.error; } : undefined}
        uploading={uploading}
        extras={toolbarExtras}
      />
      <input
        ref={fileInput}
        type="file"
        accept={onUploadPdf ? "image/*,application/pdf" : "image/*"}
        multiple
        className="hidden"
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = "";
          if (files.length) insertImages(editor, files);
        }}
      />
      <EditorContent editor={editor} className="px-5 py-4" />
    </div>
  );
}

function Toolbar({
  editor,
  onImage,
  pdf = false,
  onBoard,
  onMindMap,
  uploading,
  extras,
  bare = false,
}: {
  editor: Editor;
  onImage?: () => void;
  // The image button takes PDFs too.
  pdf?: boolean;
  // Insert a new whiteboard (drawn picture) where the cursor is.
  onBoard?: () => void;
  // Make a mind map of the page with AI (inserted at the end); an error or null.
  onMindMap?: () => Promise<string | null>;
  uploading: boolean;
  extras?: React.ReactNode;
  // On a page (no box around the editor): its own rounded bar.
  bare?: boolean;
}) {
  const t = useT();
  // Re-render the toolbar when the selection's formatting changes.
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      h1: e.isActive("heading", { level: 1 }),
      h2: e.isActive("heading", { level: 2 }),
      h3: e.isActive("heading", { level: 3 }),
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      inlineCode: e.isActive("code"),
      bullet: e.isActive("bulletList"),
      numbered: e.isActive("orderedList", { kind: "decimal" }),
      lettered: e.isActive("orderedList", { kind: "alpha" }),
      callout: e.isActive("blockquote"),
      code: e.isActive("codeBlock"),
      codeLang: (e.getAttributes("codeBlock").language as string | null) ?? "",
      table: e.isActive("table"),
      link: e.isActive("link"),
      color: (e.getAttributes("textColor").color as number | undefined) ?? null,
    }),
  });
  const [open, setOpen] = useState<"style" | "list" | "insert" | "color" | null>(null);
  const [mindBusy, setMindBusy] = useState(false);
  const styleLabel = s.h1 ? t("Título 1") : s.h2 ? t("Título 2") : s.h3 ? t("Título 3") : t("Texto");
  const c = () => editor.chain().focus();

  function toggleLettered() {
    if (s.lettered) return c().toggleOrderedList().run();
    if (s.numbered) return c().updateAttributes("orderedList", { kind: "alpha" }).run();
    c().toggleOrderedList().updateAttributes("orderedList", { kind: "alpha" }).run();
  }
  function toggleNumbered() {
    if (s.lettered) return c().updateAttributes("orderedList", { kind: "decimal" }).run();
    c().toggleOrderedList().run();
  }
  async function setLink() {
    if (s.link) return c().unsetLink().run();
    const url = await ask.prompt(t("URL del enlace"), "https://");
    if (url && url !== "https://") c().extendMarkRange("link").setLink({ href: url }).run();
  }

  return (
    <div className={`sticky top-0 z-10 flex flex-wrap items-center gap-0.5 border-border-subtle bg-white/95 px-2 py-1.5 backdrop-blur ${bare ? "mb-3 rounded-xl border" : "rounded-t-2xl border-b"}`}>
      {/* Grouped: text style, formatting, lists, and one menu for inserting.
          Table options live on the table itself, never here. */}
      <Drop id="style" open={open} setOpen={setOpen} label={<>{styleLabel} <Caret /></>} title={t("Tipo de texto")} wide>
        <Item on={!s.h1 && !s.h2 && !s.h3} icon="Aa" label={t("Texto")} onClick={() => c().setParagraph().run()} />
        <Item on={s.h1} icon="H1" label={t("Título 1")} onClick={() => c().setHeading({ level: 1 }).run()} />
        <Item on={s.h2} icon="H2" label={t("Título 2")} onClick={() => c().setHeading({ level: 2 }).run()} />
        <Item on={s.h3} icon="H3" label={t("Título 3")} onClick={() => c().setHeading({ level: 3 }).run()} />
      </Drop>
      <Sep />
      <Btn on={s.bold} onClick={() => c().toggleBold().run()} title={t("Negrita (Ctrl+B)")}><b>{t("N")}</b></Btn>
      <Btn on={s.italic} onClick={() => c().toggleItalic().run()} title={t("Cursiva (Ctrl+I)")}><i>{t("K")}</i></Btn>
      <Btn on={s.underline} onClick={() => c().toggleUnderline().run()} title={t("Subrayado (Ctrl+U)")}><u>{t("S")}</u></Btn>
      <Btn on={s.inlineCode} onClick={() => c().toggleCode().run()} title={t("Código en línea (Ctrl+E)")}><span className="font-mono text-[12px]">{"`c`"}</span></Btn>
      <Btn on={s.link} onClick={setLink} title={t("Enlace")}><LinkIcon /></Btn>
      <Drop id="color" open={open} setOpen={setOpen} title={t("Color del texto")} label={<span className="flex flex-col items-center leading-none"><span className="text-[13px] font-semibold">A</span><span className="mt-0.5 h-[3px] w-3.5 rounded-full" style={{ background: s.color ? TEXT_COLORS.find((x) => x.i === s.color)?.c : "currentColor" }} /></span>}>
        <div className="flex items-center gap-1.5 p-1.5">
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { c().unsetMark("textColor").run(); setOpen(null); }} title={t("Por defecto")} aria-label={t("Por defecto")} className={`grid size-7 place-items-center rounded-full border border-border-subtle text-xs font-semibold ${s.color === null ? "ring-2 ring-ink ring-offset-1" : ""}`}>A</button>
          {TEXT_COLORS.map((x) => (
            <button key={x.i} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { c().setMark("textColor", { color: x.i }).run(); setOpen(null); }} aria-label={x.c} className={`size-7 rounded-full ${s.color === x.i ? "ring-2 ring-ink ring-offset-1" : ""}`} style={{ background: x.c }} />
          ))}
        </div>
      </Drop>
      <Sep />
      <Drop id="list" open={open} setOpen={setOpen} title={t("Listas")} label={<><ListIcon /> <Caret /></>} on={s.bullet || s.numbered || s.lettered}>
        <Item on={s.bullet} icon="•" label={t("Lista")} onClick={() => c().toggleBulletList().run()} />
        <Item on={s.numbered} icon="1." label={t("Lista numerada")} onClick={toggleNumbered} />
        <Item on={s.lettered} icon="a." label={t("Lista con letras")} onClick={toggleLettered} />
      </Drop>
      <Sep />
      <Drop id="insert" open={open} setOpen={setOpen} title={t("Insertar")} label={<>{mindBusy || uploading ? <span className="block size-3.5 animate-spin rounded-full border-2 border-ink/20 border-t-ink/70" /> : "＋"} {t("Insertar")} <Caret /></>} wide>
        <div className="px-2.5 pt-1.5 pb-0.5 text-[11px] font-semibold text-ink-faint">{t("Bloques")}</div>
        <Item on={s.callout} icon={<QuoteIcon size={13} />} label={t("Aviso")} onClick={() => c().toggleBlockquote().run()} />
        <Item on={s.code} icon="</>" label={t("Bloque de código")} onClick={() => c().toggleCodeBlock().run()} />
        <Item on={s.table} icon="▦" label={t("Tabla")} onClick={() => c().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} />
        {(onImage || onBoard || onMindMap) && <div className="px-2.5 pt-1.5 pb-0.5 text-[11px] font-semibold text-ink-faint">{t("Medios")}</div>}
        {onImage && <Item icon={<ImageIcon />} label={pdf ? t("Imagen o PDF") : t("Imagen")} onClick={onImage} />}
        {onBoard && <Item icon="✎" label={t("Pizarra")} onClick={onBoard} />}
        {onMindMap && (
          <Item
            icon="⌘"
            label={t("Mapa mental (IA)")}
            onClick={async () => {
              setMindBusy(true);
              const e = await onMindMap().catch(() => t("Inténtalo de nuevo"));
              setMindBusy(false);
              if (e) void ask.alert(e);
            }}
          />
        )}
      </Drop>
      {s.code && <CodeLangMenu value={s.codeLang} onChange={(v) => c().updateAttributes("codeBlock", { language: v || null }).run()} />}
      {extras && <span className="ml-auto flex items-center">{extras}</span>}
    </div>
  );
}

function Btn({
  on,
  onClick,
  title,
  children,
}: {
  on?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      title={title}
      aria-label={title}
      aria-pressed={on}
      className={`min-w-8 rounded-md px-2 py-1 text-sm transition-colors ${on ? "bg-ink text-white" : "text-ink-muted hover:bg-chip hover:text-ink"}`}
    >
      {children}
    </button>
  );
}

const GripIcon = () => (
  <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor" aria-hidden>
    {[3, 8, 13].map((y) => [2.5, 7.5].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.4" />))}
  </svg>
);

const Sep = () => <span className="mx-1 h-5 w-px bg-border-subtle" aria-hidden />;

type Slash = { from: number; query: string; top: number; left: number; index: number };
type Sel = { text: string; top: number; left: number };
type Chain = ReturnType<Editor["chain"]>;
type SlashItem = { label: string; icon: React.ReactNode; run: (c: Chain) => void; image?: boolean; board?: boolean };

const isPdf = (f: File) => f.type === "application/pdf" || /\.pdf$/i.test(f.name);
const fold = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

function slashItems(t: T, images: boolean, boards = false, pdfs = false): SlashItem[] {
  return [
    { label: t("Título"), icon: "H1", run: (c) => c.setHeading({ level: 1 }).run() },
    { label: t("Subtítulo"), icon: "H2", run: (c) => c.setHeading({ level: 2 }).run() },
    { label: t("Apartado"), icon: "H3", run: (c) => c.setHeading({ level: 3 }).run() },
    { label: t("Lista"), icon: "•", run: (c) => c.toggleBulletList().run() },
    { label: t("Lista numerada"), icon: "1.", run: (c) => c.toggleOrderedList().run() },
    { label: t("Aviso"), icon: <QuoteIcon />, run: (c) => c.toggleBlockquote().run() },
    { label: t("Código"), icon: "</>", run: (c) => c.toggleCodeBlock().run() },
    { label: t("Tabla"), icon: "▦", run: (c) => c.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
    ...(images ? [{ label: t("Imagen"), icon: <ImageIcon />, run: (c: Chain) => c.run(), image: true }] : []),
    ...(boards ? [{ label: t("Pizarra"), icon: "✎", run: (c: Chain) => c.run(), board: true }] : []),
    ...(pdfs ? [{ label: "PDF", icon: "📄", run: (c: Chain) => c.run(), image: true }] : []),
  ];
}

export type RewriteMode = "better" | "fix" | "shorter" | "simpler";

// Under selected text, like Notion's: the block's type, formatting in a
// grid, card / map, and the AI (explain, or rewrite the selection).
function SelectionBar({
  editor,
  sel,
  onAsk,
  onCard,
  onMap,
  onRewrite,
}: {
  editor: Editor;
  sel: Sel;
  onAsk?: (text: string) => Promise<{ error: string | null; answer?: string }>;
  onCard?: (text: string) => Promise<{ error: string | null }>;
  onMap?: (text: string) => Promise<{ error: string | null; href?: string }>;
  onRewrite?: (text: string, mode: RewriteMode) => Promise<{ error: string | null; text?: string }>;
}) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<{ text: string; tone: "answer" | "ok" | "error"; href?: string } | null>(null);
  const [sub, setSub] = useState<"type" | "color" | null>(null);
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      strike: e.isActive("strike"),
      code: e.isActive("code"),
      link: e.isActive("link"),
      color: (e.getAttributes("textColor").color as number | undefined) ?? null,
      kind: e.isActive("heading", { level: 1 }) ? "h1" : e.isActive("heading", { level: 2 }) ? "h2" : e.isActive("heading", { level: 3 }) ? "h3" : e.isActive("bulletList") ? "bullet" : e.isActive("orderedList") ? "numbered" : e.isActive("blockquote") ? "callout" : e.isActive("codeBlock") ? "code" : "text",
    }),
  });
  const c = () => editor.chain().focus();
  const KIND_LABEL: Record<string, string> = { text: t("Texto"), h1: t("Título 1"), h2: t("Título 2"), h3: t("Título 3"), bullet: t("Lista"), numbered: t("Lista numerada"), callout: t("Aviso"), code: t("Código") };
  async function go(fn: () => Promise<{ error: string | null; answer?: string; href?: string }>, ok: string) {
    setBusy(true);
    setOut(null);
    const r = await fn();
    setBusy(false);
    setOut(r.error ? { text: r.error, tone: "error" } : r.answer ? { text: r.answer, tone: "answer" } : { text: ok, tone: "ok", href: r.href });
  }
  async function rewrite(mode: RewriteMode) {
    if (!onRewrite) return;
    const { from, to } = editor.state.selection;
    setBusy(true);
    setOut(null);
    const r = await onRewrite(sel.text, mode);
    setBusy(false);
    if (r.error || !r.text) return setOut({ text: r.error ?? t("Inténtalo de nuevo"), tone: "error" });
    editor.chain().focus().insertContentAt({ from, to }, r.text).run();
  }
  const cell = (on: boolean) => `grid h-8 place-items-center rounded-md text-sm transition-colors ${on ? "bg-chip text-ink" : "text-ink-muted hover:bg-chip hover:text-ink"}`;
  const row = "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[13.5px] text-ink hover:bg-chip disabled:opacity-50";
  const keep = (e: React.MouseEvent) => e.preventDefault();
  return (
    <div className="absolute z-30 mt-2 flex w-64 flex-col gap-1.5" style={{ top: sel.top, left: sel.left }} onMouseDown={keep}>
      <div className="flex flex-col rounded-xl bg-white p-1.5 shadow-[0_0_0_1px_rgba(15,15,15,.06),0_12px_30px_rgba(15,15,15,.2)]">
        {/* The block's type */}
        <button type="button" onClick={() => setSub(sub === "type" ? null : "type")} className={row}>
          <ListIcon />
          <span className="flex-1 truncate font-medium">{KIND_LABEL[s.kind]}</span>
          <span className={`text-ink-faint transition-transform ${sub === "type" ? "rotate-90" : ""}`}>›</span>
        </button>
        {sub === "type" && (
          <div className="mb-1 grid grid-cols-4 gap-1 rounded-lg bg-chip/50 p-1">
            {(
              [
                ["text", "Aa", () => c().setParagraph().run()],
                ["h1", "H1", () => c().setHeading({ level: 1 }).run()],
                ["h2", "H2", () => c().setHeading({ level: 2 }).run()],
                ["h3", "H3", () => c().setHeading({ level: 3 }).run()],
                ["bullet", "•", () => c().toggleBulletList().run()],
                ["numbered", "1.", () => c().toggleOrderedList().run()],
                ["callout", "!", () => c().toggleBlockquote().run()],
                ["code", "</>", () => c().toggleCodeBlock().run()],
              ] as const
            ).map(([k, icon, run]) => (
              <button key={k} type="button" title={KIND_LABEL[k]} aria-label={KIND_LABEL[k]} onClick={run} className={cell(s.kind === k)}>
                <span className="text-xs font-semibold">{icon}</span>
              </button>
            ))}
          </div>
        )}
        <div className="my-1 h-px bg-border-subtle" />
        {/* Formatting, in a grid */}
        <div className="grid grid-cols-5 gap-0.5">
          <button type="button" title={t("Color del texto")} aria-label={t("Color del texto")} onClick={() => setSub(sub === "color" ? null : "color")} className={cell(sub === "color")}>
            <span className="grid size-5 place-items-center rounded border border-border-subtle text-[11px] font-bold" style={{ color: s.color ? TEXT_COLORS.find((x) => x.i === s.color)?.c : undefined }}>A</span>
          </button>
          <button type="button" title={t("Negrita")} aria-label={t("Negrita")} onClick={() => c().toggleBold().run()} className={cell(s.bold)}><b>B</b></button>
          <button type="button" title={t("Cursiva")} aria-label={t("Cursiva")} onClick={() => c().toggleItalic().run()} className={cell(s.italic)}><i className="font-serif">I</i></button>
          <button type="button" title={t("Subrayado")} aria-label={t("Subrayado")} onClick={() => c().toggleUnderline().run()} className={cell(s.underline)}><u>U</u></button>
          <button type="button" title={t("Quitar formato")} aria-label={t("Quitar formato")} onClick={() => c().unsetAllMarks().run()} className={cell(false)}><span className="text-xs">T<sub>x</sub></span></button>
          <button
            type="button"
            title={t("Enlace")}
            aria-label={t("Enlace")}
            onClick={async () => {
              if (s.link) return c().unsetLink().run();
              const url = await ask.prompt(t("URL del enlace"), "https://");
              if (url && url !== "https://") c().extendMarkRange("link").setLink({ href: url }).run();
            }}
            className={cell(s.link)}
          >
            <LinkIcon />
          </button>
          <button type="button" title={t("Tachado")} aria-label={t("Tachado")} onClick={() => c().toggleStrike().run()} className={cell(s.strike)}><s>S</s></button>
          <button type="button" title={t("Código en línea (Ctrl+E)")} aria-label={t("Código")} onClick={() => c().toggleCode().run()} className={cell(s.code)}><span className="font-mono text-xs">{"</>"}</span></button>
        </div>
        {sub === "color" && (
          <div className="mt-1 flex items-center justify-between rounded-lg bg-chip/50 p-1.5">
            <button type="button" onClick={() => c().unsetMark("textColor").run()} aria-label={t("Por defecto")} title={t("Por defecto")} className={`grid size-6 place-items-center rounded-full border border-border-subtle text-[10px] font-bold ${s.color === null ? "ring-2 ring-ink ring-offset-1" : ""}`}>A</button>
            {TEXT_COLORS.map((x) => (
              <button key={x.i} type="button" onClick={() => c().setMark("textColor", { color: x.i }).run()} aria-label={x.c} className={`size-6 rounded-full ${s.color === x.i ? "ring-2 ring-ink ring-offset-1" : ""}`} style={{ background: x.c }} />
            ))}
          </div>
        )}
        {(onCard || onMap) && (
          <>
            <div className="my-1 h-px bg-border-subtle" />
            {onCard && (
              <button type="button" disabled={busy} onClick={() => go(() => onCard(sel.text), t("Tarjeta creada"))} className={row}>
                <CardsIcon size={15} /> {t("Crear tarjeta")}
              </button>
            )}
            {onMap && (
              <button type="button" disabled={busy} onClick={() => go(() => onMap(sel.text), t("En el mapa"))} className={row}>
                <MapIcon size={15} /> {t("Añadir al mapa")}
              </button>
            )}
          </>
        )}
        {(onAsk || onRewrite) && (
          <>
            <div className="my-1 h-px bg-border-subtle" />
            <div className="px-2 pt-0.5 pb-1 text-[11px] font-semibold text-ink-faint">{t("IA")}</div>
            {onAsk && (
              <button type="button" disabled={busy} onClick={() => go(() => onAsk(sel.text), "")} className={row}>
                <SparkIcon size={14} /> {t("Explicar")}
              </button>
            )}
            {onRewrite &&
              (
                [
                  ["better", t("Mejorar redacción")],
                  ["fix", t("Corregir ortografía")],
                  ["shorter", t("Resumir")],
                  ["simpler", t("Hacerlo más sencillo")],
                ] as const
              ).map(([m, label]) => (
                <button key={m} type="button" disabled={busy} onClick={() => rewrite(m)} className={row}>
                  <span className="w-[15px] text-center text-ink-faint">✎</span> {label}
                </button>
              ))}
          </>
        )}
      </div>
      {(busy || out) && (
        <div className={`rounded-xl bg-white px-3 py-2 text-sm shadow-[0_0_0_1px_rgba(15,15,15,.06),0_12px_30px_rgba(15,15,15,.2)] ${out?.tone === "error" ? "text-red-500" : out?.tone === "ok" ? "text-[#448361]" : ""}`}>
          {busy ? (
            <span className="block h-2 w-28 animate-pulse rounded bg-chip" />
          ) : out?.href ? (
            <Link href={out.href} className="flex items-center gap-1.5 hover:underline">
              <CheckIcon size={13} /> <MapIcon size={14} />
            </Link>
          ) : (
            <p className="max-h-60 overflow-y-auto whitespace-pre-line">{out?.text}</p>
          )}
        </div>
      )}
    </div>
  );
}

// "Mapa mental": a toolbar button that maps the page with AI (a few seconds).
const Caret = () => <span className="text-[9px] opacity-60">▼</span>;
const ListIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
    <path d="M9 6h11M9 12h11M9 18h11" />
    <circle cx="4.5" cy="6" r="1" fill="currentColor" />
    <circle cx="4.5" cy="12" r="1" fill="currentColor" />
    <circle cx="4.5" cy="18" r="1" fill="currentColor" />
  </svg>
);

// A toolbar button that opens a small menu under it.
function Drop<T extends string>({ id, open, setOpen, label, title, on, wide, children }: { id: T; open: T | null; setOpen: (v: T | null) => void; label: React.ReactNode; title: string; on?: boolean; wide?: boolean; children: React.ReactNode }) {
  const isOpen = open === id;
  return (
    <span className="relative">
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen(isOpen ? null : id)}
        title={title}
        aria-label={title}
        aria-expanded={isOpen}
        className={`flex h-7 items-center gap-1 rounded-md px-2 text-sm transition-colors ${isOpen || on ? "bg-chip text-ink" : "text-ink-muted hover:bg-chip hover:text-ink"}`}
      >
        {label}
      </button>
      {isOpen && (
        <>
          <button type="button" aria-hidden tabIndex={-1} className="fixed inset-0 z-30 cursor-default" onMouseDown={(e) => e.preventDefault()} onClick={() => setOpen(null)} />
          <div className={`absolute top-full left-0 z-40 mt-1 rounded-xl bg-white p-1 shadow-[0_0_0_1px_rgba(15,15,15,.06),0_10px_26px_rgba(15,15,15,.16)] ${wide ? "w-52" : ""}`} onClick={(e) => (e.target as HTMLElement).closest("[data-item]") && setOpen(null)}>
            {children}
          </div>
        </>
      )}
    </span>
  );
}

function Item({ icon, label, on, onClick }: { icon: React.ReactNode; label: string; on?: boolean; onClick: () => void }) {
  return (
    <button type="button" data-item onMouseDown={(e) => e.preventDefault()} onClick={onClick} className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm whitespace-nowrap ${on ? "bg-chip text-ink" : "text-ink hover:bg-chip"}`}>
      <span className="grid size-6 shrink-0 place-items-center rounded-md border border-border-subtle text-[11px] text-ink-muted">{icon}</span>
      {label}
    </button>
  );
}


// The block handle's menu: move, delete, turn into another kind of block,
// or put columns next to it.
const KINDS: { kind: BlockKind; label: string; icon: React.ReactNode }[] = [
  { kind: "text", label: "Texto", icon: "Aa" },
  { kind: "h1", label: "Título 1", icon: "H1" },
  { kind: "h2", label: "Título 2", icon: "H2" },
  { kind: "h3", label: "Título 3", icon: "H3" },
  { kind: "bullet", label: "Lista", icon: "•" },
  { kind: "numbered", label: "Lista numerada", icon: "1." },
  { kind: "callout", label: "Aviso", icon: <QuoteIcon size={13} /> },
  { kind: "code", label: "Código", icon: "</>" },
];
function BlockMenu({ editor, pos, onMove, onDone }: { editor: Editor; pos: number; onMove: (dir: -1 | 1) => void; onDone: () => void }) {
  const t = useT();
  const [cols, setCols] = useState(false);
  // Opens downwards; near the bottom of the window it opens upwards
  // instead, and if it fits neither way it scrolls inside.
  const box = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<{ up: boolean; max?: number } | null>(null);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const handle = el.parentElement!.getBoundingClientRect();
    const h = el.scrollHeight;
    const below = window.innerHeight - handle.bottom - 12;
    const above = handle.top - 12;
    const up = h > below && above > below;
    setPlace({ up, max: h > (up ? above : below) ? Math.max(120, up ? above : below) : undefined });
  }, [cols]);
  // A list item's handle: converting and columns act on its whole list.
  const $p = editor.state.doc.resolve(pos);
  const top = $p.depth > 0 ? $p.before(1) : pos;
  const node = editor.state.doc.nodeAt(top);
  const type = node?.type.name ?? "";
  const convertible = ["paragraph", "heading", "bulletList", "orderedList", "blockquote", "codeBlock"].includes(type);
  const isCols = type === "columns";
  const row = "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[13px] text-ink hover:bg-chip";
  const ic = "grid size-6 shrink-0 place-items-center rounded border border-border-subtle bg-white text-[11px] text-ink-muted";
  const shape = (n: number) => (
    <span className="flex w-16 gap-1">
      {Array.from({ length: n }, (_, i) => (
        <i key={i} className="h-4 flex-1 rounded-[3px] border-[1.5px] border-ink-faint/50" />
      ))}
    </span>
  );
  return (
    <div
      ref={box}
      className={`absolute left-0 z-20 w-60 overflow-y-auto rounded-xl bg-white p-1.5 shadow-[0_0_0_1px_rgba(15,15,15,.05),0_10px_26px_rgba(15,15,15,.16)] ${place?.up ? "bottom-7" : "top-7"}`}
      style={{ maxHeight: place?.max, visibility: place ? "visible" : "hidden" }}
      onMouseLeave={onDone}
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="mb-1 flex gap-0.5 border-b border-border-subtle pb-1.5">
        <Btn onClick={() => onMove(-1)} title={t("Subir (Ctrl+Shift+↑)")}><ArrowDown size={14} className="rotate-180" /></Btn>
        <Btn onClick={() => onMove(1)} title={t("Bajar (Ctrl+Shift+↓)")}><ArrowDown size={14} /></Btn>
        <Btn
          onClick={() => {
            deleteBlock(editor, pos);
            onDone();
          }}
          title={t("Eliminar bloque")}
        >
          <TrashIcon size={14} />
        </Btn>
      </div>
      {convertible && (
        <>
          <div className="px-2 pt-1.5 pb-1 text-[11px] font-semibold text-ink-faint">{t("Convertir en")}</div>
          {KINDS.map((k) => (
            <button
              key={k.kind}
              type="button"
              className={row}
              onClick={() => {
                convertBlock(editor, top, k.kind);
                onDone();
              }}
            >
              <span className={ic}>{k.icon}</span>
              {t(k.label)}
            </button>
          ))}
        </>
      )}
      <div className="px-2 pt-1.5 pb-1 text-[11px] font-semibold text-ink-faint">{t("Columnas")}</div>
      {!cols ? (
        <button type="button" className={row} onClick={() => setCols(true)}>
          <span className={ic}>▥</span>
          {isCols ? t("Cambiar columnas") : t("Añadir columnas al lado")}
          <span className="ml-auto text-ink-faint">›</span>
        </button>
      ) : (
        <>
          {[2, 3, 4].map((n) => (
            <button
              key={n}
              type="button"
              className={row}
              onClick={() => {
                setColumns(editor, top, n);
                onDone();
              }}
            >
              {shape(n)}
              {t("{0} columnas", { 0: n })}
            </button>
          ))}
          {isCols && (
            <button
              type="button"
              className={`${row} text-ink-muted`}
              onClick={() => {
                unsetColumns(editor, top);
                onDone();
              }}
            >
              {t("Quitar columnas")}
            </button>
          )}
        </>
      )}
    </div>
  );
}

// The pasted image as a JPEG data URL, at most 1600px wide (what the
// slide reader takes).
async function asJpeg(file: File): Promise<string> {
  const bmp = await createImageBitmap(file);
  const f = Math.min(1, 1600 / bmp.width);
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * f);
  c.height = Math.round(bmp.height * f);
  const g = c.getContext("2d")!;
  g.fillStyle = "#fff";
  g.fillRect(0, 0, c.width, c.height);
  g.drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.85);
}

// Under a screenshot just pasted: "¿Es texto? Lo puedo escribir por ti" —
// the AI reads it and the text takes the image's place; or keep the image.
function ImageToText({
  editor,
  wrap,
  offer,
  onImageToText,
  onDone,
}: {
  editor: Editor;
  wrap: React.RefObject<HTMLDivElement | null>;
  offer: { src: string; file: File };
  onImageToText: (image: string) => Promise<{ error: string | null; text?: string }>;
  onDone: () => void;
}) {
  const t = useT();
  const [at, setAt] = useState<{ top: number; left: number; width: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const findImage = () => {
    let pos = -1;
    editor.state.doc.descendants((n, p) => {
      if (pos < 0 && n.type.name === "image" && n.attrs.src === offer.src) pos = p;
      return pos < 0;
    });
    return pos;
  };

  // Follow the image as the page changes; gone (deleted, undone) → gone too.
  useEffect(() => {
    const place = () => {
      const img = editor.view.dom.querySelector<HTMLImageElement>(`img[src="${CSS.escape(offer.src)}"]`);
      const box = wrap.current?.getBoundingClientRect();
      if (!img || !box) return onDone();
      const r = img.getBoundingClientRect();
      setAt({ top: r.bottom - box.top + 6, left: r.left - box.left, width: Math.max(300, r.width) });
    };
    const first = requestAnimationFrame(place);
    const img = editor.view.dom.querySelector<HTMLImageElement>(`img[src="${CSS.escape(offer.src)}"]`);
    img?.addEventListener("load", place);
    editor.on("update", place);
    window.addEventListener("resize", place);
    return () => {
      cancelAnimationFrame(first);
      img?.removeEventListener("load", place);
      editor.off("update", place);
      window.removeEventListener("resize", place);
    };
  }, [editor, wrap, offer.src, onDone]);

  async function toText() {
    setBusy(true);
    setError(null);
    try {
      const r = await onImageToText(await asJpeg(offer.file));
      if (r.error || !r.text) throw new Error(r.error ?? t("Inténtalo de nuevo"));
      const pos = findImage();
      if (pos < 0) return onDone();
      const nodes = editor.schema.nodeFromJSON({ type: "doc", content: textToDoc(r.text).content ?? [] }).content;
      editor.view.dispatch(editor.state.tr.replaceWith(pos, pos + 1, nodes));
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("Inténtalo de nuevo"));
      setBusy(false);
    }
  }

  if (!at) return null;
  return (
    <div
      className="pop-panel absolute z-20 flex flex-wrap items-center gap-1.5 rounded-xl bg-white py-1.5 pr-1.5 pl-3 text-[13px] shadow-[0_0_0_1px_rgba(15,15,15,.07),0_8px_20px_-8px_rgba(15,15,15,.3)] animate-[pop-in_140ms_ease-out]"
      style={{ top: at.top, left: at.left, width: at.width }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <span className={`min-w-0 flex-1 ${error ? "text-red-500" : "text-ink-muted"}`}>{error ?? (busy ? t("Leyendo la captura…") : t("¿Es texto? Lo puedo escribir por ti."))}</span>
      <button type="button" onClick={toText} disabled={busy} className="rounded-full bg-accent px-3 py-1.5 font-semibold text-white hover:brightness-95 disabled:opacity-60">
        {t("Aa Pasar a texto")}
      </button>
      <button type="button" onClick={onDone} disabled={busy} className="rounded-full bg-chip px-3 py-1.5 font-semibold text-ink hover:bg-hover disabled:opacity-60">
        {t("Dejar imagen")}
      </button>
    </div>
  );
}
