"use client";

import { useT } from "@/app/LangProvider";
import { useRouter } from "next/navigation";
import { DeleteButton } from "../DeleteButton";
import { leavePursuit } from "./actions";

export function LeaveButton({ pursuitId }: { pursuitId: string }) {
  const t = useT();
  const router = useRouter();

  return (
    <DeleteButton
      action={leavePursuit.bind(null, pursuitId)}
      confirmMessage={t("¿Salir de esta asignatura? Perderás el acceso salvo que te vuelvan a invitar.")}
      onSuccess={() => router.push("/pursuits")}
      className="text-xs text-ink-faint hover:text-red-500"
    >
      {t("Salir")}
    </DeleteButton>
  );
}
