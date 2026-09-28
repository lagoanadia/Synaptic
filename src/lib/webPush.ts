import webpush from "web-push";

// VAPID identifies this app to the push services (Chrome's, Mozilla's,
// etc.) it sends through — same keypair for every subscription, generated
// once and stored as env vars (see .env), never per-user.
webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || "mailto:lagoanadia@gmail.com",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "",
  process.env.VAPID_PRIVATE_KEY || "",
);

export async function sendPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: { title: string; body: string; url: string },
) {
  await webpush.sendNotification(
    {
      endpoint: subscription.endpoint,
      keys: { p256dh: subscription.p256dh, auth: subscription.auth },
    },
    JSON.stringify(payload),
  );
}
