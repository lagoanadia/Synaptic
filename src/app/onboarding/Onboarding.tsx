"use client";

import { useT } from "@/app/LangProvider";
import { LogoMark } from "@/app/Logo";
import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckIcon } from "@/app/icons";
import { Folder, MiniNotebook, Notebook } from "@/app/Covers";
import { NOTEBOOK_COVERS, folderCover, type NotebookCover } from "@/lib/covers";
import { ROLES, looksLikeProgramming, notebooksFor, type Role } from "@/lib/onboardingPlan";
import { classroomCourses, finishOnboarding } from "./actions";
import { setUsername } from "@/app/profile/actions";
import { UsernameField, type HandleStatus } from "@/app/profile/UsernameField";

const ICON: Record<Role, string> = {
  study: "M3 9l9-5 9 5-9 5zM7 11v5c3 2 7 2 10 0v-5",
  projects: "M12 3l1.8 4.6L18.5 9l-4.7 1.4L12 15l-1.8-4.6L5.5 9l4.7-1.4zM5 19h14",
  personal: "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z",
};
const DEFAULT_COVERS: NotebookCover[] = ["zebra", "croc", "leopard", "green"];
const SWATCHES: NotebookCover[] = ["zebra", "croc", "leopard", "green", "marble", "fawn", "ruby", "tartan", "blossom"];
const KEY = "synaptic.welcome";

type State = { roles: Role[]; picked: { title: string; classroomCourseId: string | null }[]; typed: string[]; covers: Record<string, NotebookCover> };
const START: State = { roles: ["study", "personal"], picked: [], typed: [""], covers: {} };

const filled = (rows: string[]) => rows.map((x) => x.trim()).filter(Boolean);

