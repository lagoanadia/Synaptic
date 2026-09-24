"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import { addBrainDump, updateBrainDump, type FormState } from "../../actions";
import { parseContent, type ContentSegment } from "@/lib/text";

const initialState: FormState = { error: null };

type Block = ContentSegment;

// Content is still saved as plain text with `![image](url)` markers (see
// src/lib/text.ts's parseContent) — that part hasn't changed. What changed
// is how it's composed: instead of one plain <textarea> where an inserted
// image just showed up as raw marker text, the page is now a sequence of
// blocks (text / image), so an inserted image renders as a real picture
// right where the cursor was, with separate text blocks before and after
// it that you can keep typing into.
function serialize(blocks: Block[]): string {
  return blocks
    .map((b) => (b.type === "text" ? b.value : `![image](${b.url})`))
    .join("");
}

// The last block is always assumed to be text (that's what lets an image
// be inserted "at the end" and typing continue) — parseContent doesn't
// guarantee that for arbitrary saved content, so pad it if needed.
function blocksFromContent(content: string): Block[] {
  const segments = parseContent(content);
  if (segments.length === 0) return [{ type: "text", value: "" }];
  const last = segments[segments.length - 1];
  return last.type === "text" ? segments : [...segments, { type: "text", value: "" }];
}

// Resetting height to "auto" before re-measuring makes the textarea briefly
// collapse to one line, which shifts the caret's position on the page for a
// moment — long enough that the browser "helpfully" scrolls to keep it in
// view, snapping the page to wherever you're typing even if you'd
// deliberately scrolled elsewhere. Saving and restoring the scroll position
// around the resize cancels that out.
function autoResize(el: HTMLTextAreaElement) {
  const scrollY = window.scrollY;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
  window.scrollTo(0, scrollY);
}

