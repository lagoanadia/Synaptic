"use client";

import { Select } from "@/app/ui/Select";
import { useT } from "@/app/LangProvider";
import { useState, useTransition } from "react";
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
  const [current, setCurrent] = useState<string>(role);

  return (
    <span className="flex items-center gap-1 text-sm text-ink-muted">
      <span className="text-ink">{name}</span>
      <span className="flex-1" />
      <Select
        value={current}
        disabled={isPending}
        onChange={(v) => {
          setCurrent(v);
          startTransition(() => updateMemberRole(pursuitId, memberId, v));
        }}
        ariaLabel={t("Permiso")}
        options={[
          { value: "EDITOR", label: t("Edita") },
          { value: "VIEWER", label: t("Lee") },
        ]}
        className="rounded-md px-1.5 py-0.5 text-sm text-ink-muted hover:bg-chip disabled:opacity-50"
      />
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
