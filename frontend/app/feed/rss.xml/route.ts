import { API_URL } from "@/lib/constants";

export async function GET() {
  const res = await fetch(`${API_URL}/feeds/rss`, {
    next: { revalidate: 3600 },
  });
  const body = await res.text();
  return new Response(body, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
}
