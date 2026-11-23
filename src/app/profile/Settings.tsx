"use client";

import { ask } from "@/app/ui/PopupHost";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useT } from "@/app/LangProvider";
import { LangPicker } from "@/app/LangPicker";
import { ThemePicker } from "@/app/ThemePicker";
import { disconnectGoogle } from "@/app/calendar/actions";
import {
  disconnectClassroomAccount,
  linkSignIn,
  setCodes,
  unlinkSignIn,
} from "./actions";
import { DeleteAccount } from "./DeleteAccount";

type Props = {
  codes: boolean;
  calendar: boolean;
  classroom: boolean;
  // The account it was connected with; null on older connections.
  classroomEmail?: string | null;
  providers: string[];
  theme: "light" | "dark" | "system";
  plan: string | null;
};

// icon: the service's logo or a small symbol; on: a green dot = connected.
const Row = ({
  title,
  hint,
  icon,
  on,
  children,
}: {
  title: string;
  hint?: string;
  icon?: React.ReactNode;
  on?: boolean;
  children: React.ReactNode;
}) => (
  <div className="flex items-center gap-3.5 border-b border-border-subtle py-3.5 last:border-b-0">
    {icon && <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-chip text-ink-muted">{icon}</span>}
    <span className="flex min-w-0 flex-1 flex-col">
      <span className="font-medium">{title}</span>
      {hint && (
        <span className="flex items-center gap-1.5 truncate text-[13px] text-ink-faint">
          {on !== undefined && <span className={`size-1.5 shrink-0 rounded-full ${on ? "bg-[#4dab6f]" : "bg-ink-faint/50"}`} />}
          {hint}
        </span>
      )}
    </span>
    {children}
  </div>
);

const svg = (d: string, size = 16) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {d.split("|").map((x) => (
      <path key={x} d={x} />
    ))}
  </svg>
);
const I = {
  lang: svg("M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z|M3 12h18|M12 3c2.5 2.6 3.7 5.6 3.7 9s-1.2 6.4-3.7 9c-2.5-2.6-3.7-5.6-3.7-9S9.5 5.6 12 3z"),
  theme: svg("M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9z"),
  code: svg("M8 7l-5 5 5 5|M16 7l5 5-5 5"),
  calendar: svg("M4 6h16v14H4z|M4 10h16|M9 3v4|M15 3v4"),
  classroom: svg("M3 5h18v12H3z|M8 21h8|M9 13a3 3 0 0 1 6 0"),
  google: (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M23 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.2a5.3 5.3 0 0 1-2.3 3.5v2.9h3.7c2.2-2 3.4-5 3.4-8.5z" />
      <path fill="#34A853" d="M12 23.5c3.1 0 5.7-1 7.6-2.8l-3.7-2.9c-1 .7-2.4 1.1-3.9 1.1-3 0-5.5-2-6.4-4.7H1.8v3A11.5 11.5 0 0 0 12 23.5z" />
      <path fill="#FBBC05" d="M5.6 14.2a6.9 6.9 0 0 1 0-4.4v-3H1.8a11.5 11.5 0 0 0 0 10.4l3.8-3z" />
      <path fill="#EA4335" d="M12 5.1c1.7 0 3.2.6 4.4 1.7l3.3-3.3A11.5 11.5 0 0 0 1.8 6.8l3.8 3c.9-2.7 3.4-4.7 6.4-4.7z" />
    </svg>
  ),
  github: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 .5a11.5 11.5 0 0 0-3.6 22.4c.6.1.8-.3.8-.6v-2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.7 1.3 3.4 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.2 1.2a11 11 0 0 1 5.8 0c2.2-1.5 3.2-1.2 3.2-1.2.6 1.6.2 2.8.1 3.1.8.8 1.2 1.9 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A11.5 11.5 0 0 0 12 .5z" />
    </svg>
  ),
  plan: svg("M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.5 6.7 19.4l1.2-6L3.4 9.3l6-.7z"),
  refresh: svg("M20 11a8 8 0 0 0-14.6-4.5L4 8|M4 4v4h4|M4 13a8 8 0 0 0 14.6 4.5L20 16|M20 20v-4h-4", 15),
  unlink: svg("M9 15l-2 2a3.5 3.5 0 0 1-5-5l3-3|M15 9l2-2a3.5 3.5 0 0 1 5 5l-3 3|M8 4v2|M4 8h2|M16 20v-2|M20 16h-2", 15),
  plus: svg("M12 5v14|M5 12h14", 14),
};

