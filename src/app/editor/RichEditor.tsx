"use client";

import { CardsIcon, ImageIcon, LinkIcon, QuoteIcon, SparkIcon, XIcon } from "@/app/icons";
import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import { Extension, wrappingInputRule } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { OrderedList } from "@tiptap/extension-list";
import { TableKit } from "@tiptap/extension-table";
import Image from "@tiptap/extension-image";
import { Placeholder } from "@tiptap/extensions";
import { docToText, textToDoc } from "@/lib/richText";

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

const CODE_LANGUAGES = [
  { value: "", label: "Texto" },
  { value: "js", label: "JavaScript" },
  { value: "ts", label: "TypeScript" },
  { value: "python", label: "Python" },
  { value: "java", label: "Java" },
  { value: "sql", label: "SQL" },
];

// WYSIWYG editor with markdown shortcuts ("# ", "- ", "1. ", "! ", "**b**").
// Reads and writes the stored text format (lib/richText.ts).
export function RichEditor({
  initialText,
  onChange,
  onUploadImage,
  placeholder = "Escribe, o usa # para un título, - para una lista, ! para un aviso…",
  editorRef,
  toolbarExtras,
  autofocus = false,
  bare = false,
  onAsk,
  onCard,
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
}) {
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
      Image,
      Placeholder.configure({ placeholder }),
    ],
    content: textToDoc(initialText),
    editorProps: {
      attributes: { class: "rich-editor", "aria-label": "Contenido de la página" },
      handleKeyDown: (_view, event) => keyRef.current(event),
      handlePaste: (_view, event) => {
        const files = [...(event.clipboardData?.files ?? [])].filter((f) => f.type.startsWith("image/"));
        if (files.length === 0 || !uploadRef.current || !editorInstance.current) return false;
        insertImages(editorInstance.current, files);
        return true;
      },
      handleDrop: (_view, event) => {
        const files = [...(event.dataTransfer?.files ?? [])].filter((f) => f.type.startsWith("image/"));
        if (files.length === 0 || !uploadRef.current || !editorInstance.current) return false;
        insertImages(editorInstance.current, files);
        return true;
      },
    },
    onUpdate: ({ editor }) => {
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

  const items = slash ? slashItems(!!onUploadImage).filter((it) => fold(it.label).split(" ").some((w) => w.startsWith(fold(slash.query)))) : [];
  const pick = (it: SlashItem) => {
    if (!slash || !editor) return;
    const to = editor.state.selection.from;
    it.run(editor.chain().focus().deleteRange({ from: slash.from, to }));
    if (it.image) fileInput.current?.click();
    setSlash(null);
  };

  // Where things sit, relative to the editor box.
  useEffect(() => {
  refreshRef.current = (e) => {
    if (!bare || !wrap.current) return;
    const box = wrap.current.getBoundingClientRect();
    const { from, to, empty, $from } = e.state.selection;
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
      <div ref={wrap} className="relative">
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
        <EditorContent editor={editor} />
        {slash && items.length > 0 && (
          <div
            className="absolute z-20 flex w-60 flex-col rounded-lg bg-white p-1 text-sm shadow-[0_0_0_1px_rgba(15,15,15,.05),0_10px_26px_rgba(15,15,15,.16)]"
            style={{ top: slash.top, left: slash.left }}
            role="listbox"
            aria-label="Bloques"
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
                {it.label}
              </button>
            ))}
          </div>
        )}
        {sel && <SelectionBar editor={editor} sel={sel} onAsk={onAsk} onCard={onCard} />}
        {uploading && <span className="absolute top-0 right-0 text-xs text-ink-faint">Subiendo…</span>}
      </div>
    );
  }

  return (
    <div className="flex flex-col rounded-2xl border border-border-subtle bg-white">
      <Toolbar
        editor={editor}
        onImage={onUploadImage ? () => fileInput.current?.click() : undefined}
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
  uploading,
  extras,
}: {
  editor: Editor;
  onImage?: () => void;
  uploading: boolean;
  extras?: React.ReactNode;
}) {
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
    const url = window.prompt("URL del enlace");
    if (url) c().extendMarkRange("link").setLink({ href: url }).run();
  }

  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-0.5 rounded-t-2xl border-b border-border-subtle bg-white/95 px-2 py-1.5 backdrop-blur">
      <Btn on={s.h1} onClick={() => c().toggleHeading({ level: 1 }).run()} title="Título 1 (# )">H1</Btn>
      <Btn on={s.h2} onClick={() => c().toggleHeading({ level: 2 }).run()} title="Título 2 (## )">H2</Btn>
      <Btn on={s.h3} onClick={() => c().toggleHeading({ level: 3 }).run()} title="Título 3 (### )">H3</Btn>
      <Sep />
      <Btn on={s.bold} onClick={() => c().toggleBold().run()} title="Negrita (Ctrl+B)"><b>N</b></Btn>
      <Btn on={s.italic} onClick={() => c().toggleItalic().run()} title="Cursiva (Ctrl+I)"><i>K</i></Btn>
      <Btn on={s.underline} onClick={() => c().toggleUnderline().run()} title="Subrayado (Ctrl+U)"><u>S</u></Btn>
      <Btn on={s.link} onClick={setLink} title="Enlace"><LinkIcon /></Btn>
      <Sep />
      <Btn on={s.bullet} onClick={() => c().toggleBulletList().run()} title="Lista (- )">•</Btn>
      <Btn on={s.numbered} onClick={toggleNumbered} title="Lista numerada (1. )">1.</Btn>
      <Btn on={s.lettered} onClick={toggleLettered} title="Lista con letras">a.</Btn>
      <Btn on={s.callout} onClick={() => c().toggleBlockquote().run()} title="Aviso (! )"><QuoteIcon /></Btn>
      <Btn on={s.code} onClick={() => c().toggleCodeBlock().run()} title="Bloque de código (```)">{"</>"}</Btn>
      {s.code && (
        <select
          value={s.codeLang}
          onChange={(e) => c().updateAttributes("codeBlock", { language: e.target.value || null }).run()}
          aria-label="Lenguaje del código"
          className="rounded-md border border-border-subtle px-1.5 py-1 text-xs"
        >
          {CODE_LANGUAGES.map((l) => (
            <option key={l.value} value={l.value}>{l.label}</option>
          ))}
        </select>
      )}
      <Btn on={s.table} onClick={() => c().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} title="Insertar tabla">▦</Btn>
      {s.table && (
        <span className="flex items-center gap-0.5 rounded-md bg-chip px-1 text-xs">
          <Btn onClick={() => c().addRowAfter().run()} title="Añadir fila">+fila</Btn>
          <Btn onClick={() => c().addColumnAfter().run()} title="Añadir columna">+col</Btn>
          <Btn onClick={() => c().deleteRow().run()} title="Eliminar fila">−fila</Btn>
          <Btn onClick={() => c().deleteColumn().run()} title="Eliminar columna">−col</Btn>
          <Btn onClick={() => c().deleteTable().run()} title="Eliminar tabla"><XIcon /></Btn>
        </span>
      )}
      {onImage && (
        <Btn onClick={onImage} title="Insertar imagen (o pégala / arrástrala)">{uploading ? "…" : <ImageIcon />}</Btn>
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

const Sep = () => <span className="mx-1 h-5 w-px bg-border-subtle" aria-hidden />;

type Slash = { from: number; query: string; top: number; left: number; index: number };
type Sel = { text: string; top: number; left: number };
type Chain = ReturnType<Editor["chain"]>;
type SlashItem = { label: string; icon: React.ReactNode; run: (c: Chain) => void; image?: boolean };

const fold = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

function slashItems(images: boolean): SlashItem[] {
  return [
    { label: "Título", icon: "H1", run: (c) => c.setHeading({ level: 1 }).run() },
    { label: "Subtítulo", icon: "H2", run: (c) => c.setHeading({ level: 2 }).run() },
    { label: "Apartado", icon: "H3", run: (c) => c.setHeading({ level: 3 }).run() },
    { label: "Lista", icon: "•", run: (c) => c.toggleBulletList().run() },
    { label: "Lista numerada", icon: "1.", run: (c) => c.toggleOrderedList().run() },
    { label: "Aviso", icon: <QuoteIcon />, run: (c) => c.toggleBlockquote().run() },
    { label: "Código", icon: "</>", run: (c) => c.toggleCodeBlock().run() },
    { label: "Tabla", icon: "▦", run: (c) => c.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
    ...(images ? [{ label: "Imagen", icon: <ImageIcon />, run: (c: Chain) => c.run(), image: true }] : []),
  ];
}

// Floats over selected text: format it, or turn it into a question/card.
function SelectionBar({
  editor,
  sel,
  onAsk,
  onCard,
}: {
  editor: Editor;
  sel: Sel;
  onAsk?: (text: string) => Promise<{ error: string | null; answer?: string }>;
  onCard?: (text: string) => Promise<{ error: string | null }>;
}) {
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<{ text: string; tone: "answer" | "ok" | "error" } | null>(null);
  const s = useEditorState({ editor, selector: ({ editor: e }) => ({ bold: e.isActive("bold"), italic: e.isActive("italic"), link: e.isActive("link") }) });
  const c = () => editor.chain().focus();
  async function go(fn: () => Promise<{ error: string | null; answer?: string }>, ok: string) {
    setBusy(true);
    setOut(null);
    const r = await fn();
    setBusy(false);
    setOut(r.error ? { text: r.error, tone: "error" } : r.answer ? { text: r.answer, tone: "answer" } : { text: ok, tone: "ok" });
  }
  return (
    <div className="absolute z-20 flex max-w-[min(420px,100%)] -translate-y-full flex-col gap-1 pb-2" style={{ top: sel.top, left: sel.left }}>
      <div className="flex items-center gap-0.5 self-start rounded-lg bg-white p-1 text-sm shadow-[0_0_0_1px_rgba(15,15,15,.05),0_10px_26px_rgba(15,15,15,.16)]">
        <Btn on={s.bold} onClick={() => c().toggleBold().run()} title="Negrita"><b>N</b></Btn>
        <Btn on={s.italic} onClick={() => c().toggleItalic().run()} title="Cursiva"><i>K</i></Btn>
        <Btn
          on={s.link}
          onClick={() => {
            if (s.link) return c().unsetLink().run();
            const url = window.prompt("URL del enlace");
            if (url) c().extendMarkRange("link").setLink({ href: url }).run();
          }}
          title="Enlace"
        >
          <LinkIcon />
        </Btn>
        {(onAsk || onCard) && <Sep />}
        {onAsk && (
          <button type="button" disabled={busy} onMouseDown={(e) => e.preventDefault()} onClick={() => go(() => onAsk(sel.text), "")} className="flex items-center gap-1.5 rounded-md px-2 py-1 text-accent hover:bg-chip disabled:opacity-50">
            <SparkIcon size={14} /> Preguntar a la IA
          </button>
        )}
        {onCard && (
          <button type="button" disabled={busy} onMouseDown={(e) => e.preventDefault()} onClick={() => go(() => onCard(sel.text), "Tarjeta creada")} title="Crear tarjeta" aria-label="Crear tarjeta" className="rounded-md px-2 py-1 text-ink-muted hover:bg-chip hover:text-ink disabled:opacity-50">
            <CardsIcon size={15} />
          </button>
        )}
      </div>
      {(busy || out) && (
        <div className={`rounded-lg bg-white px-3 py-2 text-sm shadow-[0_0_0_1px_rgba(15,15,15,.05),0_10px_26px_rgba(15,15,15,.16)] ${out?.tone === "error" ? "text-red-500" : out?.tone === "ok" ? "text-[#448361]" : ""}`}>
          {busy ? <span className="block h-2 w-28 animate-pulse rounded bg-chip" /> : <p className="max-h-60 overflow-y-auto whitespace-pre-line">{out?.text}</p>}
        </div>
      )}
    </div>
  );
}
