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

self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
