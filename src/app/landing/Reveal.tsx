"use client";

import { useEffect, useRef, type ReactNode } from "react";

// Fades + slides a section in the first time it scrolls into view — same
// IntersectionObserver approach as the portfolio site's script.js, just
// expressed as a reusable component instead of a querySelectorAll loop.
export function Reveal({
  children,
  delayMs = 0,
  className = "",
}: {
  children: ReactNode;
  delayMs?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.style.opacity = "1";
          el.style.transform = "translateY(0)";
          observer.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{
        opacity: 0,
        transform: "translateY(28px)",
        transition: "opacity 0.7s cubic-bezier(.22,.61,.36,1), transform 0.7s cubic-bezier(.22,.61,.36,1)",
        transitionDelay: `${delayMs}ms`,
      }}
      className={className}
    >
      {children}
    </div>
  );
}
