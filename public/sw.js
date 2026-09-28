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

// GET-only on purpose — calling fetch(event.request) again for a POST
// (a Server Action, e.g. picking a Classroom course or submitting any
// form) can fail with "Failed to fetch" because the request body is a
// single-use stream that's already been consumed by the time this
// handler re-issues it. Not calling respondWith() at all lets the
// browser handle those natively with zero risk, which is what "passes
// straight through, unchanged" actually requires for anything with a
// body.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(fetch(event.request));
});
