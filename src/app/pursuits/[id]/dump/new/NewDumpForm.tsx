"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import type { Editor } from "@tiptap/react";
import { addBrainDump, transcribeAudio, updateBrainDump, type FormState } from "../../actions";
import { pdfToImagePages } from "@/lib/pdfToImages";
import { textToDoc } from "@/lib/richText";
import { readPptx, slidesToText } from "@/lib/pptx";
import { RichEditor } from "../../../../editor/RichEditor";

const initialState: FormState = { error: null };

// Files go straight from the browser to Blob storage: a Server Action's
// request body is capped at 1MB, which a phone photo blows past.
async function uploadToBlob(pursuitId: string, file: File | Blob, name: string, kind: "image" | "audio") {
  const blob = await upload(`dumps/${pursuitId}/${name}`, file, {
    access: "public",
    handleUploadUrl: "/api/blob-upload",
    clientPayload: JSON.stringify({ pursuitId, kind }),
  });
  return blob.url;
}

// Writing or editing a Brain Dump page, in the visual editor. Extras on
// top of the editor itself: PDF pages as images, voice notes transcribed
// into the page, and a local draft so a closed tab doesn't lose work.
export function NewDumpForm({
  pursuitId,
  dumpId,
  initialContent = "",
  initialUpdatedAt,
}: {
  pursuitId: string;
  dumpId?: string;
  initialContent?: string;
  // Editing only: the version this editor loaded, so a save that would
  // overwrite someone else's newer save is refused instead.
  initialUpdatedAt?: string;
}) {
  const router = useRouter();
  const isEditing = dumpId !== undefined;
  const [state, formAction, isPending] = useActionState(
    isEditing ? updateBrainDump.bind(null, pursuitId, dumpId) : addBrainDump.bind(null, pursuitId),
    initialState,
  );
  const [content, setContent] = useState(initialContent);
  const editorRef = useRef<Editor | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const pdfInput = useRef<HTMLInputElement>(null);
  const pptxInput = useRef<HTMLInputElement>(null);

  async function insertSlides(file: File) {
    setError(null);
    try {
      const text = slidesToText(readPptx(new Uint8Array(await file.arrayBuffer())));
      editorRef.current?.chain().focus().insertContent(textToDoc(text).content ?? []).run();
    } catch {
      setError("Couldn't read that file — it needs to be a .pptx");
    }
  }

  // ─── Draft safety net ───
  const draftKey = `synaptic-draft-${pursuitId}-${dumpId ?? "new"}`;
  const [draftToOffer, setDraftToOffer] = useState<string | null>(null);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(draftKey);
      // localStorage only exists in the browser, so this can't run during render.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved && saved.trim() && saved !== initialContent) setDraftToOffer(saved);
    } catch {}
    // Once, on open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    try {
      if (content.trim()) localStorage.setItem(draftKey, content);
      else localStorage.removeItem(draftKey);
    } catch {}
  }, [content, draftKey]);

  // Navigate after a successful save (a redirect inside the action
  // crashes useActionState).
  useEffect(() => {
    if (!state.success) return;
    try {
      localStorage.removeItem(draftKey);
    } catch {}
    router.push(isEditing ? `/pursuits/${pursuitId}/dump/${dumpId}` : `/pursuits/${pursuitId}?tab=pages`);
  }, [state.success, router, pursuitId, isEditing, dumpId, draftKey]);

  function restoreDraft(text: string) {
    editorRef.current?.commands.setContent(textToDoc(text));
    setContent(text);
    setDraftToOffer(null);
  }

  // ─── PDF → page images ───
  async function insertPdf(file: File) {
    setError(null);
    setBusy("Reading PDF…");
    try {
      const pages = await pdfToImagePages(file);
      for (let i = 0; i < pages.length; i++) {
        setBusy(`Uploading page ${i + 1} of ${pages.length}…`);
        const url = await uploadToBlob(pursuitId, pages[i], `${file.name}-page-${i + 1}.jpg`, "image");
        editorRef.current?.chain().focus().setImage({ src: url }).run();
      }
    } catch {
      setError("Couldn't process that PDF — try again");
    } finally {
      setBusy(null);
    }
  }

  // ─── Voice note → text ───
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const [recordingSince, setRecordingSince] = useState<number | null>(null);
  useEffect(() => () => recorder.current?.stream.getTracks().forEach((t) => t.stop()), []);

  async function startRecording() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = ["audio/webm", "audio/mp4", "audio/ogg"].find((t) => MediaRecorder.isTypeSupported(t));
      const r = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunks.current = [];
      r.ondataavailable = (e) => e.data.size > 0 && chunks.current.push(e.data);
      r.onstop = () => stream.getTracks().forEach((t) => t.stop());
      recorder.current = r;
      r.start();
      setRecordingSince(Date.now());
    } catch {
      setError("Couldn't access the microphone — check this site's permission");
    }
  }

  async function stopRecording() {
    const r = recorder.current;
    if (!r) return;
    setRecordingSince(null);
    const stopped = new Promise((resolve) => r.addEventListener("stop", resolve, { once: true }));
    r.stop();
    await stopped;
    recorder.current = null;
    // Browsers label the same audio differently (Safari adds codecs,
    // some call WebM audio "video/webm"); normalize to what blob-upload allows.
    const raw = r.mimeType.split(";")[0];
    const [type, ext] = raw.includes("mp4") ? ["audio/mp4", "mp4"] : raw.includes("ogg") ? ["audio/ogg", "ogg"] : ["audio/webm", "webm"];
    const audio = new Blob(chunks.current, { type });
    if (audio.size === 0) return;
    setBusy("Transcribing…");
    try {
      const url = await uploadToBlob(pursuitId, audio, `voice-note.${ext}`, "audio");
      const result = await transcribeAudio(pursuitId, url);
      if (result.error) setError(result.error);
      else editorRef.current?.chain().focus().insertContent(` ${result.text ?? ""}`).run();
    } catch (err) {
      setError(`Couldn't process that recording — ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(null);
    }
  }

  const extras = (
    <>
      <button
        type="button"
        onClick={() => pptxInput.current?.click()}
        disabled={!!busy}
        title="Add a PowerPoint's slides as text"
        className="rounded-md px-2 py-1 text-sm text-ink-muted hover:bg-chip hover:text-ink disabled:opacity-50"
      >
        PPT
      </button>
      <button
        type="button"
        onClick={() => pdfInput.current?.click()}
        disabled={!!busy}
        title="Add a PDF's pages as images"
        className="rounded-md px-2 py-1 text-sm text-ink-muted hover:bg-chip hover:text-ink disabled:opacity-50"
      >
        PDF
      </button>
      <button
        type="button"
        onClick={recordingSince ? stopRecording : startRecording}
        disabled={!!busy && !recordingSince}
        title={recordingSince ? "Stop and transcribe" : "Record a voice note"}
        className={`rounded-md px-2 py-1 text-sm ${recordingSince ? "bg-crimson text-white" : "text-ink-muted hover:bg-chip hover:text-ink"}`}
      >
        {recordingSince ? "■ Stop" : "🎙"}
      </button>
    </>
  );

  return (
    <form action={formAction} className="flex flex-1 flex-col gap-4">
      <input type="hidden" name="content" value={content} />
      {initialUpdatedAt && <input type="hidden" name="expectedUpdatedAt" value={initialUpdatedAt} />}
      <input
        ref={pdfInput}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) insertPdf(file);
        }}
      />

      <input
        ref={pptxInput}
        type="file"
        accept=".pptx"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) insertSlides(file);
        }}
      />

      {draftToOffer && (
        <div className="flex items-center justify-between rounded-xl border border-accent bg-accent-soft px-3 py-2 text-xs">
          <span>You have an unsaved draft from earlier.</span>
          <div className="flex gap-3">
            <button type="button" onClick={() => restoreDraft(draftToOffer)} className="font-semibold text-accent">
              Restore
            </button>
            <button
              type="button"
              onClick={() => {
                try {
                  localStorage.removeItem(draftKey);
                } catch {}
                setDraftToOffer(null);
              }}
              className="text-ink-faint hover:text-ink"
            >
              Discard
            </button>
          </div>
        </div>
      )}

      <RichEditor
        initialText={initialContent}
        onChange={setContent}
        onUploadImage={(file) => uploadToBlob(pursuitId, file, file.name, "image")}
        editorRef={editorRef}
        toolbarExtras={extras}
        autofocus={!isEditing}
      />

      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-ink-muted">{busy ?? (recordingSince ? "Recording…" : "")}</span>
        <button
          type="submit"
          disabled={isPending || !!busy || !!recordingSince}
          className="rounded-full bg-ink px-6 py-2.5 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5 disabled:opacity-50"
        >
          {isPending ? "Saving…" : isEditing ? "Save changes" : "Save"}
        </button>
      </div>
      {(state.error || error) && <p className="text-xs text-red-500">{state.error ?? error}</p>}
    </form>
  );
}
