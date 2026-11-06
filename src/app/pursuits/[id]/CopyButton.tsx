"use client";

import { CheckIcon } from "@/app/icons";
import { useState } from "react";

// Inside a <summary>: stop the click from toggling the <details>.
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
      {copied ? <>Copied <CheckIcon size={12} /></> : "Copy"}
    </button>
  );
}
