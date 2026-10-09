"use client";

import { useRef, useState, useTransition } from "react";
import { createApiKey, revokeApiKey } from "./actions";
import { DeleteButton } from "@/app/pursuits/DeleteButton";

type KeyForDisplay = {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
};

// The raw key only ever exists here, in memory, between the moment
// createApiKey returns it and the moment this component unmounts or the
// user dismisses the banner — it's never stored, logged, or shown again
// after that, same as GitHub/Stripe's own "copy this now" key reveal.
export function ApiKeyManager({ keys }: { keys: KeyForDisplay[] }) {
  const [isPending, startTransition] = useTransition();
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col gap-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const name = nameRef.current?.value.trim();
          if (!name) return;
          setError(null);
          startTransition(async () => {
            try {
              const { rawKey } = await createApiKey(name);
              setRevealedKey(rawKey);
              setCopied(false);
              if (nameRef.current) nameRef.current.value = "";
            } catch (err) {
              setError(err instanceof Error ? err.message : "Couldn't create that key");
            }
          });
        }}
        className="flex gap-2"
      >
        <input
          ref={nameRef}
          type="text"
          placeholder="Key name (e.g. 'Claude Desktop')"
          disabled={isPending}
          className="flex-1 rounded-md border border-border-subtle bg-white px-3 py-2 text-sm disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md border border-ink px-4 py-2 text-sm font-medium whitespace-nowrap hover:bg-chip disabled:opacity-50"
        >
          + New key
        </button>
      </form>
      {error && <p className="text-xs text-red-500">{error}</p>}

      {revealedKey && (
        <div className="flex flex-col gap-2 rounded-xl border border-accent bg-accent-soft p-4">
          <p className="text-sm font-semibold text-ink">
            Copy this key now — you won&apos;t be able to see it again.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 overflow-x-auto rounded-md bg-white px-3 py-2 text-xs whitespace-nowrap">
              {revealedKey}
            </code>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(revealedKey).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                });
              }}
              className="shrink-0 rounded-md border border-ink px-3 py-2 text-xs font-medium hover:bg-white"
            >
              {copied ? "Copied ✓" : "Copy"}
            </button>
          </div>
          <button
            type="button"
            onClick={() => setRevealedKey(null)}
            className="self-start text-xs text-ink-faint hover:text-ink"
          >
            Done, I&apos;ve saved it
          </button>
        </div>
      )}

      <div className="flex flex-col">
        {keys.map((k) => (
          <div
            key={k.id}
            className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-chip"
          >
            <span className="flex-1 text-sm font-medium">{k.name}</span>
            <code className="text-xs text-ink-faint">{k.prefix}…</code>
            <span className="text-xs whitespace-nowrap text-ink-faint">
              {k.lastUsedAt
                ? `Last used ${new Date(k.lastUsedAt).toLocaleDateString()}`
                : "Never used"}
            </span>
            <DeleteButton
              action={revokeApiKey.bind(null, k.id)}
              confirmMessage={`Revoke "${k.name}"? Anything using this key stops working immediately.`}
              className="text-xs text-ink-faint hover:text-red-500"
            >
              Revoke
            </DeleteButton>
          </div>
        ))}
        {keys.length === 0 && (
          <p className="text-sm text-ink-muted">No API keys yet — create one above.</p>
        )}
      </div>
    </div>
  );
}
