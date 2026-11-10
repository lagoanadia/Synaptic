"use client";

import { useState, useTransition } from "react";
import { createPursuit, deleteFolderTemplate } from "../../actions";
import { FOLDER_TEMPLATES, type FolderTemplate } from "@/lib/blocks";

// "+" at the end of a notebook's folders: type a name, Enter. Outside
// study notebooks you also pick a template (En blanco / Proyecto / Planificador).
// `fill`: take the full width of its slot instead of a small tile at the bottom.
// mine: the templates you saved; picked as "u:<id>".
export function NewFolder({ sectionName, label, fill = false, template: initial, mine = [] }: { sectionName: string; label: string; fill?: boolean; template?: FolderTemplate; mine?: { id: string; name: string }[] }) {
  const size = fill ? "w-full" : "w-full sm:w-44";
  const [open, setOpen] = useState(false);
  const [template, setTemplate] = useState<string | undefined>(initial);
  const [pending, start] = useTransition();
  return open ? (
    <form
      action={(fd) => start(async () => { await createPursuit(fd); setOpen(false); })}
      className={`flex ${initial ? "" : "aspect-[3/2]"} ${size} flex-col justify-center gap-2 rounded-md border-[1.5px] border-dashed border-[#d3d1cb] p-2`}
    >
      <input type="hidden" name="section" value={sectionName} />
      {template && <input type="hidden" name="template" value={template} />}
      <input autoFocus name="title" required disabled={pending} placeholder={label} aria-label={label} className="w-full rounded border border-border-subtle bg-white px-1.5 py-1 text-xs" />
      {initial && (
        <span className="flex flex-wrap gap-1" role="radiogroup" aria-label="Plantilla">
          {FOLDER_TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={template === t.id}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setTemplate(t.id)}
              className={`rounded-full px-2 py-0.5 text-[11px] ${template === t.id ? "bg-ink text-white" : "bg-chip text-ink-muted hover:text-ink"}`}
            >
              {t.label}
            </button>
          ))}
          {mine.map((t) => (
            <span key={t.id} className={`flex items-center rounded-full text-[11px] ${template === `u:${t.id}` ? "bg-ink text-white" : "bg-chip text-ink-muted"}`}>
              <button type="button" role="radio" aria-checked={template === `u:${t.id}`} onMouseDown={(e) => e.preventDefault()} onClick={() => setTemplate(`u:${t.id}`)} className="py-0.5 pl-2 hover:text-ink">
                {t.name}
              </button>
              <button
                type="button"
                title="Borrar plantilla"
                aria-label={`Borrar la plantilla ${t.name}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  if (!window.confirm(`¿Borrar la plantilla "${t.name}"? Las carpetas hechas con ella no cambian.`)) return;
                  if (template === `u:${t.id}`) setTemplate(initial);
                  start(() => deleteFolderTemplate(t.id));
                }}
                className="px-1.5 py-0.5 opacity-50 hover:opacity-100"
              >
                ×
              </button>
            </span>
          ))}
        </span>
      )}
      <span className="flex gap-1.5">
        <button type="submit" disabled={pending} className="rounded bg-ink px-2 py-0.5 text-[11px] font-medium text-white disabled:opacity-60">
          Crear
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded px-2 py-0.5 text-[11px] text-ink-faint hover:text-ink">
          Cancelar
        </button>
      </span>
    </form>
  ) : (
    <button type="button" onClick={() => setOpen(true)} title={label} aria-label={label} className={`grid aspect-[3/2] ${fill ? "w-full" : "w-full sm:w-28"} place-items-center rounded-md border-[1.5px] border-dashed border-[#d3d1cb] text-xl text-ink-faint hover:border-ink-faint hover:text-ink`}>
      +
    </button>
  );
}
