import { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/constants";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard", "/editor", "/settings", "/api-keys"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
