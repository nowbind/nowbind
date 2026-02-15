import { MetadataRoute } from "next";
import { API_URL, SITE_URL } from "@/lib/constants";
import type { Post, PaginatedResponse } from "@/lib/types";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/explore`, lastModified: new Date(), changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE_URL}/search`, changeFrequency: "weekly", priority: 0.5 },
  ];

  try {
    const res = await fetch(`${API_URL}/posts?per_page=50`);
    if (res.ok) {
      const data: PaginatedResponse<Post> = await res.json();
      for (const post of data.data || []) {
        entries.push({
          url: `${SITE_URL}/post/${post.slug}`,
          lastModified: new Date(post.updated_at),
          changeFrequency: "weekly",
          priority: 0.7,
        });
      }
    }
  } catch {
    // Fail gracefully
  }

  return entries;
}