// Three quick steps on the very first visit: what you do, your subjects
// (Classroom first), your covers. Every step can be
// skipped; the answers become your notebooks, folders and a first page.
export function Onboarding({ name, username, suggested }: { name: string | null; username: string | null; suggested: string }) {
  const t = useT();
  const router = useRouter();
  const params = useSearchParams();
  const [step, setStep] = useState(0);
  const [s, setS] = useState<State>(START);
  const [classroom, setClassroom] = useState<{ connected: boolean; courses: { id: string; name: string }[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [building, setBuilding] = useState(false);
  const [handle, setHandle] = useState(suggested);
  const [handleStatus, setHandleStatus] = useState<HandleStatus>("idle");
  const [handleError, setHandleError] = useState<string | null>(null);
  const [, start] = useTransition();

  // Back from connecting Classroom: pick up where you were (browser storage).
  useEffect(() => {
    if (params.get("welcome") !== "classroom") return;
    try {
      const saved = JSON.parse(window.sessionStorage.getItem(KEY) ?? "null");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setS({ ...START, ...saved, typed: Array.isArray(saved.typed) ? saved.typed : [""] });
    } catch {}
    setStep(1);
  }, [params]);

  const notebooks = notebooksFor(s.roles, t);
  const home = notebooks.find((n) => n.study) ?? notebooks[0];
  const subjects = [...s.picked.map((p) => p.title), ...filled(s.typed)];
  const coverOf = (n: string, i: number) => s.covers[n] ?? DEFAULT_COVERS[i % DEFAULT_COVERS.length];
  
  // Step 2 asks for your Classroom courses once.
  useEffect(() => {
    if (step !== 1 || classroom || !home.study) return;
    classroomCourses().then((c) => {
      setClassroom(c);
      if (c.connected && s.picked.length === 0) setS((cur) => ({ ...cur, picked: c.courses.map((x) => ({ title: x.name, classroomCourseId: x.id })) }));
    });
  }, [step, classroom, home.study, s.picked.length]);

  // Remember the answers so far; Google brings you back to step 2.
  function rememberForClassroom() {
    try {
      window.sessionStorage.setItem(KEY, JSON.stringify(s));
    } catch {}
  }

  function finish() {
    setBuilding(true);
    setError(null);
    start(async () => {
      // Your @usuario first: if it's gone since, back to step 1 to pick another.
      if (handle && handle !== username) {
        const u = await setUsername(handle);
        if (u.error) {
          setBuilding(false);
          setHandleError(u.error);
          return setStep(0);
        }
      }
      const [r] = await Promise.all([
        finishOnboarding({
          roles: s.roles,
          subjects: [...s.picked, ...filled(s.typed).map((title) => ({ title, classroomCourseId: null }))],
          learning: { topic: "", subject: null },
          covers: Object.fromEntries(notebooks.map((n, i) => [n.name, coverOf(n.name, i)])),
        }),
        new Promise((ok) => setTimeout(ok, 1600)),
      ]);
      if (r.error) {
        setBuilding(false);
        return setError(r.error);
      }
      try {
        window.sessionStorage.removeItem(KEY);
      } catch {}
      router.replace("/pursuits");
      router.refresh();
    });
  }

  const card = "rounded-xl border bg-white transition-colors";
  const next = (label = t("Siguiente"), onClick = () => setStep(step + 1)) => (
    <button type="button" onClick={onClick} aria-label={t(label)} title={t(label)} className="rounded-xl bg-ink px-8 py-3 text-lg font-semibold text-white">
      →
    </button>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-[#f8f4ea]"
      style={{ backgroundImage: "radial-gradient(rgba(55,53,47,.12) 1px, transparent 1.3px)", backgroundSize: "22px 22px" }}
    >
      <header className="flex items-center justify-between px-5 py-4 sm:px-10">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <LogoMark size={20} />
          <span className="hidden sm:inline">{t("Synaptic")}</span>
        </span>
        <span className="flex gap-1.5" aria-hidden>
          {[0, 1, 2].map((i) => (
            <i key={i} className={`h-1 w-7 rounded-full ${i < step || building ? "bg-ink" : i === step ? "bg-ink/50" : "bg-ink/15"}`} />
          ))}
        </span>
        <span className="w-[72px]" aria-hidden />
      </header>

      <main className="flex flex-1 flex-col items-center justify-center gap-6 px-5 pb-6">
        {building ? (
          <div className="flex flex-col items-center gap-7">
            <div className="flex items-end gap-4">
              {notebooks.slice(0, 3).map((n, i) => (
                <span key={n.name} style={{ transform: `translateY(${[0, -10, 0][i]}px) rotate(${[-4, 0, 4][i]}deg)` }}>
                  <Notebook cover={coverOf(n.name, i)} name={n.name} width={104} />
                </span>
              ))}
            </div>
            <div className="flex gap-4">
              {subjects.slice(0, 4).map((t) => (
                <Folder key={t} cover={folderCover(t)} width={72} />
              ))}
            </div>
            <span className="size-6 animate-spin rounded-full border-2 border-ink/15 border-t-ink/60" />
            <span className="text-sm text-ink-faint">{t("Preparando tu espacio…")}</span>
          </div>
        ) : step === 0 ? (
          <>
            <h1 className="text-center text-[2rem] leading-tight font-bold tracking-tight sm:text-[2.4rem]">{name ? t("Hola, {0}. ¿Qué haces?", { 0: name.split(" ")[0] }) : t("¿Qué haces?")}</h1>
            <div className="-mt-3 flex flex-col items-center gap-1.5">
              <span className="text-sm text-ink-muted">{t("Tu @usuario")}</span>
              <UsernameField
                big
                value={handle}
                saved={username}
                error={handleError}
                onStatus={setHandleStatus}
                onChange={(v) => {
                  setHandle(v);
                  setHandleError(null);
                }}
              />
            </div>
            <div className="grid w-full max-w-[520px] grid-cols-3 gap-3">
              {ROLES.map((r) => {
                const on = s.roles.includes(r.key);
                return (
                  <button
                    key={r.key}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setS({ ...s, roles: on ? s.roles.filter((x) => x !== r.key) : [...s.roles, r.key] })}
                    className={`${card} relative flex flex-col items-center gap-2 py-5 font-semibold ${on ? "border-ink ring-1 ring-ink" : "border-[#ebe7dd] hover:border-[#d3d1cb]"}`}
                  >
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" aria-hidden>
                      <path d={ICON[r.key]} />
                    </svg>
                    {t(r.label)}
                    {on && (
                      <span className="absolute top-2.5 right-2.5 grid size-5 place-items-center rounded-full bg-ink text-white">
                        <CheckIcon size={12} className="block" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-5">
              <span className="hidden text-sm text-ink-faint sm:inline">{t("Tu espacio")}</span>
              {notebooks.map((n, i) => (
                <span key={n.name} className="flex flex-col items-center gap-1.5 text-sm font-medium">
                  <Notebook cover={coverOf(n.name, i)} name={n.name} width={52} />
                  <span>{n.name}</span>
                </span>
              ))}
            </div>
            {handleStatus === "taken" || handleStatus === "invalid" || handleStatus === "checking" ? (
              <button type="button" disabled aria-label={t("Siguiente")} className="rounded-xl bg-ink px-8 py-3 text-lg font-semibold text-white opacity-40">
                →
              </button>
            ) : (
              next()
            )}
          </>
        ) : step === 1 ? (
          <>
            <h1 className="text-[2rem] leading-tight font-bold tracking-tight sm:text-[2.4rem]">{home.study ? t("Tus asignaturas") : t("¿Qué hay en {0}?", { 0: home.name })}</h1>
            <div className="flex w-full max-w-[520px] flex-col gap-3">
              {home.study && (
                <div className={`${card} flex items-center gap-4 px-5 py-4 ${classroom?.connected ? "border-[#1e8e3e] ring-1 ring-[#1e8e3e]" : "border-[#ebe7dd]"}`}>
                  <svg width="30" height="30" viewBox="0 0 24 24" aria-hidden>
                    <rect x="2" y="4" width="20" height="16" rx="2" fill="#1e8e3e" />
                    <circle cx="12" cy="11" r="2.6" fill="#fff" />
                    <path d="M7.5 17c.8-2 2.6-3 4.5-3s3.7 1 4.5 3" fill="#fff" />
                  </svg>
                  <span className="flex flex-1 flex-col">
                    <b className="text-[15px]">{t("Google Classroom")}</b>
                    <span className="text-xs text-ink-faint">{t("Cursos, unidades y entregas")}</span>
                  </span>
                  {classroom?.connected ? (
                    <span className="grid size-7 place-items-center rounded-full bg-[#1e8e3e] text-white">
                      <CheckIcon size={15} className="block" />
                    </span>
                  ) : (
                    <a href="/api/classroom/connect?pursuitId=onboarding" onClick={rememberForClassroom} className="rounded-lg bg-ink px-3 py-1.5 text-sm text-white">
                      {t("Conectar")}
                    </a>
                  )}
                </div>
              )}
              {classroom?.connected && classroom.courses.length > 0 && (
                <div className={`${card} border-[#ebe7dd] px-4 py-1`}>
                  {classroom.courses.map((c) => {
                    const on = s.picked.some((p) => p.classroomCourseId === c.id);
                    return (
                      <label key={c.id} className="flex cursor-pointer items-center gap-3 border-b border-[#f1efe9] py-2.5 last:border-b-0">
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => setS({ ...s, picked: on ? s.picked.filter((p) => p.classroomCourseId !== c.id) : [...s.picked, { title: c.name, classroomCourseId: c.id }] })}
                          className="size-4 accent-ink"
                        />
                        <Folder cover={folderCover(c.name)} width={36} />
                        <b className="min-w-0 flex-1 truncate text-sm">{c.name}</b>
                        {looksLikeProgramming(c.name) && <span className="rounded bg-chip px-1.5 py-0.5 font-mono text-[11px] text-ink-muted">{t("</> Retos")}</span>}
                      </label>
                    );
                  })}
                </div>
              )}
              {/* Your subjects as a list: type one, a new empty row appears below. */}
              <div className={`${card} flex flex-col border-[#ebe7dd] px-4 py-1`}>
                {s.typed.map((v, i) => (
                  <div key={i} className="flex items-center gap-3 border-b border-[#f1efe9] py-1.5 last:border-b-0">
                    <span className="w-5 shrink-0 text-right text-sm text-ink-faint">{i + 1}.</span>
                    <input
                      id={`subject-${i}`}
                      value={v}
                      onChange={(e) => {
                        const rows = s.typed.map((x, j) => (j === i ? e.target.value : x));
                        if (rows[rows.length - 1].trim()) rows.push("");
                        setS({ ...s, typed: rows });
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") document.getElementById(`subject-${i + 1}`)?.focus();
                      }}
                      placeholder={i === 0 ? (home.study ? t("Bases de datos") : t("Portfolio")) : t("Añadir otra")}
                      aria-label={home.study ? t("Asignatura") : t("Proyecto")}
                      className="min-w-0 flex-1 bg-transparent py-1 text-sm outline-none"
                    />
                    {i < s.typed.length - 1 && (
                      <button type="button" onClick={() => setS({ ...s, typed: s.typed.filter((_, j) => j !== i) })} aria-label={t("Quitar")} className="px-1 text-ink-faint hover:text-ink">
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
            {next()}
          </>
        ) : (
          <>
            <h1 className="text-[2rem] leading-tight font-bold tracking-tight sm:text-[2.4rem]">{t("Elige tus tapas")}</h1>
            <div className="flex flex-wrap justify-center gap-10">
              {notebooks.map((n, i) => (
                <div key={n.name} className="flex flex-col items-center gap-4">
                  <Notebook cover={coverOf(n.name, i)} name={n.name} width={130} />
                  <div className="flex max-w-[190px] flex-wrap items-center justify-center gap-1.5">
                    {SWATCHES.map((c) => (
                      <button
                        key={c}
                        type="button"
                        title={c}
                        onClick={() => setS({ ...s, covers: { ...s.covers, [n.name]: c } })}
                        className={`rounded-sm ${coverOf(n.name, i) === c ? "ring-2 ring-ink ring-offset-2 ring-offset-[#f8f4ea]" : ""}`}
                      >
                        <MiniNotebook cover={c} size={26} />
                      </button>
                    ))}
                    <button
                      type="button"
                      title={t("Al azar")}
                      aria-label={t("Al azar")}
                      onClick={() => setS({ ...s, covers: { ...s.covers, [n.name]: NOTEBOOK_COVERS[Math.floor(Math.random() * NOTEBOOK_COVERS.length)] } })}
                      className="px-1 text-ink-faint hover:text-ink"
                    >
                      ⤮
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            {next(t("Crear mi espacio"), finish)}
          </>
        )}
      </main>
    </div>
  );
}
