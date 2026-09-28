"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { stripe, PLAN_PRICE_IDS } from "@/lib/stripe";
import { Plan } from "@/generated/prisma/client";

// Server Actions have no request URL of their own to redirect back to —
// only the incoming request's headers, which is what host/x-forwarded-proto
// come from (Vercel sets the latter; localhost never uses https).
async function getBaseUrl() {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https";
  return `${proto}://${host}`;
}

// Sends the signed-in user to Stripe's hosted Checkout for a subscription
// to the given plan. Reuses their existing Stripe customer if the webhook
// has already created one (e.g. they downgraded and are upgrading again)
// so their payment history stays under one customer instead of forking.
//
// Returns void, not a { error } result, so it can be used directly as a
// plain <form action={...}> — every failure path redirects back to
// /billing?error=... instead, which the page reads and displays.
export async function createCheckoutSession(plan: Plan): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/");
  }

  const priceId = PLAN_PRICE_IDS[plan];
  if (!priceId) {
    redirect("/billing?error=not-configured");
  }

  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.user.id } });
  const baseUrl = await getBaseUrl();

  let checkoutSession;
  try {
    checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      client_reference_id: user.id,
      customer: user.stripeCustomerId ?? undefined,
      customer_email: user.stripeCustomerId ? undefined : (user.email ?? undefined),
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}/billing?success=1`,
      cancel_url: `${baseUrl}/billing?canceled=1`,
    });
  } catch {
    redirect("/billing?error=checkout-failed");
  }

  if (!checkoutSession.url) {
    redirect("/billing?error=checkout-failed");
  }
  redirect(checkoutSession.url);
}

// Stripe's Billing Portal — lets a subscriber update their card, see past
// invoices, or cancel, without this app building any of that UI itself.
// Only reachable once a stripeCustomerId exists (set by the webhook after
// a first successful checkout), so there's always something for Stripe to
// show a portal for.
export async function createPortalSession(): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/");
  }

  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.user.id } });
  if (!user.stripeCustomerId) {
    redirect("/billing?error=no-billing-account");
  }

  const baseUrl = await getBaseUrl();
  let portalSession;
  try {
    portalSession = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${baseUrl}/billing`,
    });
  } catch {
    redirect("/billing?error=portal-failed");
  }
  redirect(portalSession.url);
}
