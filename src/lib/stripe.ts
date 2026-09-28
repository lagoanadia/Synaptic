import Stripe from "stripe";
import { Plan } from "@/generated/prisma/client";

// Constructing this needs to never throw, even with STRIPE_SECRET_KEY
// unset, so importing this file stays safe before Stripe is configured —
// but the SDK itself throws immediately for a falsy key ("" included),
// not just a wrong one, so an empty env var isn't enough on its own. A
// placeholder that's merely the wrong shape gets past construction and
// only fails once a call site actually hits the network, which every
// caller here already wraps in try/catch.
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_not_configured", {
  apiVersion: "2026-08-26.dahlia",
});

// One Stripe Price per paid plan — set after creating the two recurring
// Prices in the Stripe Dashboard (Product catalog). FREE has no Price: it's
// the default, never something you check out into.
export const PLAN_PRICE_IDS: Partial<Record<Plan, string>> = {
  PRO: process.env.STRIPE_PRICE_PRO,
  TEAM: process.env.STRIPE_PRICE_TEAM,
};

// The webhook goes the other way — a Stripe Price ID back to our Plan —
// so it has to be a real lookup, not just PLAN_PRICE_IDS read backwards
// (two plans could theoretically share unset/misconfigured env vars).
export function planForPriceId(priceId: string | null | undefined): Plan | null {
  if (!priceId) return null;
  for (const [plan, id] of Object.entries(PLAN_PRICE_IDS)) {
    if (id === priceId) return plan as Plan;
  }
  return null;
}
