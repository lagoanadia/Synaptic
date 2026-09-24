"use client";

import { useEffect } from "react";

// Renders nothing — its only job is the side effect of registering
// /sw.js once the page has loaded, which is what a service worker needs
// (alongside the manifest) for a browser to treat this as an installable
// app instead of just a bookmark.
export function RegisterServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Not fatal — the app works fine without it, it just won't be
        // installable on browsers that require one.
      });
    }
  }, []);

  return null;
}
