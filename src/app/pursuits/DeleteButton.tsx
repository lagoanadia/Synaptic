"use client";

import { ask } from "@/app/ui/PopupHost";
import { useTransition, type ReactNode } from "react";

// Runs a bound server action, after a confirm dialog if confirmMessage is set.
export function DeleteButton({
  action,
  confirmMessage,
  onSuccess,
  className,
  children,
}: {
  action: () => Promise<void>;
  confirmMessage?: string;
  onSuccess?: () => void;
  className?: string;
  children: ReactNode;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={async () => {
        if (confirmMessage && !(await ask.confirm(confirmMessage, { danger: true }))) return;
        startTransition(async () => {
          await action();
          onSuccess?.();
        });
      }}
      className={className}
    >
      {children}
    </button>
  );
}
