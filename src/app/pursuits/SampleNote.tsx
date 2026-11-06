"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { removeSample } from "../onboarding/actions";

// After the welcome flow: what was written as an example, and a way to
// remove exactly that.
export function SampleNote({ topic, cards }: { topic: string; cards: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <p className="-mt-6 flex flex-wrap items-center gap-x-2 text-sm text-ink-faint">
      <span className="text-[#c99a2e]">✦</span>
      Una página{cards > 0 && ` y ${cards} tarjetas`} de ejemplo sobre {topic}
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => { await removeSample(); router.refresh(); })}
        className="text-ink-muted underline-offset-2 hover:text-ink hover:underline disabled:opacity-50"
      >
        Quitar lo de ejemplo
      </button>
    </p>
  );
}
