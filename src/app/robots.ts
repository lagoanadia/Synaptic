import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Only the public pages get crawled; everything behind sign-in stays out.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/privacy", "/terms"],
      disallow: ["/api/", "/pursuits", "/review", "/calendar", "/challenges", "/billing", "/onboarding", "/search"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
