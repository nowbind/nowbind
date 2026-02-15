import { API_URL } from "@/lib/constants";

export async function GET() {
  const res = await fetch(`${API_URL}/feeds/json`, {
    next: { revalidate: 3600 },
  });
  const body = await res.text();
  return new Response(body, {
    headers: { "Content-Type": "application/feed+json; charset=utf-8" },
  });
}
