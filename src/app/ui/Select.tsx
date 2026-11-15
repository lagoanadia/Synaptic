"use client";

import { useId, useRef, useState } from "react";
import { Chevron, Popover } from "./Popover";

export type Option = { value: string; label: React.ReactNode; hint?: React.ReactNode };

// A drop-down in Synaptic's style instead of the browser's native <select>.
// `className` styles the trigger, so each place keeps its own look.
export function Select({
  value,
  onChange,
  options,
  ariaLabel,
  className = "",
  disabled,
  onOpen,
  name,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  ariaLabel?: string;
  className?: string;
  disabled?: boolean;
  onOpen?: () => void;
  name?: string;
  placeholder?: React.ReactNode;
}) {
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const id = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const current = options.find((o) => o.value === value);

  const show = () => {
    const i = Math.max(0, options.findIndex((o) => o.value === value));
    setActive(i);
    onOpen?.();
    setOpen(true);
    requestAnimationFrame(() => {
      list.current?.focus({ preventScroll: true });
      list.current?.children[i]?.scrollIntoView({ block: "nearest" });
    });
  };

  const pick = (v: string) => {
    setOpen(false);
    button.current?.focus();
    if (v !== value) onChange(v);
  };
  const go = (i: number) => {
    const n = (i + options.length) % options.length;
    setActive(n);
    list.current?.children[n]?.scrollIntoView({ block: "nearest" });
  };

  return (
    <>
      <button
        ref={button}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={(e) => {
          if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
            e.preventDefault();
            show();
          }
        }}
        className={`inline-flex max-w-full min-w-0 items-center gap-1.5 text-left ${className}`}
      >
        <span className="min-w-0 flex-1 truncate">{current?.label ?? placeholder ?? ""}</span>
        <span className="shrink-0 opacity-60">
          <Chevron size={11} />
        </span>
      </button>
      {name && <input type="hidden" name={name} value={value} />}
      <Popover anchor={button} open={open} onClose={() => setOpen(false)} matchWidth label={ariaLabel}>
        <div
          ref={list}
          id={id}
          role="listbox"
          tabIndex={-1}
          aria-label={ariaLabel}
          aria-activedescendant={`${id}-${active}`}
          className="flex max-h-72 max-w-[min(320px,calc(100vw-16px))] flex-col overflow-y-auto p-1 text-sm outline-none"
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") go(active + 1);
            else if (e.key === "ArrowUp") go(active - 1);
            else if (e.key === "Home") go(0);
            else if (e.key === "End") go(options.length - 1);
            else if (e.key === "Enter" || e.key === " ") {
              if (options[active]) pick(options[active].value);
            }
            else if (e.key === "Tab") setOpen(false);
            else if (e.key.length === 1) {
              // Type a letter to jump to the next option starting with it.
              const k = e.key.toLowerCase();
              const text = (o: Option) => (typeof o.label === "string" ? o.label : "").toLowerCase();
              const next = options.findIndex((o, i) => i > active && text(o).startsWith(k));
              const first = options.findIndex((o) => text(o).startsWith(k));
              if (next >= 0 || first >= 0) go(next >= 0 ? next : first);
              return;
            } else return;
            e.preventDefault();
          }}
        >
          {options.map((o, i) => {
            const sel = o.value === value;
            return (
              <div
                key={o.value}
                id={`${id}-${i}`}
                role="option"
                aria-selected={sel}
                onPointerMove={() => setActive(i)}
                onClick={() => pick(o.value)}
                className={`flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 ${i === active ? "bg-hover" : ""} ${sel ? "font-medium text-ink" : "text-ink-muted"}`}
              >
                <span className="min-w-0 flex-1 truncate">
                  {o.label}
                  {o.hint && <span className="ml-1.5 text-xs text-ink-faint">{o.hint}</span>}
                </span>
                <span className={`shrink-0 text-accent ${sel ? "" : "invisible"}`}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="m5 12.5 4.5 4.5L19 7.5" />
                  </svg>
                </span>
              </div>
            );
          })}
        </div>
      </Popover>
    </>
  );
}
