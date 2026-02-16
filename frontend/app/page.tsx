"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/hooks/use-auth";
import { ArrowRight, Rss, Bot, FileText, Loader2 } from "lucide-react";

export default function HomePage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) {
      router.replace("/explore");
    }
  }, [user, loading, router]);

  if (loading || user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto max-w-5xl px-4 py-20 text-center md:py-32">
          <h1 className="mb-4 text-4xl font-bold tracking-tight md:text-6xl">
            Write for humans.
            <br />
            <span className="text-muted-foreground">Feed the machines.</span>
          </h1>
          <p className="mx-auto mb-8 max-w-2xl text-lg text-muted-foreground">
            NowBind is the open-source blogging platform where every post is
            simultaneously a beautiful article and a structured AI-agent feed.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Button size="lg" asChild>
              <Link href="/login">
                Start Writing
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link href="/explore">Explore Posts</Link>
            </Button>
          </div>
        </section>

        {/* Features */}
        <section className="border-t">
          <div className="mx-auto grid max-w-5xl gap-8 px-4 py-16 md:grid-cols-3">
            <div className="space-y-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <FileText className="h-5 w-5" />
              </div>
              <h3 className="font-semibold">Beautiful Writing</h3>
              <p className="text-sm text-muted-foreground">
                A distraction-free Markdown editor with live preview, syntax
                highlighting, and a reading experience designed for focus.
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Bot className="h-5 w-5" />
              </div>
              <h3 className="font-semibold">AI-Native Feeds</h3>
              <p className="text-sm text-muted-foreground">
                Every post auto-generates llms.txt, structured markdown, and an
                MCP server that AI agents can query directly.
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Rss className="h-5 w-5" />
              </div>
              <h3 className="font-semibold">Open Standards</h3>
              <p className="text-sm text-muted-foreground">
                RSS, Atom, JSON Feed, plus llms.txt and MCP. Your content is
                accessible to every reader — human or machine.
              </p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
