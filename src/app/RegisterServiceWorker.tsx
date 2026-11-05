"use client";

import { useEffect } from "react";

// Registers /sw.js, which (with the manifest) makes the app installable.
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
