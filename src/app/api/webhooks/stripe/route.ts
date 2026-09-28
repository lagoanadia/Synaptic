import { NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { stripe, planForPriceId } from "@/lib/stripe";

// Reads the item's price/period-end rather than the subscription's own
// (removed from Subscription itself in recent Stripe API versions, now
// per-item to support multiple prices on one subscription) — this app
// only ever puts one price on a subscription, so the first item is it.
function planFromSubscription(sub: Stripe.Subscription) {
  const item = sub.items.data[0];
  const plan = item ? planForPriceId(item.price.id) : null;
  const periodEnd = item ? new Date(item.current_period_end * 1000) : null;
  return { plan, periodEnd };
}

// Stripe calls this after checkout, and again on every renewal, plan
// change, or cancellation — the source of truth for User.plan is always
// what Stripe reports here, never anything set optimistically from a
// page or Server Action right after a checkout redirect.
export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const userId = session.client_reference_id;
      const customerId =
        typeof session.customer === "string" ? session.customer : session.customer?.id;
      const subscriptionId =
        typeof session.subscription === "string"
          ? session.subscription
          : session.subscription?.id;
      if (!userId || !customerId || !subscriptionId) break;

      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const { plan, periodEnd } = planFromSubscription(subscription);
      if (!plan) break;

      await prisma.user.update({
        where: { id: userId },
        data: {
          plan,
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
          stripeCurrentPeriodEnd: periodEnd,
        },
      });
      break;
    }

    // Covers renewals, upgrades/downgrades between Pro and Team, and a
    // subscription lapsing into past_due/unpaid/canceled without the
    // customer ever explicitly canceling.
    case "customer.subscription.updated": {
      const subscription = event.data.object;
      const customerId =
        typeof subscription.customer === "string"
          ? subscription.customer
          : subscription.customer.id;
      const isActive = subscription.status === "active" || subscription.status === "trialing";
      const { plan, periodEnd } = planFromSubscription(subscription);

      await prisma.user.updateMany({
        where: { stripeCustomerId: customerId },
        data: {
          plan: isActive && plan ? plan : "FREE",
          stripeCurrentPeriodEnd: isActive ? periodEnd : null,
        },
      });
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object;
      const customerId =
        typeof subscription.customer === "string"
          ? subscription.customer
          : subscription.customer.id;

      await prisma.user.updateMany({
        where: { stripeCustomerId: customerId },
        data: { plan: "FREE", stripeSubscriptionId: null, stripeCurrentPeriodEnd: null },
      });
      break;
    }
  }

  return NextResponse.json({ received: true });
}
