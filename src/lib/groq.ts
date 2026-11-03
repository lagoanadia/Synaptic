import Groq from "groq-sdk";

// Same reasoning as src/lib/stripe.ts: constructing the client must never
// throw. `next build` imports every route module while "collecting page
// data", so `new Groq()` with GROQ_API_KEY unset crashed the BUILD itself
// (e.g. a Preview deployment without that env var), not just the AI
// features. A placeholder gets past construction and only fails once a
// call actually reaches Groq — and every caller already handles a failed
// call (it surfaces as "Couldn't reach the AI right now").
export const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || "gsk_not_configured" });
