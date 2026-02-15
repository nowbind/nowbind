import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8080";

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  disable: false,
});

const nextConfig: NextConfig = {
  reactCompiler: true,
  turbopack: {},
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${BACKEND_URL}/api/:path*`,
      },
      {
        source: "/health",
        destination: `${BACKEND_URL}/health`,
      },
      {
        source: "/llms.txt",
        destination: `${BACKEND_URL}/llms.txt`,
      },
      {
        source: "/llms-full.txt",
        destination: `${BACKEND_URL}/llms-full.txt`,
      },
      {
        source: "/mcp",
        destination: `${BACKEND_URL}/mcp`,
      },
    ];
  },
};

export default withSerwist(nextConfig);
