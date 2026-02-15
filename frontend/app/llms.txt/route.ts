import { API_URL } from "@/lib/constants";

export async function GET() {
  try {
    const res = await fetch(`${API_URL.replace("/api/v1", "")}/llms.txt`, {
      next: { revalidate: 3600 },
    });
    const body = await res.text();
    return new Response(body, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch {
    return new Response("# NowBind\n\n> Service temporarily unavailable.", {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}
