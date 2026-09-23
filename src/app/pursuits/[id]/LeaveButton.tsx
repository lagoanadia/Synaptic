"use client";

import { useRouter } from "next/navigation";
import { DeleteButton } from "../DeleteButton";
import { leavePursuit } from "./actions";

export function LeaveButton({ pursuitId }: { pursuitId: string }) {
  const router = useRouter();

  return (
    <DeleteButton
      action={leavePursuit.bind(null, pursuitId)}
      confirmMessage="Leave this pursuit? You'll lose access unless invited back."
      onSuccess={() => router.push("/pursuits")}
      className="text-xs text-ink-faint hover:text-red-500"
    >
      Leave
    </DeleteButton>
  );
}
