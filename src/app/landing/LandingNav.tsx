"use client";

import { useState } from "react";
import { signInWithGithub } from "./actions";

function GetStartedButton({ className }: { className: string }) {
  return (
    <form action={signInWithGithub}>
      <button type="submit" className={className}>
        Get started
      </button>
    </form>
  );
}

export function LandingNav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-black/5 bg-[#f2f1ee]/85 px-5 py-5 backdrop-blur-md sm:px-8">
      <div className="mx-auto flex max-w-6xl items-center justify-between">
        <a href="#" className="flex items-center gap-2.5 font-bold text-[#0d0d0d]">
          <svg width="26" height="26" viewBox="0 0 30 30">
            <rect width="30" height="30" rx="9" fill="#2383e2" />
            <path
              d="M6 20 Q 11 20 12 15 Q 13 10 18 10 Q 22 10 23 13"
              stroke="#fff"
              strokeWidth="1.8"
              fill="none"
              strokeLinecap="round"
            />
            <circle cx="23" cy="13" r="1.6" fill="#fff" />
          </svg>
          Synaptic
        </a>

        <nav className="hidden gap-8 text-sm font-medium text-[#0d0d0d] sm:flex">
          <a href="#features" className="transition-colors hover:text-[#2383e2]">
            Features
          </a>
          <a href="#pricing" className="transition-colors hover:text-[#2383e2]">
            Pricing
          </a>
          <a href="#contact" className="transition-colors hover:text-[#2383e2]">
            Contact
          </a>
        </nav>

        <div className="hidden items-center gap-4 sm:flex">
          <GetStartedButton className="rounded-full bg-[#0d0d0d] px-5 py-2.5 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5 hover:shadow-lg" />
        </div>

        <button
          type="button"
          aria-label="Open menu"
          onClick={() => setOpen((o) => !o)}
          className="flex h-8 w-8 flex-col justify-center gap-1.5 sm:hidden"
        >
          <span
            className={`h-0.5 w-full bg-[#0d0d0d] transition-transform ${open ? "translate-y-2 rotate-45" : ""}`}
          />
          <span className={`h-0.5 w-full bg-[#0d0d0d] transition-opacity ${open ? "opacity-0" : ""}`} />
          <span
            className={`h-0.5 w-full bg-[#0d0d0d] transition-transform ${open ? "-translate-y-2 -rotate-45" : ""}`}
          />
        </button>
      </div>

      <div
        className={`absolute inset-x-0 top-full flex flex-col gap-1 border-b border-black/10 bg-[#f2f1ee] px-5 pb-5 pt-3 transition-all sm:hidden ${
          open ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-3 opacity-0"
        }`}
      >
        {["Features", "Pricing", "Contact"].map((label) => (
          <a
            key={label}
            href={`#${label.toLowerCase()}`}
            onClick={() => setOpen(false)}
            className="border-b border-black/5 py-3 font-medium text-[#0d0d0d]"
          >
            {label}
          </a>
        ))}
        <GetStartedButton className="mt-2 w-full rounded-full bg-[#0d0d0d] px-5 py-2.5 text-center text-sm font-semibold text-white" />
      </div>
    </header>
  );
}
