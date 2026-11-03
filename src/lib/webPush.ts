import webpush from "web-push";

// VAPID identifies this app to the push services (Chrome's, Mozilla's,
// etc.) it sends through — same keypair for every subscription, generated
// once and stored as env vars (see .env), never per-user.
//
// Configured lazily, on the first send, NOT at the top of this module:
// `next build` imports every route module while "collecting page data",
// so a top-level setVapidDetails ran at BUILD time and threw "No key set
// vapidDetails.publicKey" wherever the env vars weren't available to the
// build (e.g. a Preview deployment without them) — failing the whole
// deploy over a feature that only matters when a cron actually fires.
let configured = false;

export function isPushConfigured() {
  return !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && !!process.env.VAPID_PRIVATE_KEY;
}

function ensureConfigured() {
  if (configured) return;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!isPushConfigured() || !publicKey || !privateKey) {
    throw new Error(
      "Web push isn't configured: set NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY",
    );
  }
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:lagoanadia@gmail.com",
    publicKey,
    privateKey,
  );
  configured = true;
}

export async function sendPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: { title: string; body: string; url: string },
) {
  ensureConfigured();
  await webpush.sendNotification(
    {
      endpoint: subscription.endpoint,
      keys: { p256dh: subscription.p256dh, auth: subscription.auth },
    },
    JSON.stringify(payload),
  );
}
