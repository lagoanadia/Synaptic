"use client";

import { useState } from "react";

// Maps make themselves from your notes; making one from a PowerPoint, PDF,
// pasted text or GitHub is tucked away here.
export function MapMore({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} title="Crear un mapa desde otro sitio" aria-label="Más opciones del mapa" className="self-end rounded-md px-2 py-0.5 text-ink-faint hover:bg-chip hover:text-ink">
        ⋯
      </button>
      {open && children}
    </div>
  );
}
