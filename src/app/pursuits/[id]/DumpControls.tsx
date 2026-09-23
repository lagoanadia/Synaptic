"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { deleteBrainDump, finalizeBrainDump, organizeDumps } from "./actions";
import { DeleteButton } from "../DeleteButton";
import { autoTitle } from "@/lib/text";

type DumpForDisplay = {
  id: string;
  content: string | null;
  images: string[];
  processed: boolean;
  createdAt: string;
};

// Client Component: needs local state for which unprocessed dumps are
// checked to send to Organize — not every dump needs the AI's help, so
// Organize no longer just grabs everything unprocessed by default.
export function DumpControls({
  pursuitId,
  dumps,
}: {
  pursuitId: string;
  dumps: DumpForDisplay[];
}) {
  const unprocessed = dumps.filter((d) => !d.processed);
  const [selected, setSelected] = useState<string[]>(() => unprocessed.map((d) => d.id));
  const [isPending, startTransition] = useTransition();

  // A dump that got organized (or deleted) since this state was last set
  // shouldn't still count toward the selection — its checkbox is gone too.
  const effectiveSelected = selected.filter((id) =>
    unprocessed.some((d) => d.id === id),
  );

  function toggle(id: string) {
    setSelected((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Link
        href={`/pursuits/${pursuitId}/dump/new`}
        className="self-start rounded-md border border-dashed border-border-subtle px-4 py-2 text-sm text-ink-muted hover:border-solid hover:border-ink hover:text-ink"
      >
        + New page
      </Link>

      {effectiveSelected.length > 0 && (
        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            startTransition(() => organizeDumps(pursuitId, effectiveSelected))
          }
          className="self-start rounded-md border border-accent px-3 py-1.5 text-xs font-semibold text-accent hover:bg-accent-soft disabled:opacity-50"
        >
          ✦ Organize {effectiveSelected.length} selected →
        </button>
      )}

      <div className="flex flex-col">
        {dumps.map((d) => (
          <div
            key={d.id}
            className="-mx-2 flex items-center gap-3 rounded-md px-2 py-2.5 hover:bg-chip"
          >
            {!d.processed && (
              <input
                type="checkbox"
                checked={selected.includes(d.id)}
                onChange={() => toggle(d.id)}
                className="flex-shrink-0"
              />
            )}
            <Link
              href={`/pursuits/${pursuitId}/dump/${d.id}`}
              className="flex flex-1 items-center gap-3 overflow-hidden"
            >
              <span
                className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${
                  d.processed ? "bg-ink-faint" : "bg-accent"
                }`}
              />
              {d.images.length > 0 && <span>🖼</span>}
              <span className="flex-1 truncate text-sm">{autoTitle(d.content)}</span>
              <span className="text-xs whitespace-nowrap text-ink-faint">
                {new Date(d.createdAt).toLocaleDateString("en-US", { timeZone: "UTC" })}
              </span>
              {d.processed && (
                <span className="text-xs whitespace-nowrap text-ink-faint">
                  → in note
                </span>
              )}
            </Link>
            {!d.processed && (
              <button
                type="button"
                disabled={isPending}
                onClick={() =>
                  startTransition(() => finalizeBrainDump(pursuitId, d.id))
                }
                className="text-xs whitespace-nowrap text-ink-faint hover:text-ink disabled:opacity-50"
                title="Already written the way you want it — skip the AI and use it as a note directly"
              >
                Finalize
              </button>
            )}
            <DeleteButton
              action={deleteBrainDump.bind(null, pursuitId, d.id)}
              confirmMessage="Delete this page? This can't be undone."
              className="px-1 text-ink-faint hover:text-red-500"
            >
              ×
            </DeleteButton>
          </div>
        ))}
        {dumps.length === 0 && (
          <p className="text-sm text-ink-muted">Nothing dumped yet — start above.</p>
        )}
      </div>
    </div>
  );
}
