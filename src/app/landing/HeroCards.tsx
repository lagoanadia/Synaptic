"use client";

import { useEffect, useRef } from "react";
import { Reveal } from "./Reveal";

const cardBase =
  "w-[200px] min-h-[130px] rounded-2xl p-[18px] text-left shadow-[0_8px_24px_rgba(13,13,13,0.08),0_2px_6px_rgba(13,13,13,0.06)] transition-shadow duration-300 hover:shadow-[0_24px_48px_-12px_rgba(13,13,13,0.22),0_8px_16px_rgba(13,13,13,0.08)] motion-safe:animate-[float_6s_ease-in-out_infinite]";

export function HeroCards() {
  const containerRef = useRef<HTMLDivElement>(null);

  // Mouse-parallax tilt — skipped on touch devices and reduced-motion, same
  // as the standalone version.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    if (window.matchMedia("(hover: none)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const cards = el.querySelectorAll<HTMLElement>("[data-tilt-card]");

    function handleMove(e: MouseEvent) {
      const bounds = el!.getBoundingClientRect();
      const relX = (e.clientX - bounds.left) / bounds.width - 0.5;
      const relY = (e.clientY - bounds.top) / bounds.height - 0.5;
      cards.forEach((card) => {
        card.style.setProperty("--tilt-x", `${relX * 10}deg`);
        card.style.setProperty("--tilt-y", `${-relY * 10}deg`);
      });
    }
    function handleLeave() {
      cards.forEach((card) => {
        card.style.setProperty("--tilt-x", "0deg");
        card.style.setProperty("--tilt-y", "0deg");
      });
    }

    el.addEventListener("mousemove", handleMove);
    el.addEventListener("mouseleave", handleLeave);
    return () => {
      el.removeEventListener("mousemove", handleMove);
      el.removeEventListener("mouseleave", handleLeave);
    };
  }, []);

  const tiltStyle = {
    transform:
      "translateY(0) rotateX(var(--tilt-y, 0deg)) rotateY(var(--tilt-x, 0deg))",
    transition: "transform 0.4s cubic-bezier(.22,.61,.36,1)",
  } as const;

  return (
    <div
      ref={containerRef}
      className="mt-16 flex flex-wrap justify-center gap-[18px]"
      style={{ perspective: "1000px" }}
    >
      <Reveal delayMs={0}>
        <div data-tilt-card style={tiltStyle} className={`${cardBase} bg-white`}>
          <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-[#2383e2]" />
          <span className="text-xs font-semibold opacity-65">Chem · active</span>
          <p className="mt-2 text-[0.95rem] font-bold leading-tight">Ch.9 — Thermodynamics</p>
          <span className="mt-3 inline-block rounded-full bg-[#eaf3fd] px-2.5 py-0.5 text-[0.7rem] font-bold text-[#2383e2]">
            12 cards
          </span>
        </div>
      </Reveal>
      <Reveal delayMs={90}>
        <div data-tilt-card style={tiltStyle} className={`${cardBase} bg-[#2383e2] text-white`}>
          <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-white" />
          <span className="text-xs font-semibold opacity-65">Bio Lab · active</span>
          <p className="mt-2 text-[0.95rem] font-bold leading-tight">Prep organized into 3 sections</p>
          <span className="mt-3 inline-block rounded-full bg-white/25 px-2.5 py-0.5 text-[0.7rem] font-bold">
            Today
          </span>
        </div>
      </Reveal>
      <Reveal delayMs={180}>
        <div data-tilt-card style={tiltStyle} className={`${cardBase} bg-[#ebda3c]`}>
          <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-[#2383e2]" />
          <span className="text-xs font-semibold opacity-65">Essay · active</span>
          <p className="mt-2 text-[0.95rem] font-bold leading-tight">Outline shared with 2 classmates</p>
          <span className="mt-3 inline-block rounded-full bg-black/10 px-2.5 py-0.5 text-[0.7rem] font-bold">
            Shared
          </span>
        </div>
      </Reveal>
      <Reveal delayMs={270}>
        <div data-tilt-card style={tiltStyle} className={`${cardBase} bg-[#b5502e] text-white`}>
          <span className="text-[0.75rem] font-bold opacity-85">Ask</span>
          <p className="mt-2 text-[0.95rem] font-bold leading-tight">
            &quot;What&apos;s the Krebs cycle?&quot; → answered from your notes
          </p>
        </div>
      </Reveal>
    </div>
  );
}
