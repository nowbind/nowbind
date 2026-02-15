# NowBind

The open-source blogging platform where every post is both a beautiful article and a structured AI-agent feed.

## Features

### Core Platform
- **Rich Markdown Editor** with live preview, syntax highlighting, and GitHub Flavored Markdown
- **AI-Native Content** -- every post generates AI summaries, keywords, and structured markdown for LLM consumption
- **Full-Text Search** powered by PostgreSQL tsvector with fuzzy matching suggestions
- **Tag System** with post counts and tag-based browsing
- **Reading Time Estimation** for all posts
- **SEO Optimized** with Open Graph, Twitter Cards, JSON-LD schemas, and canonical URLs

### Authentication
- **OAuth** -- Google and GitHub sign-in
- **Magic Link** -- passwordless email authentication via Gmail SMTP
- **JWT + Refresh Tokens** with automatic token rotation and concurrent refresh protection
- **Cookie-based sessions** with HttpOnly secure cookies

### Social Features
- **Follow System** -- follow authors, personalized feed of posts from followed users
- **Likes** -- simple toggle likes with optimistic UI updates
- **Bookmarks** -- save posts to a reading list
- **Threaded Comments** -- nested comment threads with edit/delete capabilities
- **Notifications** -- in-app notifications for follows, likes, and comments with unread badge
- **Web Push Notifications** -- optional browser push notifications via VAPID/Web Push
- **Share Buttons** -- copy link, share to X (Twitter), LinkedIn

### Analytics
- **View Tracking** -- total views, unique visitors, referrer tracking
- **AI vs Human Views** -- distinguishes between web visitors and AI agent access
- **Stats Dashboard** -- overview cards, timeline, top posts, referrer breakdown
- **Per-Post Analytics** -- view counts, like counts per post

### AI & Agent Integration
- **Agent API** -- RESTful API for AI agents with API key authentication
- **MCP Server** -- Model Context Protocol server for Claude and other AI assistants
- **llms.txt** -- follows the llmstxt.org specification for AI-readable site indexes
- **Structured Markdown** -- YAML frontmatter + content for machine consumption

### PWA (Progressive Web App)
- **Installable** -- add to home screen on mobile and desktop
- **Offline Support** -- cached pages and offline fallback
- **Service Worker** -- background caching with Serwist

### Other Features
- **Gravatar Avatars** -- automatic avatar from Gravatar with identicon fallback
- **RSS/Atom/JSON Feeds** -- standard feed formats for readers
- **Dark Mode** -- system-aware theme with manual toggle
- **Responsive Design** -- mobile-first layout
- **Custom 404 Page** -- branded not-found page
- **Trending Posts** -- algorithmically sorted by recent views and likes
- **Related Posts** -- tag-based post recommendations

## Tech Stack

### Backend
- **Go** (1.25+) with chi v5 router
- **PostgreSQL** with pgx/v5 driver
- **JWT** authentication with golang-jwt/v5
- **Web Push** via webpush-go
- **Gmail SMTP** with OAuth2 for transactional email

### Frontend
- **Next.js 16** with App Router and React 19
- **TypeScript**
- **Tailwind CSS v4** with shadcn/ui (new-york style)
- **Serwist** for PWA/service worker
- **Lucide** icons
- **React Markdown** with syntax highlighting

## Project Structure

