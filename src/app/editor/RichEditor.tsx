"use client";

import { useT } from "@/app/LangProvider";
import type { T } from "@/lib/i18n";
import { ArrowDown, CardsIcon, CheckIcon, ImageIcon, LinkIcon, MapIcon, QuoteIcon, SparkIcon, TrashIcon, XIcon } from "@/app/icons";
import { BlockMoves, blockAt, deleteBlock, dropBlock, endDrag, moveBlock, startDrag } from "./blocks";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
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
import { Placeholder } from "@tiptap/extensions";
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
  placeholder: placeholderProp,
  editorRef,
  toolbarExtras,
  autofocus = false,
  bare = false,
  onAsk,
  onCard,
  onMap,
  terms = [],
  onBoard,
  onMindMap,
}: {
  initialText: string;
  onChange: (text: string) => void;
  // Uploads an image and returns its URL; enables paste/drop/button.
  onUploadImage?: (file: File) => Promise<string>;
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
  // Words that name a concept on a map: underlined, with a card on hover.
  terms?: TermHint[];
  // "/ Pizarra": makes a board and returns its image URL.
  onBoard?: () => Promise<string>;
  // Toolbar mind map: the AI maps the page into a board (its URL) or an error.
  onMindMap?: () => Promise<{ error: string | null; src?: string }>;
}) {
  const t = useT();
  const placeholder = placeholderProp ?? t("Escribe, o usa # para un título, - para una lista, ! para un aviso…");
  const [hint, setHint] = useState<{ i: number; top: number; left: number } | null>(null);
  // The ⋮⋮ handle next to the block under the mouse (drag it, or click for ↑ ↓ 🗑).
  const [handle, setHandle] = useState<{ pos: number; dom: HTMLElement; top: number; left: number } | null>(null);
  const [blockMenu, setBlockMenu] = useState(false);
  const hideHint = useRef<number | null>(null);
  const uploadRef = useRef(onUploadImage);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    uploadRef.current = onUploadImage;
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

  async function insertImages(editor: Editor, files: File[]) {
    const upload = uploadRef.current;
    if (!upload) return;
    setUploading(true);
    try {
      for (const file of files) {
        const url = await upload(file);
        editor.chain().focus().setImage({ src: url }).run();
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
        link: { openOnClick: false, autolink: true, defaultProtocol: "https" },
        heading: { levels: [1, 2, 3] },
      }),
      LetterableOrderedList,
      CalloutShortcut,
      TableKit.configure({ table: { resizable: false } }),
      ImageWithBoards,
      Placeholder.configure({ placeholder }),
      KeyTerms,
      BlockMoves,
      CodeHighlight,
    ],
    content: textToDoc(initialText),
    editorProps: {
      attributes: { class: "rich-editor", "aria-label": t("Contenido de la página") },
      handleKeyDown: (_view, event) => keyRef.current(event),
      handlePaste: (_view, event) => {
        const files = [...(event.clipboardData?.files ?? [])].filter((f) => f.type.startsWith("image/"));
        if (files.length === 0 || !uploadRef.current || !editorInstance.current) return false;
        insertImages(editorInstance.current, files);
        return true;
      },
      handleDrop: (view, event) => {
        if (dropBlock(view, event)) return true;
        const files = [...(event.dataTransfer?.files ?? [])].filter((f) => f.type.startsWith("image/"));
        if (files.length === 0 || !uploadRef.current || !editorInstance.current) return false;
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

  const items = slash ? slashItems(t, !!onUploadImage, !!onBoard).filter((it) => fold(it.label).split(" ").some((w) => w.startsWith(fold(slash.query)))) : [];
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
      setSel(text ? { text, top: a.top - box.top, left: Math.max(0, a.left - box.left) } : null);
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
      <Toolbar editor={editor} onImage={onUploadImage ? () => fileInput.current?.click() : undefined} onBoard={onBoard ? () => onBoard().then((src) => editor.chain().focus().setImage({ src }).createParagraphNear().run()) : undefined} onMindMap={onMindMap ? async () => { const r = await onMindMap(); if (r.src) editor.chain().focus("end").setImage({ src: r.src }).createParagraphNear().run(); return r.error; } : undefined} uploading={uploading} extras={toolbarExtras} bare />
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
          accept="image/*"
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
            {blockMenu && (
              <div className="absolute top-7 left-0 flex gap-0.5 rounded-lg bg-white p-1 shadow-[0_0_0_1px_rgba(15,15,15,.05),0_10px_26px_rgba(15,15,15,.16)]" onMouseLeave={() => setBlockMenu(false)}>
                <Btn onClick={() => moveFromMenu(-1)} title={t("Subir (Ctrl+Shift+↑)")}><ArrowDown size={14} className="rotate-180" /></Btn>
                <Btn onClick={() => moveFromMenu(1)} title={t("Bajar (Ctrl+Shift+↓)")}><ArrowDown size={14} /></Btn>
                <Btn
                  onClick={() => {
                    deleteBlock(editor, handle.pos);
                    setHandle(null);
                    setBlockMenu(false);
                  }}
                  title={t("Eliminar bloque")}
                >
                  <TrashIcon size={14} />
                </Btn>
              </div>
            )}
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
        {sel && <SelectionBar editor={editor} sel={sel} onAsk={onAsk} onCard={onCard} onMap={onMap} />}
        {hint && hinted && !sel && (
          <div
            className="absolute z-20 flex w-72 flex-col gap-1 rounded-lg bg-white p-3 text-sm shadow-[0_0_0_1px_rgba(15,15,15,.05),0_10px_26px_rgba(15,15,15,.16)]"
            style={{ top: hint.top, left: hint.left }}
            onMouseEnter={() => hideHint.current && window.clearTimeout(hideHint.current)}
            onMouseLeave={leaveTerm}
          >
            <span className="font-semibold">{hinted.title}</span>
            {hinted.summary && <p className="text-ink-muted">{hinted.summary}</p>}
            <Link href={hinted.href} className="mt-1 flex items-center gap-1.5 self-start text-xs text-accent hover:underline">
              <MapIcon size={14} /> {hinted.where}
            </Link>
          </div>
        )}
        {uploading && <span className="absolute top-0 right-0 text-xs text-ink-faint">{t("Subiendo…")}</span>}
      </div>
      </>
    );
  }

  return (
    <div className="flex flex-col rounded-2xl border border-border-subtle bg-white">
      <Toolbar
        editor={editor}
        onImage={onUploadImage ? () => fileInput.current?.click() : undefined}
        onBoard={onBoard ? () => onBoard().then((src) => editor.chain().focus().setImage({ src }).createParagraphNear().run()) : undefined} onMindMap={onMindMap ? async () => { const r = await onMindMap(); if (r.src) editor.chain().focus("end").setImage({ src: r.src }).createParagraphNear().run(); return r.error; } : undefined}
        uploading={uploading}
        extras={toolbarExtras}
      />
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
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
  onBoard,
  onMindMap,
  uploading,
  extras,
  bare = false,
}: {
  editor: Editor;
  onImage?: () => void;
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
      bullet: e.isActive("bulletList"),
      numbered: e.isActive("orderedList", { kind: "decimal" }),
      lettered: e.isActive("orderedList", { kind: "alpha" }),
      callout: e.isActive("blockquote"),
      code: e.isActive("codeBlock"),
      codeLang: (e.getAttributes("codeBlock").language as string | null) ?? "",
      table: e.isActive("table"),
      link: e.isActive("link"),
    }),
  });
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
  function setLink() {
    if (s.link) return c().unsetLink().run();
    const url = window.prompt(t("URL del enlace"));
    if (url) c().extendMarkRange("link").setLink({ href: url }).run();
  }

  return (
    <div className={`sticky top-0 z-10 flex flex-wrap items-center gap-0.5 border-border-subtle bg-white/95 px-2 py-1.5 backdrop-blur ${bare ? "mb-3 rounded-xl border" : "rounded-t-2xl border-b"}`}>
      <Btn on={s.h1} onClick={() => c().toggleHeading({ level: 1 }).run()} title={t("Título 1 (# )")}>H1</Btn>
      <Btn on={s.h2} onClick={() => c().toggleHeading({ level: 2 }).run()} title={t("Título 2 (## )")}>H2</Btn>
      <Btn on={s.h3} onClick={() => c().toggleHeading({ level: 3 }).run()} title={t("Título 3 (### )")}>H3</Btn>
      <Sep />
      <Btn on={s.bold} onClick={() => c().toggleBold().run()} title={t("Negrita (Ctrl+B)")}><b>{t("N")}</b></Btn>
      <Btn on={s.italic} onClick={() => c().toggleItalic().run()} title={t("Cursiva (Ctrl+I)")}><i>{t("K")}</i></Btn>
      <Btn on={s.underline} onClick={() => c().toggleUnderline().run()} title={t("Subrayado (Ctrl+U)")}><u>{t("S")}</u></Btn>
      <Btn on={s.link} onClick={setLink} title={t("Enlace")}><LinkIcon /></Btn>
      <Sep />
      <Btn on={s.bullet} onClick={() => c().toggleBulletList().run()} title={t("Lista (- )")}>•</Btn>
      <Btn on={s.numbered} onClick={toggleNumbered} title={t("Lista numerada (1. )")}>1.</Btn>
      <Btn on={s.lettered} onClick={toggleLettered} title={t("Lista con letras")}>a.</Btn>
      <Btn on={s.callout} onClick={() => c().toggleBlockquote().run()} title={t("Aviso (! )")}><QuoteIcon /></Btn>
      <Btn on={s.code} onClick={() => c().toggleCodeBlock().run()} title={t("Bloque de código (```)")}>{"</>"}</Btn>
      {s.code && (
        <CodeLangMenu value={s.codeLang} onChange={(v) => c().updateAttributes("codeBlock", { language: v || null }).run()} />
      )}
      <Btn on={s.table} onClick={() => c().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} title={t("Insertar tabla")}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><rect x="3.5" y="4.5" width="17" height="15" rx="2" /><path d="M3.5 9.5h17M3.5 14.5h17M9.5 9.5v10M14.5 9.5v10" /></svg></Btn>
      {s.table && (
        <span className="flex items-center gap-0.5 rounded-md bg-chip px-1 text-xs">
          <Btn onClick={() => c().toggleHeaderRow().run()} title={t("Primera fila como cabecera")}>{t("Cabecera")}</Btn>
          <Btn onClick={() => c().addRowAfter().run()} title={t("Añadir fila")}>{t("+fila")}</Btn>
          <Btn onClick={() => c().addColumnAfter().run()} title={t("Añadir columna")}>{t("+col")}</Btn>
          <Btn onClick={() => c().deleteRow().run()} title={t("Eliminar fila")}>{t("−fila")}</Btn>
          <Btn onClick={() => c().deleteColumn().run()} title={t("Eliminar columna")}>{t("−col")}</Btn>
          <Btn onClick={() => c().deleteTable().run()} title={t("Eliminar tabla")}><XIcon /></Btn>
        </span>
      )}
      {onImage && (
        <Btn onClick={onImage} title={t("Insertar imagen (o pégala / arrástrala)")}>{uploading ? "…" : <ImageIcon />}</Btn>
      )}
      {onMindMap && <MindMapBtn run={onMindMap} />}
      {onBoard && (
        <Btn onClick={onBoard} title={t("Pizarra: dibuja a mano")}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M3 5h18v11H3zM8 20l4-4 4 4M7 12l3-3 2 2 4-4" />
          </svg>
        </Btn>
      )}
      {extras && (
        <>
          <Sep />
          {extras}
        </>
      )}
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

const fold = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

function slashItems(t: T, images: boolean, boards = false): SlashItem[] {
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
  ];
}

