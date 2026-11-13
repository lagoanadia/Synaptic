"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useT } from "@/app/LangProvider";
import { LangPicker } from "@/app/LangPicker";
import { ThemePicker } from "@/app/ThemePicker";
import { disconnectGoogle } from "@/app/calendar/actions";
import { disconnectClassroomAccount, linkSignIn, setCodes, unlinkSignIn } from "./actions";
import { DeleteAccount } from "./DeleteAccount";

type Props = {
  codes: boolean;
  calendar: boolean;
  classroom: boolean;
  providers: string[];
  theme: "light" | "dark" | "system";
  plan: string | null;
};

const Row = ({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) => (
  <div className="flex items-center gap-4 border-b border-border-subtle py-4 last:border-b-0">
    <span className="flex min-w-0 flex-1 flex-col">
      <span className="font-medium">{title}</span>
      {hint && <span className="text-sm text-ink-faint">{hint}</span>}
    </span>
    {children}
  </div>
);

// Ajustes: language, coding tools, linked accounts, plan and deleting the account.
export function Settings({ codes, calendar, classroom, providers, plan, theme }: Props) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<unknown>) => start(async () => { await fn(); router.refresh(); });
  const button = "rounded-md border border-border-subtle px-3 py-1.5 text-sm hover:bg-chip disabled:opacity-50";
  return (
    <div className="flex max-w-2xl flex-col">
      <Row title={t("Idioma")} hint={t("La app y lo que escribe la IA")}>
        <LangPicker />
      </Row>
      <Row title={t("Apariencia")} hint={t("Claro, oscuro o como tu dispositivo")}>
        <ThemePicker initial={theme} />
      </Row>
      <Row title={t("Programo")} hint={t("Muestra Retos de código en el menú")}>
        <button
          type="button"
          role="switch"
          aria-checked={codes}
          aria-label={t("Programo")}
          disabled={pending}
          onClick={() => run(() => setCodes(!codes))}
          className={`relative h-6 w-11 rounded-full transition-colors ${codes ? "bg-ink" : "bg-[#d3d1cb]"}`}
        >
          <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-[left] ${codes ? "left-[22px]" : "left-0.5"}`} />
        </button>
      </Row>
      <Row title="Google Calendar" hint={calendar ? t("Conectado") : t("Trae tus eventos y envía exámenes y entregas")}>
        {calendar ? (
          <button type="button" disabled={pending} onClick={() => confirm(t("¿Desconectar Google Calendar?")) && run(disconnectGoogle)} className={button}>
            {t("Desconectar")}
          </button>
        ) : (
          <a href="/api/google-calendar/connect" className={button}>
            {t("Conectar")}
          </a>
        )}
      </Row>
      <Row title="Google Classroom" hint={classroom ? t("Conectado") : t("Trae tus cursos, unidades y entregas")}>
        {classroom ? (
          <button type="button" disabled={pending} onClick={() => confirm(t("¿Desconectar Google Classroom?")) && run(disconnectClassroomAccount)} className={button}>
            {t("Desconectar")}
          </button>
        ) : (
          <a href="/api/classroom/connect?pursuitId=profile" className={button}>
            {t("Conectar")}
          </a>
        )}
      </Row>
      {/* Ways to sign in: add another, or remove one while another is left. */}
      {(["google", "github"] as const).map((p) => {
        const on = providers.includes(p);
        const name = p === "google" ? "Google" : "GitHub";
        return (
          <Row key={p} title={t("Iniciar sesión con {0}", { 0: name })} hint={on ? t("Vinculado") : t("No vinculado")}>
            {on ? (
              providers.length > 1 && (
                <button type="button" disabled={pending} onClick={() => confirm(t("¿Quitar {0} como forma de entrar?", { 0: name })) && run(() => unlinkSignIn(p))} className={button}>
                  {t("Quitar")}
                </button>
              )
            ) : (
              <button type="button" disabled={pending} onClick={() => run(() => linkSignIn(p))} className={button}>
                {t("Vincular")}
              </button>
            )}
          </Row>
        );
      })}
      {plan && (
        <Row title={t("Plan")} hint={plan}>
          <Link href="/billing" className={button}>
            {t("Plan y facturación")}
          </Link>
        </Row>
      )}
      <DeleteAccount />
    </div>
  );
}
