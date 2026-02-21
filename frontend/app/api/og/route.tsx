import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

export const runtime = "edge";

async function loadFont(weight: number): Promise<ArrayBuffer> {
  const css = await fetch(
    `https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@${weight}&display=swap`,
    {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    }
  ).then((r) => r.text());

  const url = css.match(/url\((https:\/\/fonts\.gstatic\.com[^)]+\.woff2)\)/)?.[1];
  if (!url) throw new Error(`Space Grotesk woff2 URL not found for weight ${weight}`);
  return fetch(url).then((r) => r.arrayBuffer());
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const title = searchParams.get("title") || "NowBind";
  const author = searchParams.get("author") || "";
  const type = searchParams.get("type") || "default";

  const subtitle =
    type === "post" && author
      ? `by ${author}`
      : type === "author"
        ? "Author on NowBind"
        : type === "tag"
          ? "Posts on NowBind"
          : "The open-source AI-native blogging platform";

  const [fontRegular, fontSemiBold, fontBold] = await Promise.all([
    loadFont(400),
    loadFont(600),
    loadFont(700),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "60px",
          background: "linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%)",
          color: "#fafafa",
          fontFamily: "Space Grotesk",
        }}
      >
        {/* Top: branding */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={new URL("/logos/n.-light.svg", req.url).toString()}
            width={36}
            height={36}
            style={{ borderRadius: "8px" }}
            alt="NowBind logo"
          />
          <span style={{ fontSize: "20px", fontWeight: 600, color: "#a1a1aa" }}>
            NowBind
          </span>
        </div>

        {/* Center: title + subtitle */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div
            style={{
              fontSize: title.length > 60 ? "40px" : "52px",
              fontWeight: 700,
              lineHeight: 1.2,
              maxWidth: "900px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              display: "-webkit-box",
              WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical",
            }}
          >
            {title}
          </div>
          {subtitle && (
            <div style={{ fontSize: "24px", fontWeight: 400, color: "#a1a1aa" }}>{subtitle}</div>
          )}
        </div>

        {/* Bottom: accent gradient bar */}
        <div
          style={{
            width: "120px",
            height: "4px",
            borderRadius: "2px",
            background: "linear-gradient(90deg, #6366f1, #8b5cf6, #a78bfa)",
          }}
        />
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: "Space Grotesk", data: fontRegular, weight: 400 },
        { name: "Space Grotesk", data: fontSemiBold, weight: 600 },
        { name: "Space Grotesk", data: fontBold, weight: 700 },
      ],
    },
  );
}
