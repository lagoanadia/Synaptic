"use client";

import { useEffect, useRef, useState } from "react";
import { Popover } from "./Popover";

const SLOTS = Array.from({ length: 96 }, (_, i) => `${String(Math.floor(i / 4)).padStart(2, "0")}:${String((i % 4) * 15).padStart(2, "0")}`);

// "9", "930", "9:30", "21.5" → "09:30"-style; null if it isn't a time.
function clean(v: string): string | null {
  const m = v.trim().match(/^(\d{1,2})(?:[:.h ]?(\d{2}))?$/);
  if (!m) return null;
  const h = +m[1];
  const min = +(m[2] ?? 0);
  return h < 24 && min < 60 ? `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}` : null;
}

// A time field: type it ("930", "21:15") or pick from a list every quarter
// hour, in Synaptic's style instead of the browser's spinner.
export function TimePicker({ value, onChange, ariaLabel, className = "" }: { value: string; onChange: (v: string) => void; ariaLabel?: string; className?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  // What's typed, while typing; otherwise the saved value shows.
  const [typed, setText] = useState<string | null>(null);
  const text = typed ?? value;

  useEffect(() => {
    if (!open) return;
    const near = value || `${String(new Date().getHours()).padStart(2, "0")}:00`;
    const i = Math.max(0, SLOTS.findIndex((s) => s >= near));
    requestAnimationFrame(() => list.current?.children[i]?.scrollIntoView({ block: "center" }));
  }, [open, value]);

  const done = (v: string) => {
    const c = v === "" ? "" : clean(v);
    setText(null);
    if (c !== null && c !== value) onChange(c);
  };

  return (
    <>
      <input
        ref={input}
        value={text}
        placeholder="--:--"
        inputMode="numeric"
        aria-label={ariaLabel}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => done(text)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            done(text);
            setOpen(false);
          }
        }}
        className={`tabular-nums ${className}`}
      />
      <Popover anchor={input} open={open} onClose={() => setOpen(false)} matchWidth label={ariaLabel}>
        <div ref={list} className="flex max-h-56 w-28 flex-col overflow-y-auto p-1 text-sm tabular-nums">
          {value && (
            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => (done(""), setOpen(false))} className="rounded-md px-2 py-1 text-left text-xs text-ink-faint hover:bg-hover hover:text-ink">
              --:--
            </button>
          )}
          {SLOTS.map((s) => (
            <button
              key={s}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                done(s);
                setOpen(false);
              }}
              className={`rounded-md px-2 py-1 text-left ${s === value ? "bg-accent font-medium text-accent-fg" : "text-ink-muted hover:bg-hover hover:text-ink"}`}
            >
              {s}
            </button>
          ))}
        </div>
      </Popover>
    </>
  );
}
