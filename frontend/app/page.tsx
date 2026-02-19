"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/hooks/use-auth";
import { api } from "@/lib/api";
import type { Post } from "@/lib/types";
import { ArrowRight, Loader2 } from "lucide-react";

export default function HomePage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [recentPosts, setRecentPosts] = useState<Post[]>([]);

  useEffect(() => {
    if (!loading && user) {
      router.replace("/explore");
    }
  }, [user, loading, router]);

  useEffect(() => {
    api
      .get<{ data: Post[] }>("/posts", { per_page: "4", page: "1" })
      .then((res) => setRecentPosts(res.data || []))
      .catch(() => {});
  }, []);

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
        {/* ── Hero ── */}
        <section className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center px-4">
          <div className="mx-auto max-w-3xl text-center">
            <p className="mb-5 text-sm font-medium tracking-widest uppercase text-primary/70">
              Open-source blogging platform
            </p>
            <h1 className="text-5xl font-extrabold tracking-tight sm:text-6xl md:text-7xl lg:text-8xl">
              Write for humans.
            </h1>
            <h1 className="mt-1 text-5xl font-extrabold tracking-tight text-muted-foreground/50 sm:text-6xl md:text-7xl lg:text-8xl">
              Feed the machines.
            </h1>
            <p className="mx-auto mt-8 max-w-xl text-base text-muted-foreground md:text-lg">
              Every post you publish is simultaneously a beautiful article for
              people and a structured feed for AI agents. One write, two
              audiences.
            </p>
            <div className="mt-10 flex items-center justify-center gap-3">
              <Button size="lg" className="h-12 px-8 text-base" asChild>
                <Link href="/login">
                  Start Writing
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="h-12 px-8 text-base"
                asChild
              >
                <Link href="/explore">Explore</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* ── How it works ── */}
        <section className="border-t">
          <div className="mx-auto max-w-5xl px-4 py-20 md:py-28">
            <p className="text-center text-xs font-semibold tracking-widest uppercase text-primary/70">
              How it works
            </p>
            <h2 className="mt-3 text-center text-3xl font-bold tracking-tight md:text-4xl">
              One post, every format
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-center text-muted-foreground">
              Write once in the block editor. NowBind generates everything else
              automatically.
            </p>

            <div className="mt-14 grid gap-px overflow-hidden rounded-xl border bg-border md:grid-cols-3">
              {[
                {
                  step: "01",
                  title: "Write",
                  desc: "Block editor with rich text, code blocks, embeds, callouts, and drag-and-drop images.",
                },
                {
                  step: "02",
                  title: "Publish",
                  desc: "One click generates RSS, Atom, JSON Feed, llms.txt, JSON-LD, and MCP server endpoints.",
                },
                {
                  step: "03",
                  title: "Reach everyone",
                  desc: "Humans read beautiful articles. AI agents query structured data through the API and MCP.",
                },
              ].map((item) => (
                <div key={item.step} className="bg-background p-8 md:p-10">
                  <span className="text-3xl font-black text-primary/10">
                    {item.step}
                  </span>
                  <h3 className="mt-3 text-lg font-bold">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── The dual output ── */}
        <section className="border-t">
          <div className="mx-auto max-w-5xl px-4 py-20 md:py-28">
            <div className="grid items-start gap-10 md:grid-cols-2">
              {/* Human side */}
              <div>
                <span className="mb-3 inline-block rounded-full border border-primary/20 bg-primary/[0.05] px-3 py-1 text-xs font-medium text-primary">
                  For humans
                </span>
                <h3 className="text-2xl font-bold tracking-tight">
                  A reading experience that respects your attention
                </h3>
                <ul className="mt-6 space-y-3 text-sm text-muted-foreground">
                  <li className="flex gap-3">
                    <span className="mt-0.5 block h-1.5 w-1.5 shrink-0 rounded-full bg-primary/50" />
                    Customizable typography — serif, sans, mono, and your
                    browser default
                  </li>
                  <li className="flex gap-3">
                    <span className="mt-0.5 block h-1.5 w-1.5 shrink-0 rounded-full bg-primary/50" />
                    Focus mode strips away everything except the writing
                  </li>
                  <li className="flex gap-3">
                    <span className="mt-0.5 block h-1.5 w-1.5 shrink-0 rounded-full bg-primary/50" />
                    Table of contents, reading progress, keyboard shortcuts
                  </li>
                  <li className="flex gap-3">
                    <span className="mt-0.5 block h-1.5 w-1.5 shrink-0 rounded-full bg-primary/50" />
                    Dark mode, responsive, installable as a PWA
                  </li>
                </ul>
              </div>

              {/* Machine side */}
              <div>
                <span className="mb-3 inline-block rounded-full border border-primary/20 bg-primary/[0.05] px-3 py-1 text-xs font-medium text-primary">
                  For machines
                </span>
                <h3 className="text-2xl font-bold tracking-tight">
                  Every post is an API endpoint
                </h3>
                <div className="mt-6 overflow-hidden rounded-lg border bg-muted/30">
                  <div className="flex items-center gap-2 border-b px-4 py-2.5 text-xs text-muted-foreground">
                    <span className="h-2 w-2 rounded-full bg-emerald-500/70" />
                    GET /api/v1/agent/posts/your-post
                  </div>
                  <pre className="overflow-x-auto p-4 text-xs leading-relaxed text-muted-foreground">
                    {`{
  "title": "Your Post Title",
  "content_markdown": "# Full structured...",
  "ai_summary": "Auto-generated summary",
  "ai_keywords": ["topic", "guide"],
  "reading_time": 5,
  "mcp_endpoint": "/mcp"
}`}
                  </pre>
                </div>
                <p className="mt-4 text-sm text-muted-foreground">
                  Plus RSS, Atom, JSON Feed, llms.txt, JSON-LD, and a full MCP
                  server.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── MCP section ── */}
        <section className="border-t">
          <div className="mx-auto max-w-5xl px-4 py-20 md:py-28">
            <div className="overflow-hidden rounded-xl border">
              <div className="bg-primary/[0.03] p-8 md:p-12">
                <div className="flex flex-col gap-8 md:flex-row md:items-start md:gap-12">
                  <div className="flex-1">
                    <p className="text-xs font-semibold tracking-widest uppercase text-primary/70">
                      Model Context Protocol
                    </p>
                    <h2 className="mt-3 text-2xl font-bold tracking-tight md:text-3xl">
                      Built-in MCP server
                    </h2>
                    <p className="mt-4 text-muted-foreground">
                      Every NowBind instance ships with a JSON-RPC 2.0 MCP
                      server. AI agents like Claude, ChatGPT, and custom LLM
                      pipelines can connect directly and query your content as
                      structured resources.
                    </p>
                    <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
                      <li className="flex gap-3">
                        <span className="mt-0.5 block h-1.5 w-1.5 shrink-0 rounded-full bg-primary/50" />
                        Browse posts, search by topic, read full articles
                      </li>
                      <li className="flex gap-3">
                        <span className="mt-0.5 block h-1.5 w-1.5 shrink-0 rounded-full bg-primary/50" />
                        Discover authors and their published work
                      </li>
                      <li className="flex gap-3">
                        <span className="mt-0.5 block h-1.5 w-1.5 shrink-0 rounded-full bg-primary/50" />
                        Zero config — works out of the box at{" "}
                        <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                          /mcp
                        </code>
                      </li>
                    </ul>
                  </div>
                  <div className="flex-1">
                    <div className="overflow-hidden rounded-lg border bg-background">
                      <div className="flex items-center gap-2 border-b px-4 py-2.5 text-xs text-muted-foreground">
                        <span className="h-2 w-2 rounded-full bg-violet-500/70" />
                        MCP &mdash; JSON-RPC 2.0
                      </div>
                      <pre className="overflow-x-auto p-4 text-xs leading-relaxed text-muted-foreground">
                        {`// Claude Desktop config
{
  "mcpServers": {
    "nowbind": {
      "url": "https://nowbind.com/mcp"
    }
  }
}

// Available tools:
// - search_posts(query)
// - get_post(slug)
// - list_posts(tag, page)
// - get_author(username)`}
                      </pre>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Recent posts ── */}
        {recentPosts.length > 0 && (
          <section className="border-t">
            <div className="mx-auto max-w-5xl px-4 py-20 md:py-28">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-xs font-semibold tracking-widest uppercase text-primary/70">
                    From the community
                  </p>
                  <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
                    Recent posts
                  </h2>
                </div>
                <Link
                  href="/explore"
                  className="hidden text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:block"
                >
                  View all &rarr;
                </Link>
              </div>

              <div className="mt-10 grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-2">
                {recentPosts.map((post) => (
                  <Link
                    key={post.id}
                    href={`/post/${post.slug}`}
                    className="group bg-background p-6 transition-colors hover:bg-accent/40"
                  >
                    <p className="text-xs text-muted-foreground">
                      {post.author?.display_name || post.author?.username}
                      {post.reading_time
                        ? ` \u00b7 ${post.reading_time} min`
                        : ""}
                    </p>
                    <h3 className="mt-1.5 font-semibold leading-snug line-clamp-2">
                      {post.title}
                    </h3>
                    {post.excerpt && (
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground line-clamp-2">
                        {post.excerpt}
                      </p>
                    )}
                  </Link>
                ))}
              </div>

              <div className="mt-6 text-center sm:hidden">
                <Link
                  href="/explore"
                  className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  View all posts &rarr;
                </Link>
              </div>
            </div>
          </section>
        )}

        {/* ── Final CTA ── */}
        <section className="border-t">
          <div className="mx-auto max-w-5xl px-4 py-20 text-center md:py-28">
            <div>
              <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
                Your words deserve two audiences
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
                Join NowBind and publish content that works for readers and AI
                agents alike. Free, open-source, and yours forever.
              </p>
              <div className="mt-8 flex items-center justify-center gap-3">
                <Button size="lg" className="h-12 px-8 text-base" asChild>
                  <Link href="/login">
                    Get started
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  variant="ghost"
                  size="lg"
                  className="h-12 px-8 text-base"
                  asChild
                >
                  <a
                    href="https://github.com/nowbind/nowbind"
                    target="_blank"
                    rel="noopener"
                  >
                    View on GitHub
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
