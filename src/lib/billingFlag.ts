// Paid plans (Stripe) are built but hidden while the app runs on Vercel's
// Hobby plan, which doesn't allow charging. Set NEXT_PUBLIC_BILLING=on to
// show them again (pricing, /billing, plan badge, legal sections).
export const BILLING = process.env.NEXT_PUBLIC_BILLING === "on";
