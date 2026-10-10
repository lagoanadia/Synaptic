"use client";

import { useEffect, useState } from "react";

export type TourStep = {
  // CSS selector for the element this step points at — set via a
  // data-tour="..." attribute on the target (see pursuits/page.tsx and
  // pursuits/[id]/page.tsx). If the selector matches nothing (e.g. a
  // step targeting a tab that isn't the active one), the step still
  // shows, just without the highlighted box around anything.
  target: string;
  title: string;
  body: string;
};

// A minimal, dependency-free product tour: one popup bubble at a time,
// positioned next to whichever element the current step targets, with a
// highlight ring drawn around it. Built from scratch rather than pulling
// in react-joyride/driver.js since the app has no popover/overlay
// component at all yet (see the onboarding research) — this covers the
// one thing we need without a new dependency.
export function Tour({
  steps,
  labels = { skip: "Skip tutorial", next: "Next", done: "Got it" },
  onFinish,
}: {
  steps: TourStep[];
  // Button text — defaults to English; pages pass the viewer's own
  // locale's labels from src/lib/i18n.ts's TOUR_UI instead.
  labels?: { skip: string; next: string; done: string };
  // Called once, when the user finishes the last step or clicks "Skip".
  // The list-page tour passes nothing here (dismissing it is purely
  // local — it can reappear on a later visit); the detail-page tour
  // passes completeOnboarding, since finishing *that* one is what stops
  // both tours for good. See pursuits/page.tsx and pursuits/[id]/page.tsx.
  onFinish?: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const step = steps[index];

  useEffect(() => {
    if (!step) return;
    function update() {
      const el = document.querySelector(step!.target);
      setRect(el ? el.getBoundingClientRect() : null);
    }
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [step]);

  if (dismissed || !step) return null;

  const isLast = index === steps.length - 1;

  function close() {
    setDismissed(true);
    onFinish?.();
  }

  function next() {
    if (isLast) close();
    else setIndex((i) => i + 1);
  }

  // Default to a fixed spot near the top of the viewport when the target
  // isn't on screen, so the step still reads instead of rendering nothing.
  let top = 96;
  let left = 16;
  if (rect) {
    const spaceBelow = window.innerHeight - rect.bottom;
    const fitsBelow = spaceBelow > 190;
    top = fitsBelow ? rect.bottom + 12 : Math.max(16, rect.top - 12 - 170);
    left = Math.min(Math.max(rect.left, 16), window.innerWidth - 336);
  }

  return (
    <>
      {rect && (
        <div
          aria-hidden
          style={{
            position: "fixed",
            top: rect.top - 4,
            left: rect.left - 4,
            width: rect.width + 8,
            height: rect.height + 8,
            borderRadius: 12,
          }}
          className="pointer-events-none z-[90] ring-2 ring-accent ring-offset-2 ring-offset-background transition-all"
        />
      )}
      <div
        style={{ position: "fixed", top, left, width: 320 }}
        className="z-[91] flex flex-col gap-2 rounded-2xl border border-border-subtle bg-white p-4 shadow-[0_24px_48px_-12px_rgba(13,13,13,0.22),0_8px_16px_rgba(13,13,13,0.08)]"
      >
        <p className="text-sm font-semibold text-ink">{step.title}</p>
        <p className="text-sm text-ink-muted">{step.body}</p>
        <div className="mt-1 flex items-center justify-between">
          <button
            type="button"
            onClick={close}
            className="text-xs text-ink-faint hover:text-ink"
          >
            {labels.skip}
          </button>
          <div className="flex items-center gap-2">
            <span className="text-xs text-ink-faint">
              {index + 1}/{steps.length}
            </span>
            <button
              type="button"
              onClick={next}
              className="rounded-full bg-ink px-3.5 py-1.5 text-xs font-semibold text-white transition-transform hover:-translate-y-0.5 hover:shadow-md"
            >
              {isLast ? labels.done : labels.next}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
