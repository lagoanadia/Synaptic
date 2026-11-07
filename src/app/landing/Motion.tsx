"use client";

import { useEffect } from "react";

// The landing's movement: sections rise in as you scroll, the hero's loose
// papers drift and follow the cursor at different depths, the tidy notes pop
// in while their threads draw, glass catches the light, cards tilt. Nothing
// moves for people who ask for reduced motion.
export function Motion({ rootId }: { rootId: string }) {
  useEffect(() => {
    const root = document.getElementById(rootId);
    if (!root || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    root.classList.add("lnd-js");
    const all = (q: string) => [...root.querySelectorAll<HTMLElement>(q)];

    const show = (el: Element) => {
      el.classList.add("in");
      el.querySelectorAll(".lnd-draw").forEach((d) => d.classList.add("in"));
    };
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && (show(e.target), io.unobserve(e.target))),
      { threshold: 0.2 },
    );
    all(".lnd-reveal, .lnd-draw-on-view").forEach((el) => io.observe(el));
    const intro = window.setTimeout(() => all(".lnd-pop, .lnd-intro-draw").forEach((el) => el.classList.add("in")), 250);

    const loose = all("[data-depth]");
    const tidy = all(".lnd-pop");
    const glass = all(".lnd-glass");
    let frame = 0;
    function onMove(e: MouseEvent) {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const dx = e.clientX / innerWidth - 0.5;
        const dy = e.clientY / innerHeight - 0.5;
        loose.forEach((el) => {
          const d = Number(el.dataset.depth);
          el.style.translate = `${-dx * 30 * d}px ${-dy * 22 * d}px`;
        });
        tidy.forEach((el, i) => (el.style.translate = `${dx * (8 + i * 2)}px ${dy * (6 + i)}px`));
        glass.forEach((g) => {
          const r = g.getBoundingClientRect();
          g.style.setProperty("--mx", `${e.clientX - r.left}px`);
          g.style.setProperty("--my", `${e.clientY - r.top}px`);
        });
      });
    }
    addEventListener("mousemove", onMove);

    const tilts = all(".lnd-tilt");
    const tiltMove = (e: MouseEvent) => {
      const c = e.currentTarget as HTMLElement;
      const r = c.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      c.style.transform = `perspective(900px) rotateY(${x * 8}deg) rotateX(${-y * 8}deg) translateZ(10px)`;
    };
    const tiltLeave = (e: MouseEvent) => ((e.currentTarget as HTMLElement).style.transform = "");
    tilts.forEach((c) => {
      c.addEventListener("mousemove", tiltMove);
      c.addEventListener("mouseleave", tiltLeave);
    });

    const onScroll = () => root.style.setProperty("--scroll", `${scrollY * 0.15}px`);
    addEventListener("scroll", onScroll, { passive: true });

    return () => {
      io.disconnect();
      window.clearTimeout(intro);
      cancelAnimationFrame(frame);
      removeEventListener("mousemove", onMove);
      removeEventListener("scroll", onScroll);
      tilts.forEach((c) => {
        c.removeEventListener("mousemove", tiltMove);
        c.removeEventListener("mouseleave", tiltLeave);
      });
    };
  }, [rootId]);
  return null;
}
