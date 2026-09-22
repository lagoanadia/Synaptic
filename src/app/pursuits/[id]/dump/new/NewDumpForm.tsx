"use client";

import { useActionState } from "react";
import { addBrainDump, type FormState } from "../../actions";

const initialState: FormState = { error: null };

// The blank-page composer: no boxed textarea, no small text field — just an
// open writing surface, closer to opening a new page than filling a form.
export function NewDumpForm({ pursuitId }: { pursuitId: string }) {
  const [state, formAction, isPending] = useActionState(
    addBrainDump.bind(null, pursuitId),
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-1 flex-col gap-4">
      <textarea
        name="content"
        autoFocus
        placeholder="Start writing…"
        disabled={isPending}
        className="min-h-[55vh] flex-1 resize-none border-none bg-transparent p-0 text-lg leading-relaxed outline-none disabled:opacity-50"
      />
      <div className="flex items-center gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
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
          {isPending ? "Saving…" : "Save"}
        </button>
      </div>
      {state.error && (
        <span className="text-xs text-red-500">{state.error}</span>
      )}
    </form>
  );
}
