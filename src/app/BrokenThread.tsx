import type { ReactNode } from "react";
import { Stage, Thing } from "./landing/Scene";
import { lndHand, lndSerif } from "./landing/fonts";

// The error and not-found pages: the landing's blue sheet, three notes and a
// snapped thread between the first two.
export function BrokenThread({ title, text, children }: { title: string; text: string; children: ReactNode }) {
  return (
    <main className={`lnd ${lndSerif.variable} ${lndHand.variable} relative flex flex-1 flex-col items-center overflow-hidden px-5 pt-20 pb-16 text-center text-white`}>
      <h1 className="lnd-serif text-[clamp(2.4rem,5vw,4.5rem)] leading-none font-extrabold tracking-[-0.03em]">{title}</h1>
      <p className="mt-4 max-w-[560px] text-[clamp(1rem,1.32vw,1.2rem)] leading-normal opacity-90">{text}</p>
      <div className="mt-12 w-full max-w-[840px]">
        <Stage width={840} height={330}>
          <Thing kind="paper" x={0} y={20} r={-6} className="lnd-big">Estudios</Thing>
          <Thing kind="paper" x={305} y={0} r={3} className="lnd-big">Planes</Thing>
          <Thing kind="paper" x={610} y={25} r={-2} className="lnd-big">Ideas</Thing>
          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 840 330" fill="none" stroke="#fff" strokeWidth={4} strokeLinecap="round" aria-hidden>
            <path d="M225 165 Q 245 185 260 182" />
            <path d="M282 176 Q 298 168 312 155" />
            <path d="M530 160 Q 575 200 620 170" />
          </svg>
        </Stage>
      </div>
      <div className="mt-12 flex flex-wrap items-center justify-center gap-3">{children}</div>
    </main>
  );
}

export const errorButton = "inline-block rounded-full bg-white px-7 py-3.5 text-[15px] font-semibold text-[#111] transition-transform hover:-translate-y-0.5 disabled:opacity-60";
