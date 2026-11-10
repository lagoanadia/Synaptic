import { LOCALE } from "@/lib/i18n";
import { getLang, getT } from "@/lib/i18n/server";
import { ArrowLeft } from "@/app/icons";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BILLING } from "@/lib/billingFlag";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createCheckoutSession, createPortalSession } from "./actions";

const PLAN_COPY = {
  FREE: { label: "Gratis", price: "$0" },
  PRO: { label: "Student Pro", price: "$6/mo" },
  TEAM: { label: "Team", price: "$10/mo" },
} as const;

const ERROR_COPY: Record<string, string> = {
  "not-configured": "Los pagos aún no están configurados.",
  "checkout-failed": "No se ha podido iniciar el pago. Inténtalo en unos minutos.",
  "no-billing-account": "Aún no tienes cuenta de facturación — suscríbete a un plan primero.",
  "portal-failed": "No se ha podido abrir la facturación. Inténtalo en unos minutos.",
};

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; canceled?: string; error?: string }>;
}) {
  const locale = LOCALE[await getLang()];
  const t = await getT();
  if (!BILLING) notFound();
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/");
  }
  const { success, canceled, error } = await searchParams;

  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.user.id } });
  const current = PLAN_COPY[user.plan];

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t("Facturación")}</h1>
        <Link href="/pursuits" className="text-sm text-ink-muted hover:underline">
          <ArrowLeft />{" "}{t("Volver")}
        </Link>
      </div>

      {success && (
        <p className="rounded-xl bg-forest-soft px-4 py-3 text-sm text-ink">
          {t("Pago recibido — puede tardar unos segundos en aparecer abajo si tu plan sigue diciendo Gratis.")}
        </p>
      )}
      {canceled && (
        <p className="rounded-xl bg-chip px-4 py-3 text-sm text-ink-muted">
          {t("Pago cancelado — no se te ha cobrado.")}
        </p>
      )}
      {error && (
        <p className="rounded-xl bg-crimson-soft px-4 py-3 text-sm text-ink">
          {(ERROR_COPY[error] && t(ERROR_COPY[error])) ?? t("Algo ha fallado. Inténtalo en unos minutos.")}
        </p>
      )}

      <div className="flex flex-col gap-2 rounded-2xl border border-border-subtle bg-white p-6">
        <span className="text-xs font-medium text-ink-muted">{t("Plan actual")}</span>
        <span className="text-xl font-semibold">
          {t(current.label)} <span className="text-ink-muted">· {current.price}</span>
        </span>
        {user.plan !== "FREE" && user.stripeCurrentPeriodEnd && (
          <span className="text-xs text-ink-faint">
            {t("Se renueva el")}{" "}{user.stripeCurrentPeriodEnd.toLocaleDateString(locale, { timeZone: "UTC" })}
          </span>
        )}
        {user.stripeCustomerId && (
          <form action={createPortalSession} className="mt-2">
            <button
              type="submit"
              className="rounded-full border border-border-subtle px-4 py-2 text-sm font-medium hover:bg-chip"
            >
              {t("Gestionar facturación")}
            </button>
          </form>
        )}
      </div>

      {user.plan !== "PRO" && (
        <div className="flex items-center justify-between rounded-2xl border border-border-subtle bg-white p-6">
          <div>
            <p className="font-semibold">{t("Student Pro — 6 $/mes")}</p>
            <p className="text-sm text-ink-muted">
              {t("Tarjetas ilimitadas, preguntas a la IA ilimitadas y compartir sin límite.")}
            </p>
          </div>
          <form action={createCheckoutSession.bind(null, "PRO")}>
            <button
              type="submit"
              className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
            >
              {t("Hazte Pro")}
            </button>
          </form>
        </div>
      )}

      {user.plan !== "TEAM" && (
        <div className="flex items-center justify-between rounded-2xl border border-border-subtle bg-white p-6">
          <div>
            <p className="font-semibold">{t("Team — 10 $/mes")}</p>
            <p className="text-sm text-ink-muted">{t("Todo lo de Pro, para grupos de estudio.")}</p>
          </div>
          <form action={createCheckoutSession.bind(null, "TEAM")}>
            <button
              type="submit"
              className="rounded-full border border-ink px-5 py-2.5 text-sm font-semibold hover:bg-chip"
            >
              {t("Elegir Team")}
            </button>
          </form>
        </div>
      )}

      <p className="text-center text-xs text-ink-faint">
        {t("Al suscribirte aceptas los")}{" "}
        <Link href="/terms" className="hover:underline">
          {t("Términos del servicio")}
        </Link>{" "}
        {t("y la")}{" "}
        <Link href="/privacy" className="hover:underline">
          {t("Política de privacidad")}
        </Link>
        .
      </p>
    </div>
  );
}
