"use client";

import { useState, useTransition } from "react";
import { createPursuit } from "../../actions";

// "+" at the end of a notebook's folders: type a name, Enter.
// `fill`: take the full width of its slot instead of a small tile at the bottom.
export function NewFolder({ sectionName, label, fill = false }: { sectionName: string; label: string; fill?: boolean }) {
  const size = fill ? "w-full" : "w-full self-end sm:w-28";
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return open ? (
    <form
      action={(fd) => start(async () => { await createPursuit(fd); setOpen(false); })}
      className={`flex aspect-[3/2] ${size} flex-col justify-center gap-2 rounded-md border-[1.5px] border-dashed border-[#d3d1cb] p-2`}
    >
      <input type="hidden" name="section" value={sectionName} />
      <input autoFocus name="title" required disabled={pending} placeholder={label} aria-label={label} onBlur={(e) => !e.target.value && setOpen(false)} className="w-full rounded border border-border-subtle bg-white px-1.5 py-1 text-xs" />
    </form>
  ) : (
    <button type="button" onClick={() => setOpen(true)} title={label} aria-label={label} className={`grid aspect-[3/2] ${size} place-items-center rounded-md border-[1.5px] border-dashed border-[#d3d1cb] text-xl text-ink-faint hover:border-ink-faint hover:text-ink`}>
      +
    </button>
  );
}
