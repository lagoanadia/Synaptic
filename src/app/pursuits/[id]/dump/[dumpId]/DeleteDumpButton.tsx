"use client";

import { useRouter } from "next/navigation";
import { DeleteButton } from "../../DeleteButton";
import { deleteBrainDump } from "../../actions";

export function DeleteDumpButton({
  pursuitId,
  dumpId,
}: {
  pursuitId: string;
  dumpId: string;
}) {
  const router = useRouter();

  return (
    <DeleteButton
      action={deleteBrainDump.bind(null, pursuitId, dumpId)}
      confirmMessage="Delete this page? This can't be undone."
      onSuccess={() => router.push(`/pursuits/${pursuitId}?tab=dump`)}
      className="text-sm text-ink-muted hover:text-red-500"
    >
      Delete
    </DeleteButton>
  );
}
