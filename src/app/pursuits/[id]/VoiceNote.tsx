"use client";

import { useT } from "@/app/LangProvider";
import { MicIcon, StopIcon } from "@/app/icons";
import { useRef, useState } from "react";
import type { Editor } from "@tiptap/core";
import { uploadToBlob } from "@/lib/blobUpload";
import { transcribeAudio } from "./actions";

// The toolbar's 🎤: records a voice note and writes it into the page,
// where the cursor is.
export function VoiceNote({ pursuitId, editorRef }: { pursuitId: string; editorRef: React.RefObject<Editor | null> }) {
  const t = useT();
  const [since, setSince] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);

  async function start() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = ["audio/webm", "audio/mp4", "audio/ogg"].find((x) => MediaRecorder.isTypeSupported(x));
      const r = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunks.current = [];
      r.ondataavailable = (e) => e.data.size > 0 && chunks.current.push(e.data);
      r.onstop = () => stream.getTracks().forEach((x) => x.stop());
      recorder.current = r;
      r.start();
      setSince(Date.now());
    } catch {
      setError(t("No hay acceso al micrófono — revisa el permiso de esta web"));
    }
  }

  async function stop() {
    const r = recorder.current;
    if (!r) return;
    setSince(null);
    const stopped = new Promise((resolve) => r.addEventListener("stop", resolve, { once: true }));
    r.stop();
    await stopped;
    recorder.current = null;
    // Browsers label the same audio differently; normalize to what upload allows.
    const raw = r.mimeType.split(";")[0];
    const [type, ext] = raw.includes("mp4") ? ["audio/mp4", "mp4"] : raw.includes("ogg") ? ["audio/ogg", "ogg"] : ["audio/webm", "webm"];
    const audio = new Blob(chunks.current, { type });
    if (audio.size === 0) return;
    setBusy(true);
    try {
      const url = await uploadToBlob(pursuitId, audio, `voice-note.${ext}`, "audio");
      const result = await transcribeAudio(pursuitId, url);
      if (result.error) setError(result.error);
      else editorRef.current?.chain().focus().insertContent(` ${result.text ?? ""}`).run();
    } catch (err) {
      setError(t("No he podido procesar la grabación — {0}", { 0: err instanceof Error ? err.message : String(err) }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={since ? stop : start}
        disabled={busy}
        title={since ? t("Parar y transcribir") : t("Grabar una nota de voz")}
        className={`rounded-md px-2 py-1 text-sm ${since ? "bg-crimson text-white" : "text-ink-muted hover:bg-chip hover:text-ink"} disabled:opacity-50`}
      >
        {since ? (
          <>
            <StopIcon size={14} /> {t("Parar")}
          </>
        ) : (
          <MicIcon />
        )}
      </button>
      {(busy || error) && <span className="text-xs text-ink-muted">{busy ? t("Transcribiendo…") : error}</span>}
    </span>
  );
}
