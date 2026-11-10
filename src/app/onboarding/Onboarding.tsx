"use client";

import { useT } from "@/app/LangProvider";
import { LogoMark } from "@/app/Logo";
import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckIcon } from "@/app/icons";
import { Folder, MiniNotebook, Notebook } from "@/app/Covers";
import { NOTEBOOK_COVERS, folderCover, type NotebookCover } from "@/lib/covers";
import { ROLES, looksLikeProgramming, notebooksFor, type Role } from "@/lib/onboardingPlan";
import { classroomCourses, finishOnboarding, skipOnboarding } from "./actions";
import { setUsername } from "@/app/profile/actions";
import { UsernameField, type HandleStatus } from "@/app/profile/UsernameField";

const ICON: Record<Role, string> = {
  fp: "M3 9l9-5 9 5-9 5zM7 11v5c3 2 7 2 10 0v-5",
  uni: "M3 10h18M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18M12 3l9 5H3z",
  bach: "M4 5h7a2 2 0 0 1 2 2v13a2 2 0 0 0-2-2H4zM20 5h-5a2 2 0 0 0-2 2v13a2 2 0 0 1 2-2h5z",
  work: "M3 7h18v13H3zM9 7V5h6v2M3 13h18",
  projects: "M12 3l1.8 4.6L18.5 9l-4.7 1.4L12 15l-1.8-4.6L5.5 9l4.7-1.4zM5 19h14",
  personal: "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z",
};
const DEFAULT_COVERS: NotebookCover[] = ["zebra", "croc", "leopard", "green"];
const SWATCHES: NotebookCover[] = ["zebra", "croc", "leopard", "green", "marble", "fawn", "ruby", "tartan", "blossom"];
const KEY = "synaptic.welcome";

type State = { roles: Role[]; picked: { title: string; classroomCourseId: string | null }[]; typed: string; topic: string; subject: string; covers: Record<string, NotebookCover> };
const START: State = { roles: ["fp", "personal"], picked: [], typed: "", topic: "", subject: "", covers: {} };

const splitList = (s: string) => s.split(/[,\n]/).map((x) => x.trim()).filter(Boolean);

// Four quick steps on the very first visit: what you do, your subjects
// (Classroom first), this week's topic, your covers. Every step can be
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
      if (saved) setS({ ...START, ...saved });
    } catch {}
    setStep(1);
  }, [params]);

  const notebooks = notebooksFor(s.roles);
  const home = notebooks.find((n) => n.study) ?? notebooks[0];
  const coverOf = (n: string, i: number) => s.covers[n] ?? DEFAULT_COVERS[i % DEFAULT_COVERS.length];
  const subjects = [...s.picked.map((p) => p.title), ...splitList(s.typed)];

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
          subjects: [...s.picked, ...splitList(s.typed).map((title) => ({ title, classroomCourseId: null }))],
          learning: { topic: s.topic, subject: s.subject || subjects[0] || null },
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
    <button type="button" onClick={onClick} className="rounded-xl bg-ink px-8 py-3.5 text-sm font-semibold text-white">
      {t(label)} →
    </button>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-[#f8f4ea]"
      style={{ backgroundImage: "radial-gradient(rgba(55,53,47,.12) 1px, transparent 1.3px)", backgroundSize: "22px 22px" }}
    >
      <header className="flex items-center justify-between px-5 py-5 sm:px-10">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <LogoMark size={20} />
          <span className="hidden sm:inline">{t("Synaptic")}</span>
        </span>
        <span className="flex gap-1.5" aria-hidden>
          {[0, 1, 2, 3].map((i) => (
            <i key={i} className={`h-1 w-7 rounded-full ${i < step || building ? "bg-ink" : i === step ? "bg-ink/50" : "bg-ink/15"}`} />
          ))}
        </span>
        <button type="button" onClick={() => start(async () => { await skipOnboarding(); router.refresh(); })} className="text-sm text-ink-faint hover:text-ink">
          {t("Saltar")}
        </button>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center gap-8 px-5 pb-10">
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
            <div className="grid w-full max-w-[580px] grid-cols-2 gap-3 sm:grid-cols-3">
              {ROLES.map((r) => {
                const on = s.roles.includes(r.key);
                return (
                  <button
                    key={r.key}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setS({ ...s, roles: on ? s.roles.filter((x) => x !== r.key) : [...s.roles, r.key] })}
                    className={`${card} relative flex flex-col items-center gap-3 py-7 font-semibold ${on ? "border-ink ring-1 ring-ink" : "border-[#ebe7dd] hover:border-[#d3d1cb]"}`}
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
                  <Notebook cover={coverOf(n.name, i)} name={n.name} width={70} />
                  <span>
                    {n.name}
                    {n.study && <span className="ml-1 text-xs text-accent" title={t("Herramientas de estudio")}>▤</span>}
                  </span>
                </span>
              ))}
            </div>
            {handleStatus === "taken" || handleStatus === "invalid" || handleStatus === "checking" ? (
              <button type="button" disabled className="rounded-xl bg-ink px-8 py-3.5 text-sm font-semibold text-white opacity-40">
                {t("Siguiente")} →
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
              <label className="flex items-center gap-3">
                {home.study && <span className="shrink-0 text-sm text-ink-faint">{t("o escríbelas")}</span>}
                <input
                  value={s.typed}
                  onChange={(e) => setS({ ...s, typed: e.target.value })}
                  placeholder={home.study ? t("Bases de datos, Sistemas…") : t("Portfolio, una web…")}
                  aria-label={t("Separadas por comas")}
                  className="min-w-0 flex-1 rounded-xl border border-[#ebe7dd] bg-white px-4 py-2.5 text-sm"
                />
              </label>
            </div>
            {next()}
          </>
        ) : step === 2 ? (
          <>
            <h1 className="text-center text-[2rem] leading-tight font-bold tracking-tight sm:text-[2.4rem]">{t("¿Qué estás aprendiendo esta semana?")}</h1>
            <div className="flex w-full max-w-[620px] items-center gap-2 rounded-xl border border-[#ebe7dd] bg-white py-2 pr-2 pl-5 shadow-[0_6px_20px_rgba(55,53,47,.06)]">
              <input
                autoFocus
                value={s.topic}
                onChange={(e) => setS({ ...s, topic: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && setStep(3)}
                placeholder={t("Joins en SQL")}
                aria-label={t("Tema")}
                className="min-w-0 flex-1 bg-transparent py-1.5 text-lg outline-none"
              />
              {subjects.length > 0 && (
                <select value={s.subject || subjects[0]} onChange={(e) => setS({ ...s, subject: e.target.value })} aria-label={t("Asignatura")} className="max-w-[45%] rounded-md bg-chip px-2 py-1.5 text-sm">
                  {subjects.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              )}
            </div>
            {/* What it will make: a page, then cards from it. */}
            <div className={`flex gap-3 transition-opacity ${s.topic.trim() ? "opacity-100" : "opacity-30"}`} aria-label={t("Se creará una página y tarjetas")}>
              <span className="grid size-14 place-items-center rounded-xl border border-[#ebe7dd] bg-white text-ink-muted" title={t("Una página")}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden>
                  <path d="M6 3h8l4 4v14H6z" />
                  <path d="M14 3v4h4M9 12h6M9 16h6" />
                </svg>
              </span>
              <span className="grid size-14 place-items-center rounded-xl border border-[#ebe7dd] bg-white text-ink-muted" title={t("Tarjetas")}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden>
                  <rect x="4" y="7" width="13" height="13" rx="2" />
                  <path d="M8 4h10a2 2 0 0 1 2 2v10" />
                </svg>
              </span>
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
