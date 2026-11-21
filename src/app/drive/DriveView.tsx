"use client";

import { useLocale, useT } from "@/app/LangProvider";
import { useState, useTransition } from "react";
import { approveAll, fixSource, makeScript, retry, saveSettings, undo } from "./actions";
import { Select } from "@/app/ui/Select";
import { ask } from "@/app/ui/PopupHost";

export type SourceRow = { id: string; name: string; status: string; reason: string | null; error: string | null; path: string | null; kind: string | null; unit: number | null; subject: string | null; createdAt: string };
type Change = { id: string; runId: string; action: string; path: string; fileId: string; undo: string | null; at: string };

const KIND: Record<string, string> = { topic: "Tema", statement: "Enunciado", code: "Código", submission: "Mi entrega", session: "Sesión" };
const REASON: Record<string, string> = { "no-unit": "El nombre no dice la unidad", "no-subject": "El nombre no dice la asignatura", unknown: "No sé dónde va" };
const card = "rounded-xl bg-white p-5 shadow-[0_0_0_1px_rgba(15,15,15,.07),0_1px_2px_rgba(15,15,15,.04)]";
const btn = "rounded-lg bg-chip px-3 py-1.5 text-sm font-medium hover:bg-hover disabled:opacity-50";
const primary = "rounded-lg bg-accent px-3.5 py-1.5 text-sm font-semibold text-white hover:brightness-95 disabled:opacity-50";

