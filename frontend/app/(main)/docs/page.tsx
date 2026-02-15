import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "API Documentation",
  description: "NowBind Agent API, MCP Server, and API key documentation.",
};

export default function DocsPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <article className="prose prose-neutral dark:prose-invert mx-auto max-w-3xl px-4 py-8">
          <h1>API Documentation</h1>

          <h2 id="getting-started">Getting Started</h2>
          <p>
            The NowBind Agent API lets AI agents and applications read posts,
            search content, and browse tags programmatically. Every published
            post is available as both a human-readable article and a structured
            AI-agent feed.
          </p>
          <p>
            To get started, create an API key from your{" "}
            <Link href="/api-keys">API Keys</Link> page.
          </p>

          <h2 id="authentication">Authentication</h2>
          <p>
            Authenticate requests by including your API key in the{" "}
            <code>Authorization</code> header:
          </p>
          <pre><code>{`curl -H "Authorization: Bearer nb_your_api_key" \\
  ${process.env.NEXT_PUBLIC_SITE_URL || "https://nowbind.com"}/api/v1/agent/posts`}</code></pre>
          <p>
            API keys use the <code>nb_</code> prefix. Keep your keys secure and
            never expose them in client-side code.
          </p>

          <h2 id="agent-api">Agent API Endpoints</h2>

          <h3>List Posts</h3>
          <pre><code>{`GET /api/v1/agent/posts?page=1&per_page=10

Response:
{
  "data": [
    {
      "id": "...",
      "title": "My Post",
      "slug": "my-post",
      "excerpt": "...",
      "ai_summary": "...",
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
}`}</code></pre>

          <h3>Get Post</h3>
          <pre><code>{`GET /api/v1/agent/posts/{slug}

Returns the full post object including structured_md for LLM consumption.`}</code></pre>

          <h3>Search Posts</h3>
          <pre><code>{`GET /api/v1/agent/search?q=kubernetes&page=1&per_page=10

Full-text search across titles, content, and AI-generated summaries.`}</code></pre>

          <h3>List Tags</h3>
          <pre><code>{`GET /api/v1/agent/tags

Returns all tags with post counts.`}</code></pre>

          <h2 id="mcp-server">MCP Server</h2>
          <p>
            NowBind provides an MCP (Model Context Protocol) server that lets AI
            assistants like Claude interact with your content directly.
          </p>

          <h3>Configuration</h3>
          <p>
            Add this to your <code>claude_desktop_config.json</code>:
          </p>
          <pre><code>{`{
  "mcpServers": {
    "nowbind": {
      "url": "${process.env.NEXT_PUBLIC_SITE_URL || "https://nowbind.com"}/api/v1/mcp",
      "headers": {
        "Authorization": "Bearer nb_your_api_key"
      }
    }
  }
}`}</code></pre>

          <h3>Available Resources</h3>
          <ul>
            <li><code>posts://list</code> — Browse all published posts</li>
            <li><code>posts://&#123;slug&#125;</code> — Read a specific post</li>
            <li><code>tags://list</code> — Browse all tags</li>
          </ul>

          <h3>Available Tools</h3>
          <ul>
            <li><code>search_posts</code> — Full-text search across all content</li>
            <li><code>get_post</code> — Get a specific post by slug</li>
            <li><code>list_posts</code> — List posts with pagination</li>
          </ul>

          <h2 id="rate-limits">Rate Limits</h2>
          <p>
            Each API key has a default rate limit of <strong>100 requests per minute</strong>.
            When exceeded, the API returns <code>429 Too Many Requests</code>.
            The response includes <code>Retry-After</code> and{" "}
            <code>X-RateLimit-*</code> headers.
          </p>
        </article>
      </main>
      <Footer />
    </div>
  );
}
