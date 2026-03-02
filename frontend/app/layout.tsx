import type { Metadata } from "next";
import {
  Space_Grotesk,
  JetBrains_Mono,
  Inter,
  Bitter,
  Playfair_Display,
  Lora,
  DM_Sans,
  DM_Serif_Display,
  Libre_Baskerville,
  Source_Sans_3,
  Fraunces,
  Manrope,
  Cormorant_Garamond,
} from "next/font/google";
import "./globals.css";
import { safeJsonLd } from "@/lib/utils";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import NextTopLoader from "nextjs-toploader";
import { SearchDialog } from "@/components/search/search-dialog";
import { AuthProvider } from "@/lib/auth-context";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { SwRegister } from "@/components/pwa/sw-register";
import { OfflineStatus } from "@/components/pwa/offline-status";
import { Toaster } from "sonner";
import { Analytics } from "@/components/analytics";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

// ── Font pairings (Heading + Body) ──────────────────────────────
// 1. Inter + Georgia (Claude.ai style) — Georgia is a system font, no import needed
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

// 2. Sohne + Charter (Medium.com) — Bitter is the free Charter alternative
const bitter = Bitter({
  variable: "--font-bitter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

// 3. Playfair Display + Lora (editorial)
const playfairDisplay = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

// 4. DM Sans + DM Serif Display (same family contrast)
const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const dmSerifDisplay = DM_Serif_Display({
  variable: "--font-dm-serif",
  subsets: ["latin"],
  weight: ["400"],
});

// 5. Libre Baskerville + Source Sans 3 (classic)
const libreBaskerville = Libre_Baskerville({
  variable: "--font-libre-baskerville",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const sourceSans3 = Source_Sans_3({
  variable: "--font-source-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

// 6. Fraunces + Manrope (quirky-elegant)
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

// 7. Cormorant Garamond (elegant high-contrast serif)
const cormorantGaramond = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://nowbind.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "NowBind",
    template: "%s | NowBind",
  },
  description:
    "The open-source blogging platform where every post is both a beautiful article and a structured AI-agent feed.",
  keywords: [
    "blog",
    "ai",
    "mcp",
    "llms.txt",
    "open source",
    "writing",
    "publishing",
    "ai-readable",
  ],
  authors: [{ name: "NowBind", url: siteUrl }],
  creator: "NowBind",
  publisher: "NowBind",
  icons: {
    icon: [
      { url: "/logos/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/logos/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "NowBind",
    title: "NowBind",
    description:
      "The open-source blogging platform where every post is both a beautiful article and a structured AI-agent feed.",
    images: [
      {
        url: "/api/og?title=NowBind&type=default",
        width: 1200,
        height: 630,
        alt: "NowBind",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "NowBind",
    description:
      "The open-source blogging platform where every post is both a beautiful article and a structured AI-agent feed.",
    images: ["/api/og?title=NowBind&type=default"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: siteUrl,
    types: {
      "application/rss+xml": [{ url: "/feed/rss.xml", title: "NowBind RSS" }],
      "application/atom+xml": [
        { url: "/feed/atom.xml", title: "NowBind Atom" },
      ],
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="application-name" content="NowBind" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="NowBind" />
        <meta name="theme-color" content="#1a1a1a" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: safeJsonLd({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: "NowBind",
              url: siteUrl,
              description:
                "The open-source blogging platform where every post is both a beautiful article and a structured AI-agent feed.",
            }),
          }}
        />
      </head>
      <body
        className={`${spaceGrotesk.variable} ${jetbrainsMono.variable} ${inter.variable} ${bitter.variable} ${playfairDisplay.variable} ${lora.variable} ${dmSans.variable} ${dmSerifDisplay.variable} ${libreBaskerville.variable} ${sourceSans3.variable} ${fraunces.variable} ${manrope.variable} ${cormorantGaramond.variable} font-sans antialiased`}
      >
        <Analytics />
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            <SwRegister>
              <TooltipProvider>
                <NextTopLoader color="var(--primary)" showSpinner={false} />
                <SearchDialog />
                {children}
                <Toaster richColors position="top-center" />
                <InstallPrompt />
                <OfflineStatus />
              </TooltipProvider>
            </SwRegister>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
