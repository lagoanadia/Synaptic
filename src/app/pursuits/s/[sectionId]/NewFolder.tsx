"use client";

import { useState, useTransition } from "react";
import { createPursuit } from "../../actions";

// "+" at the end of a notebook's folders: type a name, Enter.
export function NewFolder({ sectionName, label }: { sectionName: string; label: string }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return open ? (
    <form
      action={(fd) => start(async () => { await createPursuit(fd); setOpen(false); })}
      className="flex aspect-[3/2] w-full flex-col justify-center gap-2 self-end rounded-md border-[1.5px] border-dashed border-[#d3d1cb] p-2 sm:w-28"
    >
      <input type="hidden" name="section" value={sectionName} />
      <input autoFocus name="title" required disabled={pending} placeholder={label} aria-label={label} onBlur={(e) => !e.target.value && setOpen(false)} className="w-full rounded border border-border-subtle bg-white px-1.5 py-1 text-xs" />
    </form>
  ) : (
    <button type="button" onClick={() => setOpen(true)} title={label} aria-label={label} className="grid aspect-[3/2] w-full place-items-center self-end rounded-md border-[1.5px] border-dashed border-[#d3d1cb] text-xl text-ink-faint hover:border-ink-faint hover:text-ink sm:w-28">
      +
    </button>
  );
}