export function NewDumpForm({
  pursuitId,
  dumpId,
  initialContent,
}: {
  pursuitId: string;
  dumpId?: string;
  initialContent?: string;
}) {
  const router = useRouter();
  const isEditing = dumpId !== undefined;
  const [state, formAction, isPending] = useActionState(
    isEditing
      ? updateBrainDump.bind(null, pursuitId, dumpId)
      : addBrainDump.bind(null, pursuitId),
    initialState,
  );

  const [blocks, setBlocks] = useState<Block[]>(() =>
    initialContent ? blocksFromContent(initialContent) : [{ type: "text", value: "" }],
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const textareaRefs = useRef<Record<number, HTMLTextAreaElement | null>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [tablePickerOpen, setTablePickerOpen] = useState(false);
  const tableRowsRef = useRef<HTMLInputElement>(null);
  const tableColsRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const content = useMemo(() => serialize(blocks), [blocks]);

  // redirect() inside the server action + useActionState crashed the page
  // (minified React error #441), so navigation happens here instead, once
  // the action reports success.
  useEffect(() => {
    if (state.success) {
      router.push(
        isEditing
          ? `/pursuits/${pursuitId}/dump/${dumpId}`
          : `/pursuits/${pursuitId}?tab=dump`,
      );
    }
  }, [state.success, router, pursuitId, isEditing, dumpId]);

  // New text blocks (e.g. the "after" half created when an image is
  // inserted) start with no rendered height until the browser has laid
  // them out, so re-measure whenever the block list changes shape.
  useEffect(() => {
    Object.values(textareaRefs.current).forEach((el) => {
      if (el) autoResize(el);
    });
  }, [blocks.length]);

  function updateTextBlock(index: number, value: string) {
    setBlocks((prev) => {
      const next = [...prev];
      next[index] = { type: "text", value };
      return next;
    });
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow picking the same file again later
    if (!file) return;

    setUploadError(null);
    setIsUploading(true);
    try {
      // Uploaded directly from the browser to Blob storage (not through a
      // Server Action) — a Server Action's request body is capped at 1MB,
      // which a normal phone photo blows past, and it was failing silently.
      const blob = await upload(`dumps/${pursuitId}/${file.name}`, file, {
        access: "public",
        handleUploadUrl: "/api/blob-upload",
        clientPayload: pursuitId,
      });
      insertImageAtActiveBlock(blob.url);
    } catch {
      setUploadError("Couldn't upload that image — try again");
    } finally {
      setIsUploading(false);
    }
  }

  function insertImageAtActiveBlock(url: string) {
    setBlocks((prev) => {
      const index = activeIndex;
      const block = prev[index];
      if (!block || block.type !== "text") {
        return [...prev, { type: "image", url }, { type: "text", value: "" }];
      }
      const textarea = textareaRefs.current[index];
      const cursor = textarea ? textarea.selectionStart : block.value.length;
      const before = block.value.slice(0, cursor);
      const after = block.value.slice(cursor);
      const next: Block[] = [
        ...prev.slice(0, index),
        { type: "text", value: before },
        { type: "image", url },
        { type: "text", value: after },
        ...prev.slice(index + 1),
      ];
      // The block that used to be at `index` shifted two slots down —
      // that's the new "after" text, where typing should continue.
      requestAnimationFrame(() => {
        const el = textareaRefs.current[index + 2];
        el?.focus();
        el?.setSelectionRange(0, 0);
      });
      return next;
    });
  }

  // Drops a ready-made "| | | |" skeleton (rows × cols, all cells empty) at
  // the cursor — not a clickable cell-by-cell grid like Google Docs (this
  // is still a plain <textarea>, not a rich editor), but it saves typing
  // out every pipe by hand. The first row renders as the table's header.
  function insertTableAtActiveBlock(rows: number, cols: number) {
    setBlocks((prev) => {
      const index = activeIndex;
      const block = prev[index];
      if (!block || block.type !== "text") return prev;

      const textarea = textareaRefs.current[index];
      const cursor = textarea ? textarea.selectionStart : block.value.length;
      const before = block.value.slice(0, cursor);
      const after = block.value.slice(cursor);

      const row = "|" + " |".repeat(cols);
      const tableText = Array(rows).fill(row).join("\n");
      const leading = before.length > 0 && !before.endsWith("\n") ? "\n" : "";
      const trailing = after.length > 0 && !after.startsWith("\n") ? "\n" : "";
      const insertion = `${leading}${tableText}${trailing}`;

      const next = [...prev];
      next[index] = { type: "text", value: before + insertion + after };

      // Lands the caret right inside the first cell so typing can start
      // immediately instead of clicking to find it.
      const cellPos = before.length + leading.length + 2;
      requestAnimationFrame(() => {
        textarea?.focus();
        textarea?.setSelectionRange(cellPos, cellPos);
        if (textarea) autoResize(textarea);
      });

      return next;
    });
  }

  // Ctrl/Cmd+B, +I, +U wrap the selection (or, with nothing selected, drop
  // the cursor between an empty pair) in the matching shortcut marker —
  // ** for bold, * for italic, __ for underline — the same ones
  // RichContent renders back into real formatting.
  function applyInlineMark(index: number, marker: string) {
    const textarea = textareaRefs.current[index];
    const block = blocks[index];
    if (!textarea || !block || block.type !== "text") return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = block.value.slice(start, end);
    const before = block.value.slice(0, start);
    const after = block.value.slice(end);

    updateTextBlock(index, `${before}${marker}${selected}${marker}${after}`);

    // No textarea.focus() here — it's already focused (that's how Ctrl/Cmd+B
    // fired), and re-focusing an already-focused element can still trigger
    // the browser's scroll-into-view, undoing the fix in autoResize above.
    requestAnimationFrame(() => {
      const newStart = start + marker.length;
      textarea.setSelectionRange(newStart, newStart + selected.length);
      autoResize(textarea);
    });
  }

  function handleFormatShortcut(e: React.KeyboardEvent<HTMLTextAreaElement>, index: number) {
    if (!(e.ctrlKey || e.metaKey)) return;
    const marker = { b: "**", i: "*", u: "__" }[e.key.toLowerCase()];
    if (!marker) return;
    e.preventDefault();
    applyInlineMark(index, marker);
  }

  // Pressing Enter on a "1. ", "- ", "a. " or "| ... |" line continues the
  // list/table on the next line with the number/letter/row already primed,
  // instead of making you type it yourself — the plain-text equivalent of
  // watching the list count itself up (or the table grow a row) as you
  // write. Enter on an EMPTY item ends the list/table instead (strips that
  // line's marker) rather than adding yet another empty one, matching how
  // e.g. Obsidian or Bear behave.
  //
  // No textarea.focus() in here, on purpose: the textarea calling this is
  // already focused (that's how Enter reached it), and re-focusing an
  // already-focused element can still trigger the browser's
  // scroll-into-view, undoing the fix in autoResize below.
  function handleListContinuation(
    e: React.KeyboardEvent<HTMLTextAreaElement>,
    index: number,
  ) {
    if (e.key !== "Enter" || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) {
      return;
    }
    const textarea = textareaRefs.current[index];
    const block = blocks[index];
    if (!textarea || !block || block.type !== "text") return;

    const cursor = textarea.selectionStart;
    const value = block.value;
    const lineStart = value.lastIndexOf("\n", cursor - 1) + 1;
    const currentLine = value.slice(lineStart, cursor);

    let nextMarker: string | null = null;
    let itemIsEmpty = false;

    const numbered = /^(\d+)\.\s(.*)$/.exec(currentLine);
    const lettered = /^([a-zA-Z])\.\s(.*)$/.exec(currentLine);
    const bullet = /^-\s(.*)$/.exec(currentLine);
    const table = /^\|(.+)\|$/.exec(currentLine);

    if (numbered) {
      itemIsEmpty = numbered[2].trim() === "";
      nextMarker = `${Number(numbered[1]) + 1}. `;
    } else if (bullet) {
      itemIsEmpty = bullet[1].trim() === "";
      nextMarker = "- ";
    } else if (lettered) {
      itemIsEmpty = lettered[2].trim() === "";
      nextMarker = `${String.fromCharCode(lettered[1].charCodeAt(0) + 1)}. `;
    } else if (table) {
      itemIsEmpty = table[1].replace(/\|/g, "").trim() === "";
      nextMarker = "| ";
    }

    if (nextMarker === null) return; // Not on a list/table line — let Enter behave normally.
    e.preventDefault();

    if (itemIsEmpty) {
      const newValue = value.slice(0, lineStart) + value.slice(cursor);
      updateTextBlock(index, newValue);
      requestAnimationFrame(() => {
        textarea.setSelectionRange(lineStart, lineStart);
        autoResize(textarea);
      });
      return;
    }

    const insertion = `\n${nextMarker}`;
    const newValue = value.slice(0, cursor) + insertion + value.slice(cursor);
    updateTextBlock(index, newValue);
    requestAnimationFrame(() => {
      const pos = cursor + insertion.length;
      textarea.setSelectionRange(pos, pos);
      autoResize(textarea);
    });
  }

  function removeImageBlock(index: number) {
    setBlocks((prev) => {
      const next = [...prev];
      next.splice(index, 1);
      // An image is always sandwiched between two text blocks (that's the
      // only way one gets inserted) — merge them back into one now that
      // nothing separates them.
      const before = next[index - 1];
      const after = next[index];
      if (before?.type === "text" && after?.type === "text") {
        next.splice(index - 1, 2, {
          type: "text",
          value: before.value + after.value,
        });
      }
      return next;
    });
  }

  return (
    <form action={formAction} className="flex flex-1 flex-col gap-4">
      <input type="hidden" name="content" value={content} />
      <div className="flex flex-1 flex-col gap-3">
        {blocks.map((block, i) =>
          block.type === "text" ? (
            <textarea
              key={i}
              ref={(el) => {
                textareaRefs.current[i] = el;
              }}
              value={block.value}
              onChange={(e) => {
                updateTextBlock(i, e.target.value);
                autoResize(e.target);
              }}
              onFocus={() => setActiveIndex(i)}
              onKeyDown={(e) => {
                handleFormatShortcut(e, i);
                handleListContinuation(e, i);
              }}
              autoFocus={i === 0}
              placeholder={
                blocks.length === 1 && !isEditing ? "Start writing…" : undefined
              }
              disabled={isPending}
              rows={1}
              className="resize-none overflow-hidden border-none bg-transparent p-0 text-lg leading-relaxed outline-none disabled:opacity-50"
              style={i === 0 && blocks.length === 1 ? { minHeight: "55vh" } : undefined}
            />
          ) : (
            <div key={i} className="group relative w-fit max-w-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={block.url}
                alt="Brain dump attachment"
                className="max-w-full rounded-md border border-border-subtle"
              />
              <button
                type="button"
                onClick={() => removeImageBlock(i)}
                className="absolute top-2 right-2 rounded-full bg-black/60 px-2 py-1 text-xs text-white opacity-0 group-hover:opacity-100"
              >
                ×
              </button>
            </div>
          ),
        )}
      </div>
      <div className="flex items-center gap-3 border-t border-border-subtle pt-4">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          disabled={isPending || isUploading}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isPending || isUploading}
          className="rounded-md border border-border-subtle px-3 py-1.5 text-xs text-ink-muted disabled:opacity-50"
        >
          {isUploading ? "Uploading…" : "🖼 Insert image"}
        </button>
        <div className="relative">
          <button
            type="button"
            onClick={() => setTablePickerOpen((open) => !open)}
            disabled={isPending}
            className="rounded-md border border-border-subtle px-3 py-1.5 text-xs text-ink-muted disabled:opacity-50"
          >
            ⊞ Insert table
          </button>
          {tablePickerOpen && (
            <div className="absolute bottom-full left-0 z-10 mb-2 flex items-center gap-2 rounded-md border border-border-subtle bg-white p-3 text-xs text-ink-muted shadow-sm">
              <label className="flex items-center gap-1">
                Rows
                <input
                  ref={tableRowsRef}
                  type="number"
                  min={1}
                  max={20}
                  defaultValue={3}
                  className="w-12 rounded border border-border-subtle px-1 py-0.5 text-ink"
                />
              </label>
              <label className="flex items-center gap-1">
                Cols
                <input
                  ref={tableColsRef}
                  type="number"
                  min={1}
                  max={10}
                  defaultValue={3}
                  className="w-12 rounded border border-border-subtle px-1 py-0.5 text-ink"
                />
              </label>
              <button
                type="button"
                onClick={() => {
                  const rows = Math.max(1, Math.min(20, Number(tableRowsRef.current?.value) || 3));
                  const cols = Math.max(1, Math.min(10, Number(tableColsRef.current?.value) || 3));
                  insertTableAtActiveBlock(rows, cols);
                  setTablePickerOpen(false);
                }}
                className="rounded-md bg-ink px-2 py-1 font-medium text-white hover:opacity-90"
              >
                Insert
              </button>
            </div>
          )}
        </div>
        <details className="relative">
          <summary
            title="Formatting shortcuts"
            className="flex h-5 w-5 cursor-pointer list-none items-center justify-center rounded-full border border-border-subtle text-xs text-ink-faint hover:text-ink [&::-webkit-details-marker]:hidden"
          >
            ?
          </summary>
          <div className="absolute bottom-full left-0 z-10 mb-2 w-60 rounded-md border border-border-subtle bg-white p-3 text-xs text-ink-muted shadow-sm">
            <ul className="flex flex-col gap-1">
              <li><code>#</code> heading</li>
              <li><code>!</code> callout</li>
              <li><code>-</code> bullet list</li>
              <li><code>1.</code> numbered list</li>
              <li><code>a.</code> lettered list</li>
              <li><code>| a | b |</code> table row</li>
              <li><code>**bold**</code> · <code>*italic*</code> · <code>__underline__</code></li>
              <li>Ctrl/Cmd + B / I / U on a selection</li>
            </ul>
          </div>
        </details>
        <div className="flex-1" />
        <button
          type="submit"
          disabled={isPending || isUploading}
          className="rounded-md bg-ink px-4 py-2 text-sm font-medium whitespace-nowrap text-white hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? "Saving…" : isEditing ? "Save changes" : "Save"}
        </button>
      </div>
      {(state.error || uploadError) && (
        <span className="text-xs text-red-500">{state.error ?? uploadError}</span>
      )}
    </form>
  );
}
