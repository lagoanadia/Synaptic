"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { addBrainDump, uploadImage, type FormState } from "../../actions";

const initialState: FormState = { error: null };

// The blank-page composer: no boxed textarea, no small text field — just an
// open writing surface, closer to opening a new page than filling a form.
export function NewDumpForm({ pursuitId }: { pursuitId: string }) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(
    addBrainDump.bind(null, pursuitId),
    initialState,
  );

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [content, setContent] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // redirect() inside the server action + useActionState crashed the page
  // (minified React error #441), so navigation happens here instead, once
  // the action reports success.
  useEffect(() => {
    if (state.success) {
      router.push(`/pursuits/${pursuitId}?tab=dump`);
    }
  }, [state.success, router, pursuitId]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow picking the same file again later
    if (!file) return;

    setUploadError(null);
    setIsUploading(true);
    try {
      const fd = new FormData();
      fd.set("image", file);
      const result = await uploadImage(pursuitId, fd);
      if ("error" in result) {
        setUploadError(result.error);
        return;
      }
      insertAtCursor(`![image](${result.url})`);
    } finally {
      setIsUploading(false);
    }
  }

  function insertAtCursor(token: string) {
    const textarea = textareaRef.current;
    if (!textarea) {
      setContent((prev) => `${prev}${token}`);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    setContent((prev) => {
      const before = prev.slice(0, start);
      const after = prev.slice(end);
      const next = `${before}${token}${after}`;
      // Put the cursor right after the inserted token, then refocus —
      // state updates are async, so this has to wait a tick.
      requestAnimationFrame(() => {
        textarea.focus();
        const pos = start + token.length;
        textarea.setSelectionRange(pos, pos);
      });
      return next;
    });
  }

  return (
    <form action={formAction} className="flex flex-1 flex-col gap-4">
      <textarea
        ref={textareaRef}
        name="content"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        autoFocus
        placeholder="Start writing…"
        disabled={isPending}
        className="min-h-[55vh] flex-1 resize-none border-none bg-transparent p-0 text-lg leading-relaxed whitespace-pre-wrap outline-none disabled:opacity-50"
      />
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
