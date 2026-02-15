"use client";

import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { Copy, Check, Key, Bot, Zap, BookOpen, Server, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://nowbind.com";

function CodeBlock({ children, label }: { children: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(children);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable
    }
  };
  return (
    <div className="group relative my-4 rounded-lg border bg-muted/50">
      {label && (
        <div className="flex items-center justify-between border-b px-4 py-2">
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
          <Button variant="ghost" size="icon-xs" onClick={copy} className="opacity-0 transition-opacity group-hover:opacity-100">
            {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
          </Button>
        </div>
      )}
      <pre className="overflow-x-auto p-4 text-sm leading-relaxed">
        <code>{children}</code>
      </pre>
      {!label && (
        <Button variant="ghost" size="icon-xs" onClick={copy} className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100">
          {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
        </Button>
      )}
    </div>
  );
}

function Endpoint({ method, path, auth }: { method: string; path: string; auth?: string }) {
  const methodColor = {
    GET: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    POST: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    PUT: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    DELETE: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  }[method] || "bg-muted text-muted-foreground";

  return (
    <div className="flex items-center gap-3 rounded-md border px-3 py-2">
      <span className={`rounded px-2 py-0.5 font-mono text-xs font-bold ${methodColor}`}>{method}</span>
      <code className="flex-1 text-sm">{path}</code>
      {auth && <Badge variant="outline" className="text-[10px]">{auth}</Badge>}
    </div>
  );
}

export default function DocsPage() {
  const sections = [
    { id: "getting-started", label: "Getting Started" },
    { id: "authentication", label: "Authentication" },
    { id: "agent-api", label: "Agent API" },
    { id: "social-api", label: "Social API" },
    { id: "notifications-api", label: "Notifications" },
    { id: "analytics-api", label: "Analytics" },
    { id: "mcp-server", label: "MCP Server" },
    { id: "rate-limits", label: "Rate Limits" },
  ];

  const [activeId, setActiveId] = useState(sections[0].id);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      { rootMargin: "-80px 0px -60% 0px", threshold: 0 }
    );

    const sectionEls = sections
      .map((s) => document.getElementById(s.id))
      .filter(Boolean) as HTMLElement[];

    for (const el of sectionEls) {
      observerRef.current.observe(el);
    }

    return () => observerRef.current?.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <div className="mx-auto max-w-5xl px-4 py-8 lg:grid lg:grid-cols-[200px_1fr] lg:gap-8">
          {/* Sidebar navigation */}
          <nav className="hidden lg:block">
            <div className="sticky top-20 space-y-1">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">On this page</p>
              {sections.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className={`block rounded-md px-3 py-1.5 text-sm transition-colors hover:text-foreground ${
                    activeId === s.id
                      ? "bg-muted font-medium text-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  {s.label}
                </a>
              ))}
            </div>
          </nav>

          {/* Main content */}
          <div className="min-w-0 space-y-12">
            {/* Header */}
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight">API Documentation</h1>
              <p className="mt-2 text-lg text-muted-foreground">
                Everything you need to integrate with NowBind&apos;s Agent API, MCP server, and platform features.
              </p>
            </div>

            {/* Getting Started */}
            <section id="getting-started" className="space-y-4 scroll-mt-20">
              <div className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                <h2 className="text-2xl font-bold">Getting Started</h2>
              </div>
              <p className="text-muted-foreground">
                The NowBind API lets AI agents and applications read posts, search content, and
                interact with the platform programmatically. Every published post is available as
                both a human-readable article and a structured AI-agent feed.
              </p>
              <div className="rounded-lg border bg-muted/30 p-4">
                <p className="text-sm">
                  <strong>Quick start:</strong> Create an API key from your{" "}
                  <Link href="/api-keys" className="font-medium underline underline-offset-4 hover:text-foreground">
                    API Keys page
                  </Link>
                  , then use it in the <code className="rounded bg-muted px-1.5 py-0.5 text-xs">Authorization</code> header.
                </p>
              </div>
            </section>

            {/* Authentication */}
            <section id="authentication" className="space-y-4 scroll-mt-20">
              <div className="flex items-center gap-2">
                <Key className="h-5 w-5 text-primary" />
                <h2 className="text-2xl font-bold">Authentication</h2>
              </div>
              <p className="text-muted-foreground">
                Include your API key in the <code className="rounded bg-muted px-1.5 py-0.5 text-xs">Authorization</code> header
                as a Bearer token. Keys use the <code className="rounded bg-muted px-1.5 py-0.5 text-xs">nb_</code> prefix.
              </p>
              <CodeBlock label="cURL Example">{`curl -H "Authorization: Bearer nb_your_api_key" \\
  ${siteUrl}/api/v1/agent/posts`}</CodeBlock>
              <div className="rounded-lg border border-yellow-500/20 bg-yellow-50 p-4 dark:bg-yellow-950/20">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  <strong>Security:</strong> Keep your API keys secret. Never expose them in client-side code or public repositories.
                </p>
              </div>
            </section>

            {/* Agent API */}
            <section id="agent-api" className="space-y-4 scroll-mt-20">
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-primary" />
                <h2 className="text-2xl font-bold">Agent API</h2>
              </div>
              <p className="text-muted-foreground">
                Endpoints designed for AI agents to read and search content. All require API key authentication.
              </p>

              <div className="space-y-2">
                <Endpoint method="GET" path="/api/v1/agent/posts" auth="API Key" />
                <Endpoint method="GET" path="/api/v1/agent/posts/{slug}" auth="API Key" />
                <Endpoint method="GET" path="/api/v1/agent/search?q={query}" auth="API Key" />
                <Endpoint method="GET" path="/api/v1/agent/tags" auth="API Key" />
              </div>

              <h3 className="text-lg font-semibold">List Posts</h3>
              <CodeBlock label="GET /api/v1/agent/posts?page=1&per_page=10">{`{
  "data": [
    {
      "id": "uuid",
      "title": "My Post",
      "slug": "my-post",
      "excerpt": "Brief summary...",
      "ai_summary": "AI-generated summary...",
      "ai_keywords": ["keyword1", "keyword2"],
      "structured_md": "# My Post\\n...",
      "reading_time": 5,
      "published_at": "2025-01-01T00:00:00Z",
      "tags": [{ "name": "go", "slug": "go" }],
      "author": { "username": "alice", "display_name": "Alice" }
    }
  ],
  "total": 42,
  "page": 1,
  "per_page": 10,
  "total_pages": 5
}`}</CodeBlock>

              <h3 className="text-lg font-semibold">Get Post</h3>
              <p className="text-sm text-muted-foreground">
                Returns the full post including <code className="rounded bg-muted px-1.5 py-0.5 text-xs">structured_md</code> for LLM consumption.
              </p>
              <CodeBlock label="GET /api/v1/agent/posts/{slug}">{`{
  "title": "My Post",
  "slug": "my-post",
  "content": "Full markdown content...",
  "structured_md": "---\\ntitle: My Post\\n---\\n# My Post\\n...",
  "ai_summary": "...",
  "ai_keywords": ["keyword1"],
  "reading_time": 5,
  "author": { "username": "alice" }
}`}</CodeBlock>

              <h3 className="text-lg font-semibold">Search Posts</h3>
              <p className="text-sm text-muted-foreground">
                Full-text search across titles, content, and AI-generated summaries using PostgreSQL&apos;s tsvector.
              </p>
              <CodeBlock label="GET /api/v1/agent/search?q=kubernetes">{`{
  "posts": [...],
  "total": 12,
  "query": "kubernetes"
}`}</CodeBlock>
            </section>

            {/* Social API */}
            <section id="social-api" className="space-y-4 scroll-mt-20">
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                <h2 className="text-2xl font-bold">Social API</h2>
              </div>
              <p className="text-muted-foreground">
                Follow authors, like and bookmark posts, and manage comments. These require JWT authentication.
              </p>

              <h3 className="text-lg font-semibold">Follows</h3>
              <div className="space-y-2">
                <Endpoint method="POST" path="/api/v1/users/{username}/follow" auth="JWT" />
                <Endpoint method="DELETE" path="/api/v1/users/{username}/follow" auth="JWT" />
                <Endpoint method="GET" path="/api/v1/users/{username}/followers" auth="Public" />
                <Endpoint method="GET" path="/api/v1/users/{username}/following" auth="Public" />
                <Endpoint method="GET" path="/api/v1/feed" auth="JWT" />
              </div>

              <h3 className="mt-4 text-lg font-semibold">Likes &amp; Bookmarks</h3>
              <div className="space-y-2">
                <Endpoint method="POST" path="/api/v1/posts/{id}/like" auth="JWT" />
                <Endpoint method="DELETE" path="/api/v1/posts/{id}/like" auth="JWT" />
                <Endpoint method="POST" path="/api/v1/posts/{id}/bookmark" auth="JWT" />
                <Endpoint method="DELETE" path="/api/v1/posts/{id}/bookmark" auth="JWT" />
                <Endpoint method="GET" path="/api/v1/users/me/liked" auth="JWT" />
                <Endpoint method="GET" path="/api/v1/users/me/bookmarks" auth="JWT" />
              </div>

              <h3 className="mt-4 text-lg font-semibold">Comments</h3>
              <div className="space-y-2">
                <Endpoint method="GET" path="/api/v1/posts/{id}/comments" auth="Public" />
                <Endpoint method="POST" path="/api/v1/posts/{id}/comments" auth="JWT" />
                <Endpoint method="PUT" path="/api/v1/comments/{id}" auth="JWT" />
                <Endpoint method="DELETE" path="/api/v1/comments/{id}" auth="JWT" />
              </div>
            </section>

            {/* Notifications API */}
            <section id="notifications-api" className="space-y-4 scroll-mt-20">
              <h2 className="text-2xl font-bold">Notifications API</h2>
              <div className="space-y-2">
                <Endpoint method="GET" path="/api/v1/notifications" auth="JWT" />
                <Endpoint method="GET" path="/api/v1/notifications/unread-count" auth="JWT" />
                <Endpoint method="POST" path="/api/v1/notifications/{id}/read" auth="JWT" />
                <Endpoint method="POST" path="/api/v1/notifications/read-all" auth="JWT" />
                <Endpoint method="GET" path="/api/v1/notifications/vapid-key" auth="Public" />
                <Endpoint method="POST" path="/api/v1/notifications/subscribe" auth="JWT" />
                <Endpoint method="POST" path="/api/v1/notifications/unsubscribe" auth="JWT" />
                <Endpoint method="GET" path="/api/v1/notifications/preferences" auth="JWT" />
                <Endpoint method="PUT" path="/api/v1/notifications/preferences" auth="JWT" />
              </div>
            </section>

            {/* Analytics API */}
            <section id="analytics-api" className="space-y-4 scroll-mt-20">
              <h2 className="text-2xl font-bold">Analytics API</h2>
              <p className="text-muted-foreground">
                Track views and get insights on your content. Distinguishes between human and AI agent views.
              </p>
              <div className="space-y-2">
                <Endpoint method="POST" path="/api/v1/posts/{slug}/view" auth="Public" />
                <Endpoint method="GET" path="/api/v1/stats/overview" auth="JWT" />
                <Endpoint method="GET" path="/api/v1/stats/timeline?days=30" auth="JWT" />
                <Endpoint method="GET" path="/api/v1/stats/top-posts?days=30" auth="JWT" />
                <Endpoint method="GET" path="/api/v1/stats/referrers?days=30" auth="JWT" />
              </div>
            </section>

            {/* MCP Server */}
            <section id="mcp-server" className="space-y-4 scroll-mt-20">
              <div className="flex items-center gap-2">
                <Server className="h-5 w-5 text-primary" />
                <h2 className="text-2xl font-bold">MCP Server</h2>
              </div>
              <p className="text-muted-foreground">
                NowBind provides an MCP (Model Context Protocol) server that lets AI assistants
                like Claude interact with your content directly via JSON-RPC.
              </p>

              <h3 className="text-lg font-semibold">Configuration</h3>
              <p className="text-sm text-muted-foreground">
                Add this to your <code className="rounded bg-muted px-1.5 py-0.5 text-xs">claude_desktop_config.json</code>:
              </p>
              <CodeBlock label="claude_desktop_config.json">{`{
  "mcpServers": {
    "nowbind": {
      "url": "${siteUrl}/api/v1/mcp",
      "headers": {
        "Authorization": "Bearer nb_your_api_key"
      }
    }
  }
}`}</CodeBlock>

              <h3 className="text-lg font-semibold">Resources</h3>
              <div className="space-y-2 rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <code className="text-sm">nowbind://posts</code>
                  <span className="text-xs text-muted-foreground">Browse all published posts</span>
                </div>
                <div className="flex items-center justify-between">
                  <code className="text-sm">nowbind://posts/&#123;slug&#125;</code>
                  <span className="text-xs text-muted-foreground">Read a specific post</span>
                </div>
                <div className="flex items-center justify-between">
                  <code className="text-sm">nowbind://tags</code>
                  <span className="text-xs text-muted-foreground">Browse all tags</span>
                </div>
              </div>

              <h3 className="text-lg font-semibold">Tools</h3>
              <div className="space-y-2 rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <code className="text-sm">search_posts</code>
                  <span className="text-xs text-muted-foreground">Full-text search across all content</span>
                </div>
                <div className="flex items-center justify-between">
                  <code className="text-sm">get_post</code>
                  <span className="text-xs text-muted-foreground">Get a specific post by slug</span>
                </div>
                <div className="flex items-center justify-between">
                  <code className="text-sm">list_posts</code>
                  <span className="text-xs text-muted-foreground">List posts with pagination</span>
                </div>
              </div>
            </section>

            {/* Rate Limits */}
            <section id="rate-limits" className="space-y-4 scroll-mt-20">
              <div className="flex items-center gap-2">
                <Terminal className="h-5 w-5 text-primary" />
                <h2 className="text-2xl font-bold">Rate Limits</h2>
              </div>
              <p className="text-muted-foreground">
                Each API key has a default rate limit of <strong>100 requests per minute</strong>.
              </p>
              <div className="rounded-lg border p-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Default limit</span>
                    <span className="font-medium">100 req/min</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status when exceeded</span>
                    <code className="text-xs">429 Too Many Requests</code>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Headers</span>
                    <code className="text-xs">X-RateLimit-*, Retry-After</code>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
