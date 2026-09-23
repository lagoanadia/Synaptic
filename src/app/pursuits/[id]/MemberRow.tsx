"use client";

import { useTransition } from "react";
import { DeleteButton } from "../DeleteButton";
import { removeMember, updateMemberRole } from "./actions";

export function MemberRow({
  pursuitId,
  memberId,
  name,
  role,
}: {
  pursuitId: string;
  memberId: string;
  name: string;
  role: string;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <span className="flex items-center gap-1 text-xs text-ink-muted">
      · {name} (
      <select
        defaultValue={role}
        disabled={isPending}
        onChange={(e) =>
          startTransition(() =>
            updateMemberRole(pursuitId, memberId, e.target.value),
          )
        }
        className="border-none bg-transparent text-xs text-ink-muted disabled:opacity-50"
      >
        <option value="EDITOR">editor</option>
        <option value="VIEWER">viewer</option>
      </select>
      )
      <DeleteButton
        action={removeMember.bind(null, pursuitId, memberId)}
        confirmMessage={`Remove ${name} from this pursuit?`}
        className="text-ink-faint hover:text-red-500"
      >
        ×
      </DeleteButton>
    </span>
  );
}
