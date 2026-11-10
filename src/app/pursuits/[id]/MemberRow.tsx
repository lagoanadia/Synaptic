"use client";

import { useT } from "@/app/LangProvider";
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
  const t = useT();
  const [isPending, startTransition] = useTransition();

  return (
    <span className="flex items-center gap-1 text-sm text-ink-muted">
      · {name} (
      <select
        defaultValue={role}
        disabled={isPending}
        onChange={(e) =>
          startTransition(() =>
            updateMemberRole(pursuitId, memberId, e.target.value),
          )
        }
        className="border-none bg-transparent text-sm text-ink-muted disabled:opacity-50"
      >
        <option value="EDITOR">{t("editor")}</option>
        <option value="VIEWER">{t("viewer")}</option>
      </select>
      )
      <DeleteButton
        action={removeMember.bind(null, pursuitId, memberId)}
        confirmMessage={t("¿Quitar a {0} de esta asignatura?", { 0: name })}
        className="text-ink-faint hover:text-red-500"
      >
        ×
      </DeleteButton>
    </span>
  );
}
