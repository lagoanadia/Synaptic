"use client";

import { useState } from "react";
import { removeAttachment } from "./actions";
import { DeleteButton } from "../DeleteButton";

type Attachment = { id: string; name: string; url: string };

// Turns a Drive "view"/"edit" link into Drive's own embeddable viewer —
// the same /preview endpoint Drive uses for its own share-embed widget.
// Handles a raw file link (/file/d/{id}/...), the older ?id={id} share
// format, and native Docs/Sheets/Slides editor links. Returns null for
// anything that isn't a recognized Google Drive/Docs URL, since a random
// pasted link has no such embeddable form and most sites block framing
// via X-Frame-Options anyway — those stay a plain external link.
function toEmbedUrl(url: string): string | null {
  const fileId =
    url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)?.[1] ??
    url.match(/[?&]id=([a-zA-Z0-9_-]+)/)?.[1];
  if (fileId) return `https://drive.google.com/file/d/${fileId}/preview`;

  const docsBase = url.match(
    /^(https:\/\/docs\.google\.com\/(?:document|spreadsheets|presentation)\/d\/[a-zA-Z0-9_-]+)/,
  )?.[1];
  if (docsBase) return `${docsBase}/preview`;

  return null;
}

export function AttachmentList({
  pursuitId,
  attachments,
}: {
  pursuitId: string;
  attachments: Attachment[];
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  if (attachments.length === 0) {
    return (
      <p className="text-sm text-ink-muted">No files yet — add a link above.</p>
    );
  }

  return (
    <div className="flex flex-col">
      {attachments.map((a) => {
        const embedUrl = toEmbedUrl(a.url);

        return (
          <div key={a.id} className="border-b border-dashed border-border-subtle last:border-0">
            <div className="flex items-center gap-3 py-3">
              {embedUrl ? (
                <button
                  type="button"
                  onClick={() => setOpenId(openId === a.id ? null : a.id)}
                  className="flex-1 truncate text-left text-sm hover:underline"
                >
                  {a.name}
                </button>
              ) : (
                <a
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 truncate text-sm hover:underline"
                >
                  {a.name}
                </a>
              )}
              {embedUrl && (
                <span className="shrink-0 text-xs text-ink-faint">
                  {openId === a.id ? "Hide" : "Preview"}
                </span>
              )}
              <DeleteButton
                action={removeAttachment.bind(null, pursuitId, a.id)}
                confirmMessage={`Remove "${a.name}"?`}
                className="shrink-0 text-ink-faint hover:text-red-500"
              >
                ×
              </DeleteButton>
            </div>
            {embedUrl && openId === a.id && (
              <div className="flex flex-col gap-1 pb-3">
                <iframe
                  src={embedUrl}
                  className="h-[70vh] w-full rounded-md border border-border-subtle bg-white"
                />
                <a
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="self-end text-xs text-ink-faint hover:underline"
                >
                  Open in new tab ↗
                </a>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
