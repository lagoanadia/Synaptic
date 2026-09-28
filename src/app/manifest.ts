import type { MetadataRoute } from "next";

// Next.js serves this at /manifest.webmanifest automatically and injects
// the <link rel="manifest"> tag itself — no manual <head> edit needed.
// This, plus HTTPS (Vercel gives that for free) and the service worker
// registered in RegisterServiceWorker, is what makes a browser offer
// "Add to Home Screen" / actually install the app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Synaptic",
    short_name: "Synaptic",
    description: "Capture things learned by doing, then organize them later.",
    start_url: "/pursuits",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#2383e2",
    // Filenames carry a "-v2" suffix (not a version field — the manifest
    // spec has none) specifically so an already-installed PWA is forced to
    // fetch a new URL instead of keeping whatever icon bytes it cached at
    // install time under the old filename. Bump the suffix again next time
    // the artwork changes, rather than overwriting these files in place.
    icons: [
      {
        src: "/icon-192-v2.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512-v2.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
