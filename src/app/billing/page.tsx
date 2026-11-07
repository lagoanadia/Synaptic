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
        <h1 className="text-2xl font-semibold">Facturación</h1>
        <Link href="/pursuits" className="text-sm text-ink-muted hover:underline">
          <ArrowLeft /> Volver
        </Link>
      </div>

      {success && (
        <p className="rounded-xl bg-forest-soft px-4 py-3 text-sm text-ink">
          Pago recibido — puede tardar unos segundos en aparecer abajo si tu plan
          sigue diciendo Gratis.
        </p>
      )}
      {canceled && (
        <p className="rounded-xl bg-chip px-4 py-3 text-sm text-ink-muted">
          Pago cancelado — no se te ha cobrado.
        </p>
      )}
      {error && (
        <p className="rounded-xl bg-crimson-soft px-4 py-3 text-sm text-ink">
          {ERROR_COPY[error] ?? "Algo ha fallado. Inténtalo en unos minutos."}
        </p>
      )}

      <div className="flex flex-col gap-2 rounded-2xl border border-border-subtle bg-white p-6">
        <span className="text-xs font-medium text-ink-muted">Plan actual</span>
        <span className="text-xl font-semibold">
          {current.label} <span className="text-ink-muted">· {current.price}</span>
        </span>
        {user.plan !== "FREE" && user.stripeCurrentPeriodEnd && (
          <span className="text-xs text-ink-faint">
            Se renueva el {user.stripeCurrentPeriodEnd.toLocaleDateString("es-ES", { timeZone: "UTC" })}
          </span>
        )}
        {user.stripeCustomerId && (
          <form action={createPortalSession} className="mt-2">
            <button
              type="submit"
              className="rounded-full border border-border-subtle px-4 py-2 text-sm font-medium hover:bg-chip"
            >
              Gestionar facturación
            </button>
          </form>
        )}
      </div>

      {user.plan !== "PRO" && (
        <div className="flex items-center justify-between rounded-2xl border border-border-subtle bg-white p-6">
          <div>
            <p className="font-semibold">Student Pro — 6 $/mes</p>
            <p className="text-sm text-ink-muted">
              Tarjetas ilimitadas, preguntas a la IA ilimitadas y compartir sin límite.
            </p>
          </div>
          <form action={createCheckoutSession.bind(null, "PRO")}>
            <button
              type="submit"
              className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
            >
              Hazte Pro
            </button>
          </form>
        </div>
      )}

      {user.plan !== "TEAM" && (
        <div className="flex items-center justify-between rounded-2xl border border-border-subtle bg-white p-6">
          <div>
            <p className="font-semibold">Team — 10 $/mes</p>
            <p className="text-sm text-ink-muted">Todo lo de Pro, para grupos de estudio.</p>
          </div>
          <form action={createCheckoutSession.bind(null, "TEAM")}>
            <button
              type="submit"
              className="rounded-full border border-ink px-5 py-2.5 text-sm font-semibold hover:bg-chip"
            >
              Elegir Team
            </button>
          </form>
        </div>
      )}

      <p className="text-center text-xs text-ink-faint">
        Al suscribirte aceptas los{" "}
        <Link href="/terms" className="hover:underline">
          Términos del servicio
        </Link>{" "}
        y la{" "}
        <Link href="/privacy" className="hover:underline">
          Política de privacidad
        </Link>
        .
      </p>
    </div>
  );
}
