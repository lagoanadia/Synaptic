"use client";

import { useState } from "react";

// Sits inside a <summary> (the code block's header) — stopPropagation
// keeps a click here from also toggling the parent <details> open/closed,
// since a native <summary> treats any click inside it as a toggle unless
// told otherwise.
export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      className="shrink-0 rounded px-1.5 py-0.5 text-xs text-white/60 transition-colors hover:bg-white/10 hover:text-white"
    >
      {copied ? "Copied ✓" : "Copy"}
    </button>
  );
}
