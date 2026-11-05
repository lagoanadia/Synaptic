import type { MetadataRoute } from "next";

// Served at /manifest.webmanifest; with HTTPS and the service worker it makes
// the app installable.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Synaptic",
    short_name: "Synaptic",
    description: "Capture things learned by doing, then organize them later.",
    start_url: "/pursuits",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#2383e2",
    // The -v3 suffix forces installed apps to fetch new icons. Bump it when the
    // artwork changes.
    icons: [
      {
        src: "/icon-192-v3.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512-v3.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
