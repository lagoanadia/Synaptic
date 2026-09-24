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
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