// Ajustes: language, coding tools, linked accounts, plan and deleting the account.
export function Settings({
  codes,
  calendar,
  classroom,
  classroomEmail,
  providers,
  plan,
  theme,
}: Props) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<unknown>) =>
    start(async () => {
      await fn();
      router.refresh();
    });
  // Icon buttons for what you do to a connection; a dark pill to connect.
  const iconBtn = (danger = false) =>
    `grid size-8 place-items-center rounded-lg text-ink-muted transition-all hover:-translate-y-px hover:bg-chip active:translate-y-0 disabled:opacity-50 ${danger ? "hover:text-[#e5484d]" : "hover:text-ink"}`;
  const connect = "flex items-center gap-1.5 rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-white transition-transform hover:-translate-y-px active:translate-y-0 disabled:opacity-50";
  const button = "rounded-full border border-border-subtle px-3 py-1.5 text-xs font-medium transition-colors hover:bg-chip disabled:opacity-50";
  return (
    <div className="flex max-w-2xl flex-col">
      <Row icon={I.lang} title={t("Idioma")} hint={t("La app y lo que escribe la IA")}>
        <LangPicker />
      </Row>
      <Row
        icon={I.theme}
        title={t("Apariencia")}
        hint={t("Claro, oscuro o como tu dispositivo")}
      >
        <ThemePicker initial={theme} />
      </Row>
      <Row icon={I.code} title={t("Programo")} hint={t("Muestra Retos de código en el menú")}>
        <button
          type="button"
          role="switch"
          aria-checked={codes}
          aria-label={t("Programo")}
          disabled={pending}
          onClick={() => run(() => setCodes(!codes))}
          className={`relative h-6 w-11 rounded-full transition-colors ${codes ? "bg-ink" : "bg-[#d3d1cb]"}`}
        >
          <span
            className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-[left] ${codes ? "left-[22px]" : "left-0.5"}`}
          />
        </button>
      </Row>
      <Row
        icon={I.calendar}
        on={calendar}
        title="Google Calendar"
        hint={
          calendar
            ? t("Conectado")
            : t("Trae tus eventos y envía exámenes y entregas")
        }
      >
        {calendar ? (
          <button
            type="button"
            disabled={pending}
            onClick={async () =>
              (await ask.confirm(t("¿Desconectar Google Calendar?"), {
                danger: true,
              })) && run(disconnectGoogle)
            }
            className={iconBtn(true)}
            title={t("Desconectar")}
            aria-label={t("Desconectar")}
          >
            {I.unlink}
          </button>
        ) : (
          <a href="/api/google-calendar/connect" className={connect}>
            {I.plus}
            {t("Conectar")}
          </a>
        )}
      </Row>
      <Row
        icon={I.classroom}
        on={classroom}
        title="Google Classroom"
        hint={
          classroom
            ? (classroomEmail ??
              t("Reconecta para abrir las entregas con la cuenta correcta"))
            : t("Trae tus cursos, unidades y entregas")
        }
      >
        {classroom ? (
          <span className="flex gap-0.5">
            <a
              href="/api/classroom/connect?pursuitId=profile"
              className={iconBtn()}
              title={t("Reconectar")}
              aria-label={t("Reconectar")}
            >
              {I.refresh}
            </a>
            <button
              type="button"
              disabled={pending}
              onClick={async () =>
                (await ask.confirm(t("¿Desconectar Google Classroom?"), {
                  danger: true,
                })) && run(disconnectClassroomAccount)
              }
              className={iconBtn(true)}
              title={t("Desconectar")}
              aria-label={t("Desconectar")}
            >
              {I.unlink}
            </button>
          </span>
        ) : (
          <a href="/api/classroom/connect?pursuitId=profile" className={connect}>
            {I.plus}
            {t("Conectar")}
          </a>
        )}
      </Row>
      {/* Ways to sign in: add another, or remove one while another is left. */}
      {(["google", "github"] as const).map((p) => {
        const on = providers.includes(p);
        const name = p === "google" ? "Google" : "GitHub";
        return (
          <Row
            key={p}
            icon={p === "google" ? I.google : I.github}
            on={on}
            title={t("Iniciar sesión con {0}", { 0: name })}
            hint={on ? t("Vinculado") : t("No vinculado")}
          >
            {on ? (
              providers.length > 1 && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={async () =>
                    (await ask.confirm(
                      t("¿Quitar {0} como forma de entrar?", { 0: name }),
                      { danger: true },
                    )) && run(() => unlinkSignIn(p))
                  }
                  className={iconBtn(true)}
                  title={t("Quitar")}
                  aria-label={t("Quitar")}
                >
                  {I.unlink}
                </button>
              )
            ) : (
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => linkSignIn(p))}
                className={connect}
              >
                {I.plus}
                {t("Vincular")}
              </button>
            )}
          </Row>
        );
      })}
      {plan && (
        <Row icon={I.plan} title={t("Plan")} hint={plan}>
          <Link href="/billing" className={button}>
            {t("Plan y facturación")}
          </Link>
        </Row>
      )}
      <DeleteAccount />
    </div>
  );
}
