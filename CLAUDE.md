# NowBind

Open-source blogging platform where every post is both a beautiful article and a structured AI-agent feed. Multi-tenant, Medium-style with social features.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Go 1.25, chi v5 router, pgx/v5 (PostgreSQL driver) |
| Frontend | Next.js 16 (App Router), React 19, TypeScript 5 |
| Database | PostgreSQL 16+ (uuid-ossp, pg_trgm extensions) |
| Styling | Tailwind CSS v4, shadcn/ui, Lucide icons |
| Editor | TipTap (block editor) with lowlight code highlighting |
| Auth | JWT (access) + HttpOnly cookie (refresh), Google & GitHub OAuth, magic links |
| Storage | Cloudflare R2 (S3-compatible) for media uploads |
| PWA | Serwist (service worker), Web Push (VAPID) |
| AI | MCP server (JSON-RPC 2.0), llms.txt, Agent REST API |

## Directory Structure

```
nowbind/
├── backend/
│   ├── cmd/server/main.go          # Entry point (-migrate flag for migrations only)
│   ├── internal/
│   │   ├── config/                  # Env config loader
│   │   ├── database/               # PostgreSQL pool + migration runner
│   │   │   └── migrations/         # 001-011 SQL migrations (idempotent)
│   │   ├── handler/                # HTTP handlers (thin, delegate to services)
│   │   ├── middleware/             # Auth, API key, CORS, logging, rate limit, security headers
│   │   ├── mcp/                    # MCP server (resources + tools)
│   │   ├── model/                  # Domain structs (single models.go)
│   │   ├── repository/            # Data access layer (one file per entity)
│   │   ├── router/                # Route definitions (chi)
│   │   ├── server/                # HTTP server setup
│   │   └── service/               # Business logic
│   ├── pkg/                        # JWT, slug, gravatar utilities
│   └── assets/                     # Static assets (logo)
│
├── frontend/
│   ├── app/
│   │   ├── (auth)/                 # Login, OAuth callback
│   │   ├── (dashboard)/            # Editor, dashboard, stats, settings, profile, notifications
│   │   ├── (main)/                 # Public: explore, post, author, search, feed, tags, docs
│   │   ├── api/og/                 # OG image generation route
│   │   ├── feed/                   # RSS/Atom/JSON feed routes
│   │   └── sw.ts                   # Service worker (Serwist)
│   ├── components/
│   │   ├── editor/                 # TipTap block editor, toolbar, bubble menu, extensions
│   │   ├── layout/                 # Navbar, footer, reading progress
│   │   ├── post/                   # Post card, content, header, code block, ToC, view tracker
│   │   ├── social/                 # Like, bookmark, follow, comment, share, notifications
│   │   ├── pwa/                    # Install prompt, offline status, SW register
│   │   ├── search/                 # Search dialog (cmdk)
│   │   ├── theme/                  # Dark/light mode (next-themes)
│   │   └── ui/                     # shadcn/ui primitives
│   └── lib/
│       ├── api.ts                  # API client with auto token refresh
│       ├── auth-context.tsx        # React auth context provider
│       ├── constants.ts            # API_URL, SITE_URL, limits
│       ├── types.ts                # TypeScript interfaces matching Go models
│       ├── utils.ts                # cn() helper (clsx + tailwind-merge)
│       └── hooks/                  # Custom hooks (auth, social, media, notifications, autosave)
│
├── scripts/                        # Content migration scripts
├── docker-compose.yml              # PostgreSQL 16
├── Makefile                        # Dev commands
└── PLAN.md                         # Feature roadmap
```

## Build & Run

```bash
# Backend
cd backend && go build ./...                    # Verify compilation
cd backend && go run ./cmd/server               # Run (auto-migrates)
cd backend && go run ./cmd/server -migrate      # Migrate only

# Frontend
cd frontend && npm install                       # Install deps
cd frontend && npm run build -- --webpack        # Production build
cd frontend && npm run dev                       # Dev server (port 3000)
cd frontend && npm run lint                      # ESLint

# Both (from root)
make dev                                         # DB + backend + frontend
make build-backend                               # Go binary
make build-frontend                              # Next.js build
```

## Architecture Patterns

- **Repository/Service/Handler**: Backend uses a layered architecture. Repositories handle SQL, services hold business logic, handlers are thin HTTP adapters.
- **Dependency injection via constructor**: `router.New()` wires all repos -> services -> handlers.
- **API client with token refresh**: `lib/api.ts` auto-retries on 401 using refresh token mutex to prevent concurrent refreshes. Uses `credentials: "include"` for HttpOnly cookies.
- **OptionalAuth middleware**: Public endpoints use `OptionalAuth` to enrich responses with user-specific data (is_liked, is_bookmarked, is_following) when a JWT is present.
- **Social enrichment**: `SocialHandler.EnrichPostSlice()` adds like/bookmark/follow state to post lists for the current user.
- **Next.js rewrites**: Frontend proxies `/api/*`, `/health`, `/llms.txt`, `/mcp` to the Go backend via `next.config.ts` rewrites. This means the frontend URL is the single entry point.
- **Server Components by default**: Only use `"use client"` when client interactivity is needed.
- **Content format dual support**: Posts have `content` (markdown) and `content_json` (TipTap JSON), with `content_format` field to distinguish.

