import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createCheckoutSession, createPortalSession } from "./actions";

const PLAN_COPY = {
  FREE: { label: "Free", price: "$0" },
  PRO: { label: "Student Pro", price: "$6/mo" },
  TEAM: { label: "Team", price: "$10/mo" },
} as const;

const ERROR_COPY: Record<string, string> = {
  "not-configured": "Payments aren't set up yet — try again once billing is configured.",
  "checkout-failed": "Couldn't start checkout right now. Try again in a few minutes.",
  "no-billing-account": "No billing account yet — subscribe to a plan first.",
  "portal-failed": "Couldn't open billing management right now. Try again in a few minutes.",
};

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; canceled?: string; error?: string }>;
}) {
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
        <h1 className="text-2xl font-semibold">Billing</h1>
        <Link href="/pursuits" className="text-sm text-ink-muted hover:underline">
          ← Back to Pursuits
        </Link>
      </div>

      {success && (
        <p className="rounded-xl bg-forest-soft px-4 py-3 text-sm text-ink">
          Payment received — this can take a few seconds to show up below if your plan
          still says Free.
        </p>
      )}
      {canceled && (
        <p className="rounded-xl bg-chip px-4 py-3 text-sm text-ink-muted">
          Checkout canceled — you weren&apos;t charged.
        </p>
      )}
      {error && (
        <p className="rounded-xl bg-crimson-soft px-4 py-3 text-sm text-ink">
          {ERROR_COPY[error] ?? "Something went wrong. Try again in a few minutes."}
        </p>
      )}

      <div className="flex flex-col gap-2 rounded-2xl border border-border-subtle bg-white p-6">
        <span className="text-xs font-medium text-ink-muted">Current plan</span>
        <span className="text-xl font-semibold">
          {current.label} <span className="text-ink-muted">· {current.price}</span>
        </span>
        {user.plan !== "FREE" && user.stripeCurrentPeriodEnd && (
          <span className="text-xs text-ink-faint">
            Renews {user.stripeCurrentPeriodEnd.toLocaleDateString("en-US", { timeZone: "UTC" })}
          </span>
        )}
        {user.stripeCustomerId && (
          <form action={createPortalSession} className="mt-2">
            <button
              type="submit"
              className="rounded-full border border-border-subtle px-4 py-2 text-sm font-medium hover:bg-chip"
            >
              Manage billing
            </button>
          </form>
        )}
      </div>

      {user.plan !== "PRO" && (
        <div className="flex items-center justify-between rounded-2xl border border-border-subtle bg-white p-6">
          <div>
            <p className="font-semibold">Student Pro — $6/mo</p>
            <p className="text-sm text-ink-muted">
              Unlimited flashcards, unlimited Ask AI, unlimited sharing.
            </p>
          </div>
          <form action={createCheckoutSession.bind(null, "PRO")}>
            <button
              type="submit"
              className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
            >
              Go Pro
            </button>
          </form>
        </div>
      )}

      {user.plan !== "TEAM" && (
        <div className="flex items-center justify-between rounded-2xl border border-border-subtle bg-white p-6">
          <div>
            <p className="font-semibold">Team — $10/mo</p>
            <p className="text-sm text-ink-muted">Everything in Pro, for study groups.</p>
          </div>
          <form action={createCheckoutSession.bind(null, "TEAM")}>
            <button
              type="submit"
              className="rounded-full border border-ink px-5 py-2.5 text-sm font-semibold hover:bg-chip"
            >
              Go Team
            </button>
          </form>
        </div>
      )}

      <p className="text-center text-xs text-ink-faint">
        Subscribing means you agree to the{" "}
        <Link href="/terms" className="hover:underline">
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="hover:underline">
          Privacy Policy
        </Link>
        .
      </p>
    </div>
  );
}
