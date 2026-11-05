import webpush from "web-push";

// VAPID keys identify the app to browser push services. Configured on first
// send, not at import, so builds without the keys still work.
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
