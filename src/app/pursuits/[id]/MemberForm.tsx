"use client";

import { useActionState } from "react";
import { addMember, type FormState } from "./actions";

const initialState: FormState = { error: null };

export function MemberForm({ pursuitId }: { pursuitId: string }) {
  const [state, formAction, isPending] = useActionState(
    addMember.bind(null, pursuitId),
    initialState,
  );

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input
        type="email"
        name="email"
        placeholder="+ invite by email"
        disabled={isPending}
        className="w-36 rounded border border-dashed border-border-subtle bg-transparent px-2 py-0.5 text-xs focus:w-48 focus:outline-none disabled:opacity-50"
      />
      <select
        name="role"
        defaultValue="EDITOR"
        disabled={isPending}
        className="rounded border border-dashed border-border-subtle bg-transparent px-1 py-0.5 text-xs disabled:opacity-50"
      >
        <option value="EDITOR">editor</option>
        <option value="VIEWER">viewer</option>
      </select>
      {state.error && (
        <span className="max-w-xs text-xs text-red-500">{state.error}</span>
      )}
    </form>
  );
}
