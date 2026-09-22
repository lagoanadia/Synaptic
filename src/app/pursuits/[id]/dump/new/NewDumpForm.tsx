"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import { addBrainDump, type FormState } from "../../actions";

const initialState: FormState = { error: null };

type Block = { type: "text"; value: string } | { type: "image"; url: string };

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

function autoResize(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

export function NewDumpForm({ pursuitId }: { pursuitId: string }) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(
    addBrainDump.bind(null, pursuitId),
    initialState,
  );

  const [blocks, setBlocks] = useState<Block[]>([{ type: "text", value: "" }]);
  const [activeIndex, setActiveIndex] = useState(0);
  const textareaRefs = useRef<Record<number, HTMLTextAreaElement | null>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const content = useMemo(() => serialize(blocks), [blocks]);

  // redirect() inside the server action + useActionState crashed the page
  // (minified React error #441), so navigation happens here instead, once
  // the action reports success.
  useEffect(() => {
    if (state.success) {
      router.push(`/pursuits/${pursuitId}?tab=dump`);
    }
  }, [state.success, router, pursuitId]);

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
              autoFocus={i === 0}
              placeholder={blocks.length === 1 ? "Start writing…" : undefined}
              disabled={isPending}
              rows={1}
              className={`resize-none overflow-hidden border-none bg-transparent p-0 text-lg leading-relaxed outline-none disabled:opacity-50 ${
                i === blocks.length - 1 ? "flex-1" : ""
              }`}
              style={i === 0 && blocks.length === 1 ? { minHeight: "55vh" } : undefined}
            />
          ) : (
            <div key={i} className="group relative w-fit max-w-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={block.url}
                alt="Brain dump attachment"
                className="max-w-full rounded-md border border-zinc-200 dark:border-zinc-800"
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
      <div className="flex items-center gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
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
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs text-zinc-500 disabled:opacity-50 dark:border-zinc-700"
        >
          {isUploading ? "Uploading…" : "🖼 Insert image"}
        </button>
        <div className="flex-1" />
        <button
          type="submit"
          disabled={isPending || isUploading}
          className="rounded-md border border-zinc-900 px-4 py-2 text-sm font-medium whitespace-nowrap disabled:opacity-50 dark:border-zinc-50"
        >
          {isPending ? "Saving…" : "Save"}
        </button>
      </div>
      {(state.error || uploadError) && (
        <span className="text-xs text-red-500">{state.error ?? uploadError}</span>
      )}
    </form>
  );
}
