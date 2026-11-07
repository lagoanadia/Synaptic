"use client";

import { useActionState } from "react";
import { addPursuitTag, type FormState } from "./actions";

const initialState: FormState = { error: null };

export function TagForm({ pursuitId }: { pursuitId: string }) {
  const [state, formAction, isPending] = useActionState(
    addPursuitTag.bind(null, pursuitId),
    initialState,
  );

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input
        type="text"
        name="name"
        placeholder="+ etiqueta"
        disabled={isPending}
        className="w-28 rounded-md border border-dashed border-border-subtle bg-transparent px-2.5 py-1 text-sm focus:w-40 focus:outline-none disabled:opacity-50"
      />
      {state.error && <span className="text-xs text-red-500">{state.error}</span>}
    </form>
  );
}
