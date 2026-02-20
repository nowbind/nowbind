import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

function normalizeBackendBaseUrl(value?: string): string | null {
  if (!value) return null;
  const trimmed = value.trim().replace(/\/$/, "");
  if (!trimmed) return null;
  return trimmed.replace(/\/api\/v1$/, "").replace(/\/api$/, "");
}

const BACKEND_BASE_URL =
  // Preferred explicit server-side base URL (optional).
  normalizeBackendBaseUrl(process.env.NEXT_API_BASE_URL) ||
  // Default for local setup: derive backend base from public API URL.
  normalizeBackendBaseUrl(process.env.NEXT_PUBLIC_API_URL) ||
  "http://localhost:8080";

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  disable: false,
});

const nextConfig: NextConfig = {
  output: "standalone",
  reactCompiler: true,
  turbopack: {},
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${BACKEND_BASE_URL}/api/:path*`,
      },
      {
        source: "/health",
        destination: `${BACKEND_BASE_URL}/health`,
      },
      {
        source: "/llms.txt",
        destination: `${BACKEND_BASE_URL}/llms.txt`,
      },
      {
        source: "/llms-full.txt",
        destination: `${BACKEND_BASE_URL}/llms-full.txt`,
      },
      {
        source: "/mcp",
        destination: `${BACKEND_BASE_URL}/mcp`,
      },
    ];
  },
};

export default withSerwist(nextConfig);
