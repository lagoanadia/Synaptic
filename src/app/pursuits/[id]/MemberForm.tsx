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
        placeholder="+ invitar por email"
        disabled={isPending}
        className="w-48 rounded-md border border-dashed border-border-subtle bg-transparent px-2.5 py-1 text-sm focus:w-64 focus:outline-none disabled:opacity-50"
      />
      <select
        name="role"
        defaultValue="EDITOR"
        disabled={isPending}
        className="rounded-md border border-dashed border-border-subtle bg-transparent px-2 py-1 text-sm disabled:opacity-50"
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
