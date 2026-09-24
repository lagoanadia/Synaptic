import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // A cached service worker file is a classic PWA footgun: browsers
        // keep running the OLD one indefinitely, silently, so an update
        // never reaches anyone. no-cache forces a revalidation check on
        // every load instead.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
