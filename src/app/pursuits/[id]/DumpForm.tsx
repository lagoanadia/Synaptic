"use client";

import { useActionState } from "react";
import { addBrainDump, type FormState } from "./actions";

const initialState: FormState = { error: null };

export function DumpForm({ pursuitId }: { pursuitId: string }) {
  const [state, formAction, isPending] = useActionState(
    addBrainDump.bind(null, pursuitId),
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <textarea
        name="content"
        rows={3}
        placeholder="Dump anything — a paragraph, a page, whatever's in your head…"
        disabled={isPending}
        className="rounded-md border border-zinc-300 bg-white p-3 text-sm disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900"
      />
      <div className="flex items-center gap-2">
        <input
          type="file"
          name="image"
          accept="image/*"
          disabled={isPending}
          className="flex-1 text-xs text-zinc-500 file:mr-3 file:rounded-md file:border file:border-zinc-300 file:bg-transparent file:px-3 file:py-1.5 file:text-xs disabled:opacity-50 dark:text-zinc-400 dark:file:border-zinc-700"
        />
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md border border-zinc-900 px-4 py-2 text-sm font-medium whitespace-nowrap disabled:opacity-50 dark:border-zinc-50"
        >
          {isPending ? "Adding…" : "Add to dump"}
        </button>
      </div>
      {state.error && (
        <span className="text-xs text-red-500">{state.error}</span>
      )}
    </form>
  );
}