export function DriveView({
  installed,
  lastSeen,
  autoApply,
  studentNames,
  links,
  subjects,
  sources,
  changes,
}: {
  installed: boolean;
  lastSeen: string | null;
  autoApply: boolean;
  studentNames: string[];
  links: string[];
  subjects: string[];
  sources: SourceRow[];
  changes: Change[];
}) {
  const t = useT();
  const locale = useLocale();
  const [pending, start] = useTransition();
  const [script, setScript] = useState<{ script: string; manifest: string } | null>(null);
  const [names, setNames] = useState(studentNames.join(", "));
  const [pasted, setPasted] = useState(links.join("\n"));
  const [auto, setAuto] = useState(autoApply);
  const [copied, setCopied] = useState<string | null>(null);
  const run = (fn: () => Promise<unknown>) => start(async () => void (await fn()));
  const when = (iso: string) => new Date(iso).toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const copy = (text: string, what: string) => navigator.clipboard.writeText(text).then(() => (setCopied(what), setTimeout(() => setCopied(null), 1500)));

  const review = sources.filter((s) => s.status === "review");
  const planned = sources.filter((s) => s.status === "planned");
  const queued = sources.filter((s) => s.status === "approved");
  const failed = sources.filter((s) => s.status === "error");
  const doneCount = sources.filter((s) => s.status === "done").length;
  const runs = [...new Set(changes.map((c) => c.runId))];

  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-1 flex-col gap-8 px-6 py-8 sm:px-12 lg:py-12">
      <header className="flex flex-col gap-1">
        <h1 className="text-[2rem] font-bold tracking-tight">{t("Unificar con Drive")}</h1>
        <p className="max-w-2xl text-sm text-ink-muted">
          {t("Synaptic ordena el material de clase en tu Drive (Asignatura → UD → temas en PDF, y una carpeta Entrega por unidad) y lo mantiene al día cada hora. Nada se mueve hasta que lo apruebas, y nunca se borra: lo viejo va a la papelera.")}
        </p>
      </header>

      {/* 1 · Install */}
      <section className={`${card} flex flex-col gap-4`}>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="flex-1 text-[15px] font-semibold">1 · {t("Instala el script en tu cuenta de Google")}</h2>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${lastSeen ? "bg-[#e6f2ea] text-[#2f7a4f]" : "bg-chip text-ink-muted"}`}>
            {lastSeen ? t("Conectado · última vez {0}", { 0: when(lastSeen) }) : installed ? t("Esperando al script…") : t("Sin instalar")}
          </span>
        </div>
        <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-sm text-ink-muted">
          <li>{t("Pulsa «Generar mi script» y cópialo.")}</li>
          <li>
            {t("Abre")}{" "}
            <a href="https://script.new" target="_blank" rel="noopener noreferrer" className="font-medium text-accent hover:underline">script.new</a>{" "}
            {t("con tu cuenta del centro, borra lo que haya y pégalo.")}
          </li>
          <li>{t("En ⚙ Configuración del proyecto, marca «Mostrar el archivo de manifiesto», abre appsscript.json y pega el segundo bloque.")}</li>
          <li>{t("Ejecuta la función instalar y acepta los permisos.")}</li>
        </ol>
        <ul className="flex flex-col gap-1 rounded-lg bg-callout px-4 py-3 text-[13px] text-ink-muted">
          <li><b className="font-semibold text-ink">Drive</b> · {t("crear tus carpetas y copiar el material del profe en PDF. No borra nada.")}</li>
          <li><b className="font-semibold text-ink">Gmail ({t("solo lectura")})</b> · {t("leer los avisos de Classroom para encontrar los adjuntos.")}</li>
          <li><b className="font-semibold text-ink">{t("Conectar a un servicio externo")}</b> · {t("hablar con Synaptic.")}</li>
          <li><b className="font-semibold text-ink">{t("Ejecutarse cuando no estás")}</b> · {t("repetirse cada hora.")}</li>
        </ul>
        {script ? (
          <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            {[["script", "Código.gs", script.script], ["manifest", "appsscript.json", script.manifest]].map(([key, label, text]) => (
              <div key={key} className="flex min-w-0 flex-col gap-1.5">
                <span className="flex items-center justify-between text-xs font-medium text-ink-faint">
                  {label}
                  <button type="button" onClick={() => copy(text, key)} className="rounded-md bg-accent-soft px-2 py-0.5 font-semibold text-accent">{copied === key ? t("Copiado ✓") : t("Copiar")}</button>
                </span>
                <textarea readOnly value={text} className="h-56 w-full resize-y rounded-lg bg-[#141417] p-3 font-mono text-[11.5px] leading-relaxed text-[#e4e4e7] outline-none" />
              </div>
            ))}
          </div>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={async () => {
              if (installed && !(await ask.confirm(t("Se generará un script nuevo y el que tienes instalado dejará de funcionar. ¿Seguir?")))) return;
              start(async () => setScript(await makeScript()));
            }}
            className={`${primary} self-start`}
          >
            {installed ? t("Generar un script nuevo") : t("Generar mi script")}
          </button>
        )}
      </section>

      {installed && (
        <>
          {/* 2 · Settings */}
          <section className={`${card} flex flex-col gap-4`}>
            <h2 className="text-[15px] font-semibold">2 · {t("Ajustes")}</h2>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">{t("Cómo firmas tus entregas")}</span>
              <span className="text-xs text-ink-faint">{t("Los archivos con este nombre son tuyos: van a Entrega como tu entrega oficial. Separa con comas.")}</span>
              <input value={names} onChange={(e) => setNames(e.target.value)} placeholder="Nadia, NadiaLV" className="rounded-lg border border-border-subtle bg-transparent px-3 py-2 outline-none focus:border-accent" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">{t("Adjuntos de Classroom que no encuentra")}</span>
              <span className="text-xs text-ink-faint">{t("Pega enlaces de Drive (uno por línea). Se buscan en la próxima sincronización.")}</span>
              <textarea value={pasted} onChange={(e) => setPasted(e.target.value)} rows={3} placeholder="https://drive.google.com/file/d/…" className="rounded-lg border border-border-subtle bg-transparent px-3 py-2 font-mono text-xs outline-none focus:border-accent" />
            </label>
            <label className="flex cursor-pointer items-center gap-3 text-sm">
              <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} className="size-4 accent-[var(--color-accent)]" />
              <span>
                <span className="font-medium">{t("Aplicar lo nuevo sin preguntar")}</span>
                <span className="block text-xs text-ink-faint">{t("Recomendado cuando ya hayas revisado el primer plan.")}</span>
              </span>
            </label>
            <button type="button" disabled={pending} onClick={() => run(() => saveSettings({ studentNames: names, links: pasted, autoApply: auto }))} className={`${btn} self-start`}>
              {t("Guardar ajustes")}
            </button>
          </section>

          {/* 3 · Plan */}
          <section className={`${card} flex flex-col gap-4`}>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="flex-1 text-[15px] font-semibold">3 · {t("Plan: esto es lo que voy a mover y renombrar")}</h2>
              <span className="text-xs text-ink-faint">{t("{0} colocados · {1} en cola", { 0: doneCount, 1: queued.length })}</span>
              {planned.length > 0 && (
                <button type="button" disabled={pending} onClick={() => run(approveAll)} className={primary}>
                  {t("Aplicar {0} cambios", { 0: planned.length })}
                </button>
              )}
            </div>
            {sources.length === 0 && <p className="text-sm text-ink-faint">{t("Todavía no ha llegado nada. Cuando el script se ejecute, aquí verás cada archivo y adónde irá.")}</p>}

            {review.length > 0 && (
              <div className="flex flex-col gap-2">
                <h3 className="text-xs font-semibold tracking-wide text-[#b35c00] uppercase">{t("Revisar ({0})", { 0: review.length })}</h3>
                {review.map((s) => (
                  <div key={s.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-[#fbf3db] px-3 py-2 text-sm">
                    <span className="min-w-0 flex-1 truncate font-medium" title={s.name}>{s.name}</span>
                    <span className="text-xs text-ink-muted">{t(REASON[s.reason ?? "unknown"] ?? REASON.unknown)}</span>
                    {s.reason === "no-subject" && (
                      <Select value={s.subject ?? ""} onChange={(v) => run(() => fixSource(s.id, { subject: v }))} ariaLabel={t("Asignatura")} placeholder={t("Asignatura…")} options={subjects.map((x) => ({ value: x, label: x }))} className="rounded-md bg-white px-2 py-1 text-xs" />
                    )}
                    <input
                      type="number"
                      min={1}
                      max={49}
                      defaultValue={s.unit ?? ""}
                      placeholder="UD"
                      aria-label={t("Unidad")}
                      onBlur={(e) => e.target.value && run(() => fixSource(s.id, { unit: Number(e.target.value) }))}
                      className="w-16 rounded-md border border-border-subtle bg-white px-2 py-1 text-xs outline-none"
                    />
                    <button type="button" onClick={() => run(() => fixSource(s.id, { skip: true }))} className="text-xs text-ink-faint hover:text-ink">{t("Ignorar")}</button>
                  </div>
                ))}
              </div>
            )}

            {[["planned", planned, t("Pendiente de aprobar")], ["approved", queued, t("En cola (la próxima hora)")], ["error", failed, t("Con error")]].map(([key, list, label]) =>
              (list as SourceRow[]).length ? (
                <div key={key as string} className="flex flex-col gap-1">
                  <h3 className="text-xs font-semibold tracking-wide text-ink-faint uppercase">{label as string} ({(list as SourceRow[]).length})</h3>
                  <ul className="flex flex-col">
                    {(list as SourceRow[]).map((s) => (
                      <li key={s.id} className="grid items-center gap-x-3 border-b border-border-subtle py-1.5 text-[13px] last:border-0 md:grid-cols-[minmax(0,1fr)_16px_minmax(0,1.3fr)_auto]">
                        <span className="truncate text-ink-muted" title={s.name}>{s.name}</span>
                        <span className="hidden text-ink-faint md:block" aria-hidden>→</span>
                        <span className="truncate font-medium" title={s.path ?? ""}>
                          {s.kind && <span className="mr-1.5 rounded bg-chip px-1.5 py-0.5 text-[10.5px] font-semibold text-ink-muted">{t(KIND[s.kind] ?? s.kind)}</span>}
                          {s.path}
                          {s.error && <span className="block text-xs font-normal text-red-600">{s.error}</span>}
                        </span>
                        <span className="flex gap-2 text-xs">
                          {key === "error" && <button type="button" onClick={() => run(() => retry(s.id))} className="text-accent hover:underline">{t("Reintentar")}</button>}
                          <button type="button" onClick={() => run(() => fixSource(s.id, { skip: true }))} className="text-ink-faint hover:text-ink">{t("Ignorar")}</button>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null,
            )}
          </section>

          {/* 4 · Log + undo */}
          <section className={`${card} flex flex-col gap-3`}>
            <h2 className="text-[15px] font-semibold">4 · {t("Registro de cambios")}</h2>
            {changes.length === 0 && <p className="text-sm text-ink-faint">{t("Aquí aparecerá cada archivo que el script cree o sustituya, con su «Deshacer».")}</p>}
            {runs.map((runId) => {
              const list = changes.filter((c) => c.runId === runId);
              const open = list.some((c) => !c.undo);
              return (
                <div key={runId} className="flex flex-col gap-1">
                  <div className="flex items-center gap-2 text-xs text-ink-faint">
                    <span className="flex-1 font-semibold">{when(list[0].at)} · {t("{0} cambios", { 0: list.length })}</span>
                    {open && <button type="button" disabled={pending} onClick={() => run(() => undo({ runId }))} className="text-accent hover:underline">{t("Deshacer esta sincronización")}</button>}
                  </div>
                  <ul>
                    {list.map((c) => (
                      <li key={c.id} className="flex items-center gap-2 py-1 text-[13px]">
                        <span className="w-20 shrink-0 text-xs text-ink-faint">{c.action === "replace" ? t("sustituido") : c.action === "trash" ? t("a la papelera") : t("creado")}</span>
                        <a href={`https://drive.google.com/file/d/${c.fileId}`} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate hover:underline">{c.path}</a>
                        {c.undo === "requested" ? (
                          <span className="text-xs text-ink-faint">{t("se deshará la próxima hora")}</span>
                        ) : c.undo === "done" ? (
                          <span className="text-xs text-ink-faint">{t("deshecho")}</span>
                        ) : (
                          <button type="button" disabled={pending} onClick={() => run(() => undo({ changeId: c.id }))} className="text-xs text-ink-faint hover:text-ink">{t("Deshacer")}</button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </section>
        </>
      )}
    </div>
  );
}
