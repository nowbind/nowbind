import Link from "next/link";
import { Separator } from "@/components/ui/separator";

export function Footer() {
  return (
    <footer className="border-t">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
          <div className="flex flex-col items-center gap-1 md:items-start">
            <p className="text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} NowBind. Open source under MIT.
            </p>
            <p className="text-xs text-muted-foreground">
              Every post is human-readable and AI-agent-consumable.
            </p>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <Link
              href="/feed/rss.xml"
              className="transition-colors hover:text-foreground"
            >
              RSS
            </Link>
            <Separator orientation="vertical" className="h-4" />
            <Link
              href="/llms.txt"
              className="transition-colors hover:text-foreground"
            >
              llms.txt
            </Link>
            <Separator orientation="vertical" className="h-4" />
            <a
              href="https://github.com/nowbind/nowbind"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-foreground"
            >
              GitHub
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