// Floats over selected text: format it, or turn it into a question/card.
function SelectionBar({
  editor,
  sel,
  onAsk,
  onCard,
  onMap,
}: {
  editor: Editor;
  sel: Sel;
  onAsk?: (text: string) => Promise<{ error: string | null; answer?: string }>;
  onCard?: (text: string) => Promise<{ error: string | null }>;
  onMap?: (text: string) => Promise<{ error: string | null; href?: string }>;
}) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<{ text: string; tone: "answer" | "ok" | "error"; href?: string } | null>(null);
  const s = useEditorState({ editor, selector: ({ editor: e }) => ({ bold: e.isActive("bold"), italic: e.isActive("italic"), link: e.isActive("link") }) });
  const c = () => editor.chain().focus();
  async function go(fn: () => Promise<{ error: string | null; answer?: string; href?: string }>, ok: string) {
    setBusy(true);
    setOut(null);
    const r = await fn();
    setBusy(false);
    setOut(r.error ? { text: r.error, tone: "error" } : r.answer ? { text: r.answer, tone: "answer" } : { text: ok, tone: "ok", href: r.href });
  }
  return (
    <div className="absolute z-20 flex max-w-[min(420px,100%)] -translate-y-full flex-col gap-1 pb-2" style={{ top: sel.top, left: sel.left }}>
      <div className="flex items-center gap-0.5 self-start rounded-lg bg-white p-1 text-sm shadow-[0_0_0_1px_rgba(15,15,15,.05),0_10px_26px_rgba(15,15,15,.16)]">
        <Btn on={s.bold} onClick={() => c().toggleBold().run()} title={t("Negrita")}><b>{t("N")}</b></Btn>
        <Btn on={s.italic} onClick={() => c().toggleItalic().run()} title={t("Cursiva")}><i>{t("K")}</i></Btn>
        <Btn
          on={s.link}
          onClick={() => {
            if (s.link) return c().unsetLink().run();
            const url = window.prompt(t("URL del enlace"));
            if (url) c().extendMarkRange("link").setLink({ href: url }).run();
          }}
          title={t("Enlace")}
        >
          <LinkIcon />
        </Btn>
        {(onAsk || onCard || onMap) && <Sep />}
        {onAsk && (
          <button type="button" disabled={busy} onMouseDown={(e) => e.preventDefault()} onClick={() => go(() => onAsk(sel.text), "")} className="flex items-center gap-1.5 rounded-md px-2 py-1 text-accent hover:bg-chip disabled:opacity-50">
            <SparkIcon size={14} />{" "}{t("Preguntar a la IA")}
          </button>
        )}
        {onCard && (
          <button type="button" disabled={busy} onMouseDown={(e) => e.preventDefault()} onClick={() => go(() => onCard(sel.text), t("Tarjeta creada"))} title={t("Crear tarjeta")} aria-label={t("Crear tarjeta")} className="rounded-md px-2 py-1 text-ink-muted hover:bg-chip hover:text-ink disabled:opacity-50">
            <CardsIcon size={15} />
          </button>
        )}
        {onMap && (
          <button type="button" disabled={busy} onMouseDown={(e) => e.preventDefault()} onClick={() => go(() => onMap(sel.text), t("En el mapa"))} title={t("Añadir al mapa")} aria-label={t("Añadir al mapa")} className="rounded-md px-2 py-1 text-ink-muted hover:bg-chip hover:text-ink disabled:opacity-50">
            <MapIcon size={15} />
          </button>
        )}
      </div>
      {(busy || out) && (
        <div className={`rounded-lg bg-white px-3 py-2 text-sm shadow-[0_0_0_1px_rgba(15,15,15,.05),0_10px_26px_rgba(15,15,15,.16)] ${out?.tone === "error" ? "text-red-500" : out?.tone === "ok" ? "text-[#448361]" : ""}`}>
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
function MindMapBtn({ run }: { run: () => Promise<string | null> }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <span className="relative">
      <Btn
        onClick={async () => {
          if (busy) return;
          setBusy(true);
          setErr(null);
          const e = await run().catch(() => t("Inténtalo de nuevo"));
          setBusy(false);
          if (e) {
            setErr(e);
            setTimeout(() => setErr(null), 4000);
          }
        }}
        title={busy ? t("Haciendo tu mapa mental…") : t("Mapa mental de esta página (IA)")}
      >
        {busy ? (
          <span className="block size-4 animate-spin rounded-full border-2 border-ink/20 border-t-ink/70" />
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="12" cy="12" r="3" />
            <circle cx="4.5" cy="5.5" r="2" />
            <circle cx="19.5" cy="5.5" r="2" />
            <circle cx="4.5" cy="18.5" r="2" />
            <circle cx="19.5" cy="18.5" r="2" />
            <path d="M9.6 10.2 6.2 7M14.4 10.2l3.4-3.2M9.6 13.8 6.2 17M14.4 13.8l3.4 3.2" />
          </svg>
        )}
      </Btn>
      {err && <span className="absolute top-full right-0 z-30 mt-1 w-56 rounded-lg bg-ink px-2.5 py-1.5 text-xs text-white shadow-lg">{err}</span>}
    </span>
  );
}
