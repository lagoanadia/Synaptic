"use client";

import { useEffect, useState } from "react";
import { subscribeToPush, unsubscribeFromPush } from "../actions";

// A VAPID public key is base64url; PushManager.subscribe wants raw bytes.
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

// Global per-browser opt-in, not per-Pursuit — one click here covers
// deadline reminders for every Classroom-linked Pursuit this account has,
// since a push subscription belongs to the browser, not to any one page.
export function NotificationToggle() {
  // Computed once at init, not set from inside the effect below — reading
  // navigator/window synchronously during render is fine (it can't change
  // mid-session), only the async subscription check needs the effect.
  const [supported] = useState(
    () => typeof navigator !== "undefined" && "serviceWorker" in navigator && "PushManager" in window,
  );
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supported) return;
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setSubscribed(!!sub))
      .catch(() => setSubscribed(false));
  }, [supported]);

  async function enable() {
    setBusy(true);
    try {
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) {
        window.alert("Push notifications aren't configured for this app yet.");
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return;

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });
      await subscribeToPush(
        subscription.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } },
      );
      setSubscribed(true);
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await unsubscribeFromPush(subscription.endpoint);
        await subscription.unsubscribe();
      }
      setSubscribed(false);
    } finally {
      setBusy(false);
    }
  }

  // Not supported (no service worker/PushManager) or still checking on
  // mount — either way, nothing useful to offer yet.
  if (!supported || subscribed === null) return null;

  return (
    <button
      type="button"
      onClick={subscribed ? disable : enable}
      disabled={busy}
      className="shrink-0 text-xs text-ink-faint hover:text-ink disabled:opacity-50"
    >
      {subscribed ? "🔔 Reminders on" : "🔕 Get reminders"}
    </button>
  );
}
