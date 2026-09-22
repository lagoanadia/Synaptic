"use client";

import { useTransition, type ReactNode } from "react";

// Wraps any bound server action (a 0-arg async function, e.g.
// deleteBrainDump.bind(null, pursuitId, dumpId)) in a confirm dialog before
// running it, so a delete never fires from a stray click.
export function DeleteButton({
  action,
  confirmMessage,
  onSuccess,
  className,
  children,
}: {
  action: () => Promise<void>;
  confirmMessage: string;
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
        if (!window.confirm(confirmMessage)) return;
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
