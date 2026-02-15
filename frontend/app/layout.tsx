import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import NextTopLoader from "nextjs-toploader";
import { SearchDialog } from "@/components/search/search-dialog";
import { AuthProvider } from "@/lib/auth-context";
import { InstallPrompt } from "@/components/pwa/install-prompt";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
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
    icon: "/logos/n.-dark.svg",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "NowBind",
    title: "NowBind",
    description:
      "The open-source blogging platform where every post is both a beautiful article and a structured AI-agent feed.",
  },
  twitter: {
    card: "summary_large_image",
    title: "NowBind",
    description:
      "The open-source blogging platform where every post is both a beautiful article and a structured AI-agent feed.",
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
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="NowBind" />
        <meta name="theme-color" content="#1a1a1a" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
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
        className={`${spaceGrotesk.variable} ${jetbrainsMono.variable} font-sans antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            <TooltipProvider>
              <NextTopLoader color="var(--primary)" showSpinner={false} />
              <SearchDialog />
              {children}
              <InstallPrompt />
            </TooltipProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
