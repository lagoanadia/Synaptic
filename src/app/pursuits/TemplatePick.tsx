"use client";

import { useT } from "@/app/LangProvider";
export type Template = "study" | "projects" | "general";

const StudyIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" aria-hidden>
    <path d="M2.5 9 12 4.5 21.5 9 12 13.5Z" />
    <path d="M6.5 11v4.5c0 1.4 2.5 3 5.5 3s5.5-1.6 5.5-3V11M21.5 9v5" />
  </svg>
);
const ProjectsIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" aria-hidden>
    <rect x="4" y="4.5" width="16" height="16" rx="2.5" />
    <path d="M8 10l1.6 1.6L12.5 8.7M8 15.5h8" />
  </svg>
);


export const TEMPLATES: { id: Template; icon: () => React.ReactElement; label: string; hint: string }[] = [
  { id: "study", icon: StudyIcon, label: "Estudios", hint: "Asignaturas, mapa, tarjetas y repaso" },
  { id: "projects", icon: ProjectsIcon, label: "Proyectos", hint: "Proyectos, tareas y calendario" },
];

// The notebook templates: icon over name, three in a row; the chosen
// one's hint goes underneath on one line (not in compact spots).
export function TemplatePick({ value, onChange, compact = false, hint: showHint = true }: { value: Template; onChange: (t: Template) => void; compact?: boolean; hint?: boolean }) {
  const t = useT();
  const hint = TEMPLATES.find((t) => t.id === value)?.hint;
  return (
    <div className="flex flex-col gap-1.5">
      <div className={`grid grid-cols-3 gap-1.5 ${compact ? "text-[11px]" : "text-sm"}`} role="radiogroup" aria-label={t("Plantilla")}>
        {TEMPLATES.map((item) => (
          <button
            key={item.id}
            type="button"
            role="radio"
            aria-checked={value === item.id}
            title={t(item.hint)}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onChange(item.id)}
            className={`flex min-w-0 flex-col items-center gap-1 rounded-md px-1 ${compact ? "py-1.5" : "py-2.5"} font-medium ${value === item.id ? "bg-ink text-white" : "bg-chip text-ink-muted hover:text-ink"}`}
          >
            <item.icon />
            <span className="max-w-full truncate">{t(item.label)}</span>
          </button>
        ))}
      </div>
      {!compact && showHint && hint && <span className="text-xs text-ink-faint">{t(hint)}</span>}
    </div>
  );
}