## Database Migrations

Migrations are in `backend/internal/database/migrations/` and run automatically on startup (idempotent).

| File | Description |
|------|-------------|
| `001_initial.sql` | users, posts, tags, post_tags |
| `002_sessions.sql` | sessions, magic_links |
| `003_api_keys.sql` | api_keys |
| `004_analytics.sql` | post_views, post_stats |
| `005_search.sql` | tsvector + GIN/trigram indexes, search trigger |
| `006_social.sql` | follows, post_likes, comments, bookmarks, notifications, push_subscriptions, notification_preferences |
| `007_tracking.sql` | login_logs, api_key_usage |
| `008_usage_detail.sql` | detail column on api_key_usage |
| `009_ai_views.sql` | source/user_agent on post_views, ai_view_count |
| `010_tiptap_content.sql` | content_json (JSONB), content_format, media table |
| `011_feature_parity.sql` | feature_image, featured flag, user social links + SEO metadata |

New migrations: use `NNN_description.sql` format with `IF NOT EXISTS`/`IF EXISTS` for idempotency. Never modify merged migrations.

## Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | Min 32 chars HMAC signing key |
| `FRONTEND_URL` | Yes | Frontend origin for CORS + redirects |
| `PORT` | No | Server port (default: 8080) |
| `DB_MODE` | No | "local" or "neon" (auto-detected from URL) |
| `ENVIRONMENT` | No | "development" or "production" |
| `COOKIE_DOMAIN` | No | Cross-subdomain cookie sharing |
| `GOOGLE_CLIENT_ID` | No | Google OAuth |
| `GOOGLE_CLIENT_SECRET` | No | Google OAuth |
| `GITHUB_CLIENT_ID` | No | GitHub OAuth |
| `GITHUB_CLIENT_SECRET` | No | GitHub OAuth |
| `EMAIL_SENDER` | No | Gmail address for magic links |
| `GMAIL_CLIENT_ID` | No | Defaults to GOOGLE_CLIENT_ID |
| `GMAIL_CLIENT_SECRET` | No | Defaults to GOOGLE_CLIENT_SECRET |
| `GMAIL_REFRESH_TOKEN` | No | Gmail OAuth2 refresh token |
| `VAPID_PUBLIC_KEY` | No | Web Push public key |
| `VAPID_PRIVATE_KEY` | No | Web Push private key |
| `R2_ACCOUNT_ID` | No | Cloudflare R2 |
| `R2_ACCESS_KEY_ID` | No | Cloudflare R2 |
| `R2_SECRET_KEY` | No | Cloudflare R2 |
| `R2_BUCKET_NAME` | No | Cloudflare R2 |
| `R2_PUBLIC_URL` | No | Cloudflare R2 public URL |

### Frontend (`frontend/.env.local`)

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Yes | Backend API URL (e.g., `http://localhost:8080/api/v1`) |
| `NEXT_PUBLIC_SITE_URL` | Yes | Frontend URL (e.g., `http://localhost:3000`) |
| `BACKEND_URL` | No | Backend root for SSR rewrites (default: `http://localhost:8080`) |

## Coding Conventions

### Go (Backend)
- Standard `gofmt` formatting
- Repository pattern: one file per entity in `repository/`
- Handlers are thin; business logic in `service/`
- Errors wrapped with context: `fmt.Errorf("doing thing: %w", err)`
- UUIDs for all primary keys (uuid-ossp extension)
- JSON field names use snake_case
- Sensitive fields tagged `json:"-"` (email, oauth_id, key_hash)

### TypeScript (Frontend)
- Next.js App Router with route groups: `(auth)`, `(dashboard)`, `(main)`
- `"use client"` only when needed (interactive components)
- shadcn/ui for all UI primitives
- Tailwind CSS for styling (no custom CSS unless necessary)
- `cn()` utility for conditional class merging
- Types in `lib/types.ts` mirror Go models with snake_case fields
- API calls via `lib/api.ts` singleton (`api.get()`, `api.post()`, etc.)
- Toast notifications via `sonner`
- Icons from `lucide-react`

## Recent Changes (Feature Parity Phase 1)

- TipTap block editor replacing markdown editor (content_json + content_format support)
- Feature images with Cloudflare R2 upload
- Featured post toggle with star badges
- Custom slug editing in post settings sidebar
- Post settings panel (Ghost-style slide-out)
- Live word count in editor
- Dashboard filters (All/Drafts/Published), sort, search
- Enhanced settings page (social links, SEO metadata, export data, delete account)
- Media upload service via Cloudflare R2
- Security headers middleware
- Autosave hook for editor
