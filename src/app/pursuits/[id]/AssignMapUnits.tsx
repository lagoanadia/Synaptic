"use client";

import { useT } from "@/app/LangProvider";
import { Select } from "@/app/ui/Select";
import { useTransition } from "react";
import { setMapUnit } from "./actions";

// Maps that couldn't be put in a unit on their own: pick one for each.
export function AssignMapUnits({ pursuitId, maps, units }: { pursuitId: string; maps: { id: string; title: string }[]; units: { id: string; name: string }[] }) {
  const t = useT();
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-dashed border-[#d9c9ad] bg-white/60 px-4 py-3 text-sm">
      <span className="text-[13px] text-ink-muted">{t("Estos conceptos no tienen unidad. Elige a cuál pertenecen:")}</span>
      {maps.map((m) => (
        <div key={m.id} className="flex flex-wrap items-center gap-2">
          <b className="min-w-0 flex-1 truncate">{m.title}</b>
          <Select
            value=""
            onChange={(v) => v && start(() => setMapUnit(pursuitId, m.id, v))}
            ariaLabel={t("Unidad de {0}", { 0: m.title })}
            options={[{ value: "", label: pending ? "…" : t("Elegir unidad…") }, ...units.map((u) => ({ value: u.id, label: u.name }))]}
            className="w-44 rounded-md border border-border-subtle bg-white px-2 py-1 text-sm"
          />
        </div>
      ))}
    </div>
  );
}
