<p align="center">
  <img src="frontend/public/logos/n.-dark.svg" alt="NowBind" height="48" />
</p>

<h3 align="center">Write for humans. Feed the machines.</h3>

<p align="center">
  The open-source blogging platform where every post is both a beautiful article and a structured AI-agent feed.
</p>

<p align="center">
  <a href="https://github.com/nowbind/nowbind/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-AGPL--3.0-blue" alt="License" /></a>
  <img src="https://img.shields.io/badge/Go-1.26-00ADD8?logo=go&logoColor=white" alt="Go" />
  <img src="https://img.shields.io/badge/Next.js-16-000?logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/PostgreSQL-17-4169E1?logo=postgresql&logoColor=white" alt="PostgreSQL" />
</p>

---

## What is NowBind?

Most blogging platforms treat AI as an afterthought. NowBind is built from the ground up so every published post automatically becomes:

- A beautifully rendered article for readers
- Structured markdown with YAML frontmatter for LLMs
- AI summaries and keywords for agent consumption
- An MCP resource for Claude and other AI assistants
- An `llms.txt` entry following the [llmstxt.org](https://llmstxt.org) spec

Your blog becomes a knowledge base that both people and AI can read, search, and reference.

## Features

**Writing** -- Markdown editor with live preview, GFM support, tags, drafts, reading time estimation, and full-text search (PostgreSQL tsvector + trigram fuzzy matching).

**Auth** -- Google & GitHub OAuth, passwordless magic links via Gmail, JWT + refresh tokens with HttpOnly cookies.

**Social** -- Follow authors, likes, bookmarks, threaded comments, personalized feed, in-app + browser push notifications (VAPID/Web Push), share buttons.

**Analytics** -- View tracking, unique visitors, AI vs human classification, stats dashboard with timeline/top posts/referrers.

**AI Integration** -- Agent REST API (API key auth), MCP server (JSON-RPC 2.0), `llms.txt` / `llms-full.txt`, structured markdown output.

**PWA** -- Installable, offline fallback, service worker caching (Serwist), push notifications.

**Feeds** -- RSS 2.0, Atom 1.0, JSON Feed 1.1.

**SEO** -- Open Graph, Twitter Cards, JSON-LD, canonical URLs, dynamic sitemap, robots.txt.

## Why Switch from Medium to NowBind?

- **Own your stack**: self-hostable codebase, open data model, no platform lock-in.
- **Own your content**: import Medium exports and publish from your own domain and database.
- **AI-native publishing**: every post is readable for humans and consumable by agents via MCP, Agent API, and `llms.txt`.
- **Extensible by design**: OSS roadmap, public issues/discussions, and contributor-friendly architecture.

Migration guide: [`docs/launch/migrate-from-medium.md`](docs/launch/migrate-from-medium.md)  
In-app migration page: `/docs/migrate`

## Tech Stack

| | Backend | Frontend |
|---|---|---|
| **Language** | Go 1.25 | TypeScript 5 |
| **Framework** | chi v5 | Next.js 16 (App Router), React 19 |
| **Database** | PostgreSQL 16 (pgx/v5) | -- |
| **Styling** | -- | Tailwind CSS v4, shadcn/ui |
| **Auth** | JWT, OAuth2, magic links | Cookie-based sessions |
| **Other** | webpush-go, Gmail OAuth2 SMTP | Serwist (PWA), Lucide icons, react-markdown |

## Quick Start

### Prerequisites

- Go 1.25+, Node.js 20+, PostgreSQL 15+ (running on your host)

### 1. Clone & set up

```bash
git clone https://github.com/nowbind/nowbind.git
cd nowbind
```

### 2. Start PostgreSQL locally

Make sure your host Postgres service is running and accessible on port `5432`.
NowBind does not manage Postgres as a Docker service in this repo.

### 3. Run the backend

```bash
cd backend
cp .env.example .env    # edit with your config
go mod download
go run cmd/server/main.go -migrate
go run cmd/server/main.go
```

### 4. Run the frontend

```bash
cd frontend
npm install
```

Create `frontend/.env.local`:

```
NEXT_PUBLIC_API_URL=http://localhost:8080/api/v1
NEXT_PUBLIC_SITE_URL=http://localhost:3000
BACKEND_URL=http://localhost:8080
```

```bash
npm run dev
```

Or use `make dev` from the project root to run backend + frontend once Postgres is already running.

## Environment Variables

### Backend (`.env`)

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | Min 32 chars for HMAC signing |
| `FRONTEND_URL` | Yes | Frontend origin (CORS + redirects) |
| `PORT` | No | Server port (default: `8080`) |
| `GOOGLE_CLIENT_ID` | No | Google OAuth |
| `GOOGLE_CLIENT_SECRET` | No | Google OAuth |
| `GITHUB_CLIENT_ID` | No | GitHub OAuth |
| `GITHUB_CLIENT_SECRET` | No | GitHub OAuth |
| `EMAIL_SENDER` | No | Gmail address for magic links |
| `GMAIL_REFRESH_TOKEN` | No | Gmail OAuth2 refresh token |
| `VAPID_PUBLIC_KEY` | No | Web push (generate with `npx web-push generate-vapid-keys`) |
| `VAPID_PRIVATE_KEY` | No | Web push |

### Frontend (`.env.local`)

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Yes | Backend API URL |
| `NEXT_PUBLIC_SITE_URL` | Yes | Frontend URL |
| `BACKEND_URL` | Yes | Backend root URL (for SSR) |

OAuth, email, and push are all optional -- the platform works without them.

## Project Structure

```
nowbind/
├── backend/
│   ├── cmd/server/           # Entry point
│   ├── internal/
│   │   ├── config/           # Env config
│   │   ├── database/         # PostgreSQL + migrations (7 files)
│   │   ├── handler/          # HTTP handlers
│   │   ├── middleware/       # Auth, API key, CORS, logging
│   │   ├── mcp/              # MCP server (JSON-RPC 2.0)
│   │   ├── model/            # Domain models
│   │   ├── repository/       # Data access layer
│   │   ├── router/           # Route definitions
│   │   └── service/          # Business logic
│   └── pkg/                  # JWT, slug, gravatar utils
│
├── frontend/
│   ├── app/                  # Next.js App Router
│   │   ├── (main)/           # Public: explore, post, author, docs, search
│   │   ├── (auth)/           # Login, OAuth callback
│   │   ├── (dashboard)/      # Editor, stats, settings, notifications
│   │   └── sw.ts             # Service worker
│   ├── components/           # Layout, post, social, PWA, UI (shadcn)
│   └── lib/                  # API client, auth context, hooks, types
│
├── docker-compose.yml
├── Makefile
├── API_TESTING.md
├── CONTRIBUTING.md
├── NOTICE
└── LICENSE
```

## Agent API

AI-optimized endpoints with API key auth. Create keys from the dashboard or `/api-keys` page.

```bash
curl -H "Authorization: Bearer nb_your_api_key" \
  https://nowbind.niheshr.com/api/v1/agent/posts
```

| Endpoint | Description |
|---|---|
| `GET /api/v1/agent/posts` | List posts with AI metadata |
| `GET /api/v1/agent/posts/{slug}` | Full post as structured markdown |
| `GET /api/v1/agent/search?q=` | Full-text search |
| `GET /api/v1/agent/authors` | List authors |
| `GET /api/v1/agent/tags` | List tags |

## MCP Server

NowBind exposes an [MCP](https://modelcontextprotocol.io) server for AI assistants like Claude.

```json
{
  "mcpServers": {
    "nowbind": {
      "url": "https://nowbind.niheshr.com/mcp/",
      "headers": {
        "Authorization": "Bearer nb_your_api_key"
      }
    }
  }
}
```

**Resources:** `nowbind://posts`, `nowbind://posts/{slug}`, `nowbind://authors`, `nowbind://tags`, `nowbind://feed`

**Tools:** `search_posts`, `get_post`, `list_posts`, `get_author`

## API Endpoints

Full interactive docs at `/docs` on any running instance.

<details>
<summary><strong>Auth</strong></summary>

| Method | Endpoint | Auth |
|---|---|---|
| POST | `/api/v1/auth/magic-link` | -- |
| GET | `/api/v1/auth/magic-link/verify` | -- |
| POST | `/api/v1/auth/refresh` | Cookie |
| POST | `/api/v1/auth/logout` | Cookie |
| GET | `/api/v1/auth/me` | JWT |
| GET | `/api/v1/auth/oauth/google` | -- |
| GET | `/api/v1/auth/oauth/github` | -- |

</details>

<details>
<summary><strong>Posts</strong></summary>

| Method | Endpoint | Auth |
|---|---|---|
| GET | `/api/v1/posts` | Optional |
| GET | `/api/v1/posts/trending` | Optional |
| GET | `/api/v1/posts/{slug}` | Optional |
| GET | `/api/v1/posts/{slug}/related` | Optional |
| POST | `/api/v1/posts/{slug}/view` | -- |
| POST | `/api/v1/posts` | JWT |
| PUT | `/api/v1/posts/{id}` | JWT |
| DELETE | `/api/v1/posts/{id}` | JWT |
| POST | `/api/v1/posts/{id}/publish` | JWT |
| POST | `/api/v1/posts/{id}/unpublish` | JWT |

</details>

<details>
<summary><strong>Social</strong></summary>

| Method | Endpoint | Auth |
|---|---|---|
| POST | `/api/v1/posts/{id}/like` | JWT |
| DELETE | `/api/v1/posts/{id}/like` | JWT |
| POST | `/api/v1/posts/{id}/bookmark` | JWT |
| DELETE | `/api/v1/posts/{id}/bookmark` | JWT |
| GET | `/api/v1/posts/{id}/comments` | -- |
| POST | `/api/v1/posts/{id}/comments` | JWT |
| PUT | `/api/v1/comments/{id}` | JWT |
| DELETE | `/api/v1/comments/{id}` | JWT |
| POST | `/api/v1/users/{username}/follow` | JWT |
| DELETE | `/api/v1/users/{username}/follow` | JWT |
| GET | `/api/v1/users/{username}/followers` | Optional |
| GET | `/api/v1/users/{username}/following` | Optional |
| GET | `/api/v1/feed` | JWT |

</details>

<details>
<summary><strong>Users</strong></summary>

| Method | Endpoint | Auth |
|---|---|---|
| GET | `/api/v1/users/{username}` | Optional |
| GET | `/api/v1/users/{username}/posts` | Optional |
| PUT | `/api/v1/users/me` | JWT |
| GET | `/api/v1/users/me/posts` | JWT |
| GET | `/api/v1/users/me/liked` | JWT |
| GET | `/api/v1/users/me/bookmarks` | JWT |

</details>

<details>
<summary><strong>Notifications</strong></summary>

| Method | Endpoint | Auth |
|---|---|---|
| GET | `/api/v1/notifications` | JWT |
| GET | `/api/v1/notifications/unread-count` | JWT |
| POST | `/api/v1/notifications/{id}/read` | JWT |
| POST | `/api/v1/notifications/read-all` | JWT |
| GET | `/api/v1/notifications/vapid-key` | -- |
| POST | `/api/v1/notifications/subscribe` | JWT |
| POST | `/api/v1/notifications/unsubscribe` | JWT |
| GET | `/api/v1/notifications/preferences` | JWT |
| PUT | `/api/v1/notifications/preferences` | JWT |

</details>

<details>
<summary><strong>Analytics, Tags, Search, Feeds, API Keys</strong></summary>

| Method | Endpoint | Auth |
|---|---|---|
| GET | `/api/v1/stats/overview` | JWT |
| GET | `/api/v1/stats/timeline?days=30` | JWT |
| GET | `/api/v1/stats/top-posts?days=30` | JWT |
| GET | `/api/v1/stats/referrers?days=30` | JWT |
| GET | `/api/v1/tags` | -- |
| GET | `/api/v1/tags/{slug}/posts` | -- |
| GET | `/api/v1/search?q=` | -- |
| GET | `/api/v1/search/suggest?q=` | -- |
| GET | `/api/v1/feeds/rss` | -- |
| GET | `/api/v1/feeds/atom` | -- |
| GET | `/api/v1/feeds/json` | -- |
| GET | `/llms.txt` | -- |
| GET | `/llms-full.txt` | -- |
| POST | `/api/v1/api-keys` | JWT |
| GET | `/api/v1/api-keys` | JWT |
| DELETE | `/api/v1/api-keys/{id}` | JWT |

</details>

## Database

Migrations run automatically on startup (idempotent). Run manually with:

```bash
cd backend && go run cmd/server/main.go -migrate
```

| Migration | Tables |
|---|---|
| `001_initial` | `users`, `posts`, `tags`, `post_tags` |
| `002_sessions` | `sessions`, `magic_links` |
| `003_api_keys` | `api_keys` |
| `004_analytics` | `post_views`, `post_stats` |
| `005_search` | tsvector + GIN/trigram indexes |
| `006_social` | `follows`, `post_likes`, `comments`, `bookmarks`, `notifications`, `push_subscriptions`, `notification_preferences` |
| `007_tracking` | `login_logs`, `api_key_usage` |

Neon databases are auto-detected and configured with appropriate pooling.

## Development

```bash
make dev              # Start backend + frontend (requires local Postgres)
make dev-backend      # Go backend
make dev-frontend     # Next.js dev server
make db               # Reminder: Postgres is host-managed
make migrate          # Run migrations
make build-backend    # Build Go binary
make build-frontend   # Build Next.js
make lint             # Lint frontend
make clean            # Clean build artifacts
```

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting a PR.

## License

[GNU Affero General Public License v3.0](LICENSE) — this is copyleft software. If you modify and host NowBind as a network service, you must release your modifications under AGPL-3.0. See the [NOTICE](NOTICE) file for attribution requirements.
