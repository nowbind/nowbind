import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "NowBind",
    short_name: "NowBind",
    description:
      "The open-source blogging platform where every post is both a beautiful article and a structured AI-agent feed.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#1a1a1a",
    icons: [
      {
        src: "/logos/n.-dark.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
