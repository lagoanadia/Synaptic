"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { XIcon } from "@/app/icons";
import type { GoogleCalendar } from "@/lib/googleCalendar";
import { disconnectGoogle, googleState, saveGoogleSettings, syncGoogleNow, type GoogleSettings } from "./actions";

export const GoogleLogo = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
    <rect x="3" y="4" width="18" height="17" rx="3" fill="#fff" stroke="#4285f4" strokeWidth="1.6" />
    <rect x="3" y="4" width="18" height="5" rx="2" fill="#4285f4" />
    <text x="12" y="18.5" textAnchor="middle" fontSize="8" fontWeight="700" fill="#4285f4">
      31
    </text>
  </svg>
);

function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className={`relative h-[22px] w-[38px] shrink-0 rounded-full transition-colors ${on ? "bg-accent" : "bg-[#e3e2de]"}`}>
      <span className={`absolute top-[3px] size-4 rounded-full bg-white shadow transition-all ${on ? "left-[19px]" : "left-[3px]"}`} />
    </button>
  );
}

// Connect Google Calendar and choose what goes each way.
export function GoogleModal({ status, justConnected, onClose }: { status: "off" | "on" | "error"; justConnected: string | null; onClose: () => void }) {
  const router = useRouter();
  const [loaded, setLoaded] = useState(false);
  const [connected, setConnected] = useState(false);
  const [calendars, setCalendars] = useState<GoogleCalendar[]>([]);
  const [s, setS] = useState<GoogleSettings>({ pull: true, push: true, reviewBlocks: false, calendarIds: [] });
  const [pending, start] = useTransition();
  const [note, setNote] = useState<string | null>(justConnected === "failed" ? "No se ha podido conectar. Inténtalo otra vez." : justConnected === "denied" ? "Has cancelado el permiso." : null);

  useEffect(() => {
    googleState()
      .then((g) => {
        setConnected(g.connected);
        setCalendars(g.calendars);
        if (g.settings) setS({ ...g.settings, calendarIds: g.settings.calendarIds.length ? g.settings.calendarIds : g.calendars.filter((c) => c.selected).map((c) => c.id) });
      })
      .finally(() => setLoaded(true));
  }, []);

  const rows: { key: "pull" | "push" | "reviewBlocks"; icon: string; label: string; hint?: string }[] = [
    { key: "pull", icon: "↓", label: "Traer tus eventos" },
    { key: "push", icon: "↑", label: "Enviar entregas, exámenes y tareas" },
    { key: "reviewBlocks", icon: "◷", label: "Bloques de repaso", hint: "20 min la tarde antes de un examen" },
  ];
  const connectHref = `/api/google-calendar/connect?pull=${s.pull ? 1 : 0}&push=${s.push ? 1 : 0}&blocks=${s.reviewBlocks ? 1 : 0}`;

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-ink/10 px-4" onMouseDown={onClose} role="dialog" aria-label="Google Calendar">
      <div className="flex w-full max-w-[440px] flex-col gap-1 rounded-2xl bg-white p-6 shadow-[0_0_0_1px_rgba(15,15,15,.05),0_24px_60px_rgba(15,15,15,.22)]" onMouseDown={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center gap-3">
          <GoogleLogo size={30} />
          <b className="flex-1 text-lg">Google Calendar</b>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="rounded p-1 text-ink-faint hover:bg-chip">
            <XIcon size={18} className="block" />
          </button>
        </div>
        {rows.map((r) => (
          <div key={r.key} className="flex items-center gap-3 border-b border-border-subtle py-3">
            <span className="grid size-8 place-items-center rounded-md bg-chip text-ink-muted">{r.icon}</span>
            <span className="flex flex-1 flex-col text-sm">
              {r.label}
              {r.hint && <span className="text-xs text-ink-faint">{r.hint}</span>}
            </span>
            <Switch on={s[r.key]} label={r.label} onChange={(v) => setS({ ...s, [r.key]: v })} />
          </div>
        ))}
        {connected && calendars.length > 1 && s.pull && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3 text-sm">
            <span className="text-ink-faint">Calendarios</span>
            {calendars.map((c) => {
              const on = s.calendarIds.includes(c.id);
              return (
                <label key={c.id} className="flex cursor-pointer items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => setS({ ...s, calendarIds: on ? s.calendarIds.filter((x) => x !== c.id) : [...s.calendarIds, c.id] })}
                    className="size-4"
                    style={{ accentColor: c.color }}
                  />
                  {c.name}
                </label>
              );
            })}
          </div>
        )}
        {note && <p className="pt-2 text-xs text-red-500">{note}</p>}
        {!loaded ? (
          <span className="mt-4 h-11 animate-pulse rounded-xl bg-chip" />
        ) : connected ? (
          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => start(async () => { await saveGoogleSettings(s); onClose(); router.refresh(); })}
              className="flex-1 rounded-xl bg-ink py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              Guardar
            </button>
            <button
              type="button"
              disabled={pending}
              title="Enviar ahora"
              onClick={() => start(async () => { const r = await syncGoogleNow(); setNote(r.ok ? null : "No se ha podido enviar."); router.refresh(); })}
              className="rounded-xl border border-border-subtle px-4 py-3 text-sm text-ink-muted hover:bg-chip"
            >
              ↻
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => window.confirm("¿Desconectar Google Calendar?") && start(async () => { await disconnectGoogle(); onClose(); router.refresh(); })}
              className="rounded-xl px-3 py-3 text-xs text-ink-faint hover:text-red-600"
            >
              Desconectar
            </button>
          </div>
        ) : (
          <a href={connectHref} className="mt-4 rounded-xl bg-ink py-3 text-center text-sm font-semibold text-white">
            {status === "error" ? "Volver a conectar" : "Conectar"}
          </a>
        )}
      </div>
    </div>
  );
}
