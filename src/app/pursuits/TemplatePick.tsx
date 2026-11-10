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

const GeneralIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" aria-hidden>
    <rect x="4" y="4" width="7" height="7" rx="1.5" />
    <rect x="13" y="4" width="7" height="7" rx="1.5" />
    <rect x="4" y="13" width="7" height="7" rx="1.5" />
    <path d="M16.5 13.5v6M13.5 16.5h6" />
  </svg>
);

export const TEMPLATES: { id: Template; icon: () => React.ReactElement; label: string; hint: string }[] = [
  { id: "study", icon: StudyIcon, label: "Estudios", hint: "Asignaturas, mapa, tarjetas y repaso" },
  { id: "projects", icon: ProjectsIcon, label: "Proyectos", hint: "Proyectos, tareas y calendario" },
  { id: "general", icon: GeneralIcon, label: "General", hint: "Libre: tú eliges los bloques" },
];

// The notebook templates, as a row of buttons.
export function TemplatePick({ value, onChange, compact = false }: { value: Template; onChange: (t: Template) => void; compact?: boolean }) {
  const t = useT();
  return (
    <div className={`grid grid-cols-3 gap-1.5 ${compact ? "text-xs" : "text-sm"}`} role="radiogroup" aria-label={t("Plantilla")}>
      {TEMPLATES.map((item) => (
        <button
          key={item.id}
          type="button"
          role="radio"
          aria-checked={value === item.id}
          title={t(item.hint)}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onChange(item.id)}
          className={`flex flex-col items-start rounded-md px-2 py-1.5 text-left ${value === item.id ? "bg-ink text-white" : "bg-chip text-ink-muted hover:text-ink"}`}
        >
          <span className="flex items-center gap-1.5 font-medium">
            <item.icon />
            {t(item.label)}
          </span>
          {!compact && <span className={`text-[11px] ${value === item.id ? "text-white/75" : "text-ink-faint"}`}>{t(item.hint)}</span>}
        </button>
      ))}
    </div>
  );
}
