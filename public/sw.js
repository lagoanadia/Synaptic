// Deliberately minimal ("service worker básico") — this app has no
// offline mode yet, so this doesn't cache anything. Its only job is to
// exist and handle `fetch`, which is one of the classic browser checks
// for "is this actually installable as an app" (alongside the manifest).
// Every request just passes straight through to the network, unchanged.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// No fetch listener at all — modern installability criteria (Chrome
// dropped the "must handle fetch" requirement years ago) don't need one,
// and Chrome's own DevTools flags an empty/no-op handler as pure
// overhead on every navigation for zero benefit. Every request already
// goes straight to the network untouched by simply not being intercepted.

// Deadline-reminder push messages (see src/app/api/cron/deadline-reminders)
// arrive here even when no Synaptic tab is open — that's the whole point
// of a push notification. The payload is plain JSON: { title, body, url }.
self.addEventListener("push", (event) => {
  let data = { title: "Synaptic", body: "You have an upcoming deadline." };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    // Malformed/empty payload — fall back to the generic copy above
    // rather than dropping the notification entirely.
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icon.png",
      data: { url: data.url || "/pursuits" },
    }),
  );
});

// Focuses an already-open Synaptic tab rather than always opening a new
// one, same as clicking a native app's notification would.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/pursuits";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(url) && "focus" in client) return client.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});
