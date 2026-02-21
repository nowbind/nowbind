"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const footerLinks = [
  { href: "/docs", label: "Docs" },
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
  { href: "/feed/rss.xml", label: "RSS" },
  { href: "/llms.txt", label: "llms.txt" },
] as const;

const hiddenPrefixes = [
  "/post/",
  "/feed",
  "/dashboard",
  "/editor",
  "/api-keys",
  "/settings",
  "/stats",
  "/profile",
  "/reading-list",
  "/liked",
  "/notifications",
  "/import",
  "/login",
  "/callback",
] as const;

export function Footer() {
  const pathname = usePathname();

  if (
    pathname &&
    hiddenPrefixes.some(
      (prefix) => pathname === prefix || pathname.startsWith(prefix)
    )
  ) {
    return null;
  }

  return (
    <footer className="border-t">
      <div className="mx-auto max-w-5xl px-4 py-6">
        <div className="flex flex-col items-center gap-4 text-center md:flex-row md:justify-between md:text-left">
          <div className="space-y-0.5">
            <p className="text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} NowBind
            </p>
            <p className="text-xs text-muted-foreground/70">
              Every post is human-readable and AI-agent-consumable.
            </p>
          </div>

          <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {footerLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="transition-colors hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
            <a
              href="https://github.com/nowbind/nowbind"
              target="_blank"
              rel="noopener"
              className="transition-colors hover:text-foreground"
            >
              GitHub
            </a>
          </nav>
        </div>
      </div>
    </footer>
  );
}
