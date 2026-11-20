"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";
import { useRef, useState } from "react";
import { useT } from "@/app/LangProvider";
import { CoverFill } from "@/app/Covers";
import { Popover } from "@/app/ui/Popover";
import { FOLDER_COVERS, FOLDER_GROUPS, folderCover, type FolderCover } from "@/lib/covers";

// Asks the page to open a PDF in its slides panel, on the left.
export const OPEN_PDF_EVENT = "synaptic:open-pdf";
export type OpenPdfDetail = { name: string; url: string };
export const openPdf = (detail: OpenPdfDetail) => window.dispatchEvent(new CustomEvent<OpenPdfDetail>(OPEN_PDF_EVENT, { detail }));

// "Enunciado.pdf" → "Enunciado"; underscores and dashes become spaces.
export const pdfTitle = (fileName: string) =>
  fileName
    .replace(/\.pdf$/i, "")
    .replace(/[_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim() || "PDF";

const coverOf = (src: string, cover: string): FolderCover => (cover && cover in FOLDER_COVERS ? (cover as FolderCover) : folderCover(src, null));

function PdfCardView({ node, updateAttributes, editor, selected }: NodeViewProps) {
  const t = useT();
  const src = String(node.attrs.src ?? "");
  const title = String(node.attrs.title ?? "");
  const cover = coverOf(src, String(node.attrs.cover ?? ""));
  const editable = editor.isEditable;
  const [picking, setPicking] = useState(false);
  const paint = useRef<HTMLButtonElement>(null);

  return (
    <NodeViewWrapper className="my-2" data-drag-handle>
      <div
        contentEditable={false}
        className={`group/pdf relative w-full max-w-[340px] overflow-hidden rounded-xl bg-white shadow-[0_0_0_1px_rgba(15,15,15,.07),0_2px_6px_rgba(15,15,15,.06),0_12px_28px_-14px_rgba(15,15,15,.3)] transition-shadow ${selected ? "ring-2 ring-accent/50" : ""}`}
      >
        {/* The banner: a cover print. Click to open the PDF beside the page. */}
        <button type="button" onClick={() => openPdf({ name: title || "PDF", url: src })} title={t("Abrir al lado")} className="relative block aspect-[16/10] w-full cursor-pointer">
          <CoverFill cover={cover} />
          <span className="absolute top-2.5 left-2.5 rounded-md bg-black/45 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-white backdrop-blur-sm">PDF</span>
          <span className="absolute inset-0 grid place-items-center bg-black/0 opacity-0 transition group-hover/pdf:bg-black/20 group-hover/pdf:opacity-100">
            <span className="flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-[#37352f] shadow">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <rect x="3" y="4" width="18" height="13" rx="2" />
                <path d="M8 21h8M12 17v4" />
              </svg>
              {t("Abrir al lado")}
            </span>
          </span>
        </button>
        {editable && (
          <button
            ref={paint}
            type="button"
            onClick={() => setPicking((p) => !p)}
            title={t("Cambiar estampado")}
            aria-label={t("Cambiar estampado")}
            className="absolute top-2 right-2 grid size-7 place-items-center rounded-md bg-white/90 text-[#37352f] opacity-0 shadow-sm transition group-hover/pdf:opacity-100 focus-visible:opacity-100 max-md:opacity-100"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.6-.9 1.6-1.7 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-.9.8-1.7 1.7-1.7H16a5 5 0 0 0 5-5c0-4-4-7.2-9-7.2z" />
              <circle cx="7.5" cy="11" r="1" fill="currentColor" />
              <circle cx="10" cy="7" r="1" fill="currentColor" />
              <circle cx="15" cy="7" r="1" fill="currentColor" />
            </svg>
          </button>
        )}
        <div className="bg-chip px-4 py-3">
          {editable ? (
            <input
              value={title}
              onChange={(e) => updateAttributes({ title: e.target.value })}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") e.currentTarget.blur();
              }}
              placeholder={t("Título")}
              aria-label={t("Título del PDF")}
              className="w-full truncate bg-transparent text-lg font-bold tracking-tight text-ink uppercase outline-none placeholder:text-ink-faint"
            />
          ) : (
            <span className="block truncate text-lg font-bold tracking-tight text-ink uppercase">{title || "PDF"}</span>
          )}
        </div>
      </div>
      <Popover anchor={paint} open={picking} onClose={() => setPicking(false)} align="end" label={t("Cambiar estampado")}>
        <div className="flex max-h-80 w-[268px] flex-col gap-3 overflow-y-auto p-3">
          {FOLDER_GROUPS.map((g) => (
            <div key={g.name} className="flex flex-col gap-1.5">
              <span className="text-[10.5px] font-semibold tracking-wide text-ink-faint uppercase">{t(g.name)}</span>
              <div className="grid grid-cols-6 gap-1.5">
                {g.covers.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={c}
                    aria-pressed={c === cover}
                    onClick={() => {
                      updateAttributes({ cover: c });
                      setPicking(false);
                    }}
                    className={`relative aspect-square overflow-hidden rounded-md ${c === cover ? "ring-2 ring-accent ring-offset-2 ring-offset-white" : "hover:opacity-80"}`}
                  >
                    <CoverFill cover={c} scale={1} />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Popover>
    </NodeViewWrapper>
  );
}

// A PDF in a page, as a card: a cover-print banner and its title. Stored as
// "![pdf:cover:Title](url)" (lib/text.ts).
export const PdfCard = Node.create({
  name: "pdfCard",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes() {
    return { src: { default: "" }, title: { default: "" }, cover: { default: "" } };
  },
  parseHTML() {
    return [{ tag: "div[data-pdf-card]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-pdf-card": "" })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(PdfCardView);
  },
});
