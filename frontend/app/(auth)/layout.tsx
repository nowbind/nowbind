import Link from "next/link";

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="relative min-h-screen">
      {children}
      <div className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
        <nav className="rounded-full border bg-background/90 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
          <Link href="/terms" className="hover:text-foreground">
            Terms
          </Link>{" "}
          ·{" "}
          <Link href="/privacy" className="hover:text-foreground">
            Privacy
          </Link>
        </nav>
      </div>
    </div>
  );
}
