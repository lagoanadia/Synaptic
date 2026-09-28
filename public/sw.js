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

// Registered but never calls respondWith() — a real no-op, not just a
// GET-only one. Re-issuing event.request through fetch() can fail with
// "Failed to fetch" in more cases than just POST bodies: a top-level page
// load's Request has mode: "navigate", and passing that same Request
// object into fetch() again is invalid and throws in Chrome. Not calling
// respondWith() at all sidesteps every version of this — the browser
// handles the request exactly as if this listener didn't exist, which is
// what "passes straight through, unchanged" actually means. The listener
// stays registered since some installability checks look for one to
// exist at all, even doing nothing.
self.addEventListener("fetch", () => {});
