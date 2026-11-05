"use client";

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
      onClick={() => {
        if (confirmMessage && !window.confirm(confirmMessage)) return;
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
