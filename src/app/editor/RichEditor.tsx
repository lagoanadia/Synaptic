"use client";

import { ImageIcon, LinkIcon, QuoteIcon, XIcon } from "@/app/icons";
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
  { value: "", label: "Plain" },
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
  placeholder = "Write, or type # for a heading, - for a list, ! for a callout…",
  editorRef,
  toolbarExtras,
  autofocus = false,
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
}) {
  const uploadRef = useRef(onUploadImage);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    uploadRef.current = onUploadImage;
    onChangeRef.current = onChange;
  });
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

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
      attributes: { class: "rich-editor", "aria-label": "Page content" },
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
    onUpdate: ({ editor }) => onChangeRef.current(docToText(editor.getJSON())),
  });
  const editorInstance = useRef<Editor | null>(null);
  useEffect(() => {
    editorInstance.current = editor;
    if (editorRef) editorRef.current = editor;
  }, [editor, editorRef]);

  if (!editor) {
    return <div className="min-h-64 rounded-2xl bg-white" aria-busy="true" />;
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
    const url = window.prompt("Link URL");
    if (url) c().extendMarkRange("link").setLink({ href: url }).run();
  }

  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-0.5 rounded-t-2xl border-b border-border-subtle bg-white/95 px-2 py-1.5 backdrop-blur">
      <Btn on={s.h1} onClick={() => c().toggleHeading({ level: 1 }).run()} title="Heading 1 (# )">H1</Btn>
      <Btn on={s.h2} onClick={() => c().toggleHeading({ level: 2 }).run()} title="Heading 2 (## )">H2</Btn>
      <Btn on={s.h3} onClick={() => c().toggleHeading({ level: 3 }).run()} title="Heading 3 (### )">H3</Btn>
      <Sep />
      <Btn on={s.bold} onClick={() => c().toggleBold().run()} title="Bold (Ctrl+B)"><b>B</b></Btn>
      <Btn on={s.italic} onClick={() => c().toggleItalic().run()} title="Italic (Ctrl+I)"><i>I</i></Btn>
      <Btn on={s.underline} onClick={() => c().toggleUnderline().run()} title="Underline (Ctrl+U)"><u>U</u></Btn>
      <Btn on={s.link} onClick={setLink} title="Link"><LinkIcon /></Btn>
      <Sep />
      <Btn on={s.bullet} onClick={() => c().toggleBulletList().run()} title="Bullet list (- )">•</Btn>
      <Btn on={s.numbered} onClick={toggleNumbered} title="Numbered list (1. )">1.</Btn>
      <Btn on={s.lettered} onClick={toggleLettered} title="Lettered list">a.</Btn>
      <Btn on={s.callout} onClick={() => c().toggleBlockquote().run()} title="Callout (! )"><QuoteIcon /></Btn>
      <Btn on={s.code} onClick={() => c().toggleCodeBlock().run()} title="Code block (```)">{"</>"}</Btn>
      {s.code && (
        <select
          value={s.codeLang}
          onChange={(e) => c().updateAttributes("codeBlock", { language: e.target.value || null }).run()}
          aria-label="Code language"
          className="rounded-md border border-border-subtle px-1.5 py-1 text-xs"
        >
          {CODE_LANGUAGES.map((l) => (
            <option key={l.value} value={l.value}>{l.label}</option>
          ))}
        </select>
      )}
      <Btn on={s.table} onClick={() => c().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} title="Insert table">▦</Btn>
      {s.table && (
        <span className="flex items-center gap-0.5 rounded-md bg-chip px-1 text-xs">
          <Btn onClick={() => c().addRowAfter().run()} title="Add row">+row</Btn>
          <Btn onClick={() => c().addColumnAfter().run()} title="Add column">+col</Btn>
          <Btn onClick={() => c().deleteRow().run()} title="Delete row">−row</Btn>
          <Btn onClick={() => c().deleteColumn().run()} title="Delete column">−col</Btn>
          <Btn onClick={() => c().deleteTable().run()} title="Delete table"><XIcon /></Btn>
        </span>
      )}
      {onImage && (
        <Btn onClick={onImage} title="Insert image (or paste/drop one)">{uploading ? "…" : <ImageIcon />}</Btn>
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
