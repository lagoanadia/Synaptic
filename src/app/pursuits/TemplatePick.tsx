"use client";

export type Template = "study" | "projects";

export const TEMPLATES: { id: Template; icon: string; label: string; hint: string }[] = [
  { id: "study", icon: "🎓", label: "Estudios", hint: "Asignaturas, mapa, tarjetas y repaso" },
  { id: "projects", icon: "📋", label: "Proyectos", hint: "Proyectos, tareas y calendario" },
];

// The two notebook templates, as a pair of buttons.
export function TemplatePick({ value, onChange, compact = false }: { value: Template; onChange: (t: Template) => void; compact?: boolean }) {
  return (
    <div className={`grid grid-cols-2 gap-1.5 ${compact ? "text-xs" : "text-sm"}`} role="radiogroup" aria-label="Plantilla">
      {TEMPLATES.map((t) => (
        <button
          key={t.id}
          type="button"
          role="radio"
          aria-checked={value === t.id}
          title={t.hint}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onChange(t.id)}
          className={`flex flex-col items-start rounded-md px-2 py-1.5 text-left ${value === t.id ? "bg-ink text-white" : "bg-chip text-ink-muted hover:text-ink"}`}
        >
          <span className="font-medium">
            {t.icon} {t.label}
          </span>
          {!compact && <span className={`text-[11px] ${value === t.id ? "text-white/75" : "text-ink-faint"}`}>{t.hint}</span>}
        </button>
      ))}
    </div>
  );
}