```
nowbind/
├── backend/
│   ├── cmd/server/          # Entry point
│   ├── internal/
│   │   ├── config/          # Environment config
│   │   ├── database/        # PostgreSQL connection + migrations
│   │   ├── handler/         # HTTP handlers (auth, post, social, notifications, analytics)
│   │   ├── middleware/      # Auth, API key, CORS, logging
│   │   ├── mcp/            # MCP JSON-RPC server
│   │   ├── model/          # Domain models
│   │   ├── repository/     # Data access layer
│   │   ├── router/         # Route definitions
│   │   ├── server/         # HTTP server setup
│   │   └── service/        # Business logic
│   └── pkg/                # JWT, slug, gravatar utilities
│
├── frontend/
│   ├── app/                # Next.js App Router pages
│   ├── components/
│   │   ├── layout/         # Navbar, Footer
│   │   ├── post/           # PostCard, PostHeader, PostContent, RelatedPosts, ViewTracker
│   │   ├── social/         # FollowButton, LikeButton, BookmarkButton, Comments, Notifications, Share
│   │   ├── pwa/            # InstallPrompt
│   │   └── ui/             # shadcn/ui components
│   └── lib/
│       ├── api.ts           # API client with refresh mutex
│       ├── auth-context.tsx  # Centralized auth state
│       ├── hooks/           # useAuth, useSocial, useNotifications, usePushNotifications
│       └── types.ts         # TypeScript interfaces
```

## Getting Started

### Prerequisites
- Go 1.25+
- Node.js 20+
- PostgreSQL 15+

### 1. Clone and Install

```bash
git clone https://github.com/nowbind/nowbind.git
cd nowbind
```

### 2. Backend Setup

```bash
cd backend
cp .env.example .env
# Edit .env with your database URL and secrets
go mod download
go run cmd/server/main.go -migrate  # Run migrations
go run cmd/server/main.go           # Start server on :8080
```

### 3. Frontend Setup

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev  # Start dev server on :3000
```

### 4. Environment Variables

#### Backend (.env)
```bash
# Required
DATABASE_URL=postgres://user:pass@localhost:5432/nowbind?sslmode=disable
JWT_SECRET=your-secret-key-at-least-32-chars
FRONTEND_URL=http://localhost:3000

# OAuth (optional)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...

# Email (optional)
EMAIL_SENDER=your@gmail.com
GMAIL_CLIENT_ID=...
GMAIL_CLIENT_SECRET=...
GMAIL_REFRESH_TOKEN=...

# Web Push (optional)
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
```

#### Frontend (.env.local)
```bash
NEXT_PUBLIC_API_URL=http://localhost:8080/api/v1
NEXT_PUBLIC_SITE_URL=http://localhost:3000
BACKEND_URL=http://localhost:8080
```

## Generating VAPID Keys

VAPID keys are required for web push notifications. Generate them with:

```bash
# Option 1: npx (recommended)
npx web-push generate-vapid-keys

# Option 2: Go
go run github.com/nickvdyck/vapid-key-generator@latest
```

This outputs a public key and private key. Set them in your backend `.env`:

```bash
VAPID_PUBLIC_KEY=BEl62iUYgU...  # The public key
VAPID_PRIVATE_KEY=...            # The private key
```

The frontend automatically fetches the public key from the backend's `/api/v1/notifications/vapid-key` endpoint -- no frontend-side configuration needed.

## API Documentation

Visit `/docs` on your running instance for the full interactive API documentation, or see the endpoints summary below.

### Agent API (API Key Auth)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/agent/posts` | List published posts |
| GET | `/api/v1/agent/posts/{slug}` | Get post as structured markdown |
| GET | `/api/v1/agent/search?q=` | Full-text search |
| GET | `/api/v1/agent/tags` | List all tags |

### MCP Server
Configure Claude or other MCP-compatible AI assistants:

```json
{
  "mcpServers": {
    "nowbind": {
      "url": "https://your-instance.com/api/v1/mcp",
      "headers": {
        "Authorization": "Bearer nb_your_api_key"
      }
    }
  }
}
```

## Database Migrations

Migrations run automatically on startup. To run manually:

```bash
cd backend
go run cmd/server/main.go -migrate
```

Migration files are in `backend/internal/database/migrations/`:
- `001_initial.sql` -- Users, posts, tags
- `002_sessions.sql` -- Auth sessions, magic links
- `003_api_keys.sql` -- API key management
- `004_analytics.sql` -- View tracking, stats
- `005_search.sql` -- Full-text search with tsvector
- `006_social.sql` -- Follows, likes, comments, bookmarks, notifications, push subscriptions

## License

Open source. See LICENSE file for details.
