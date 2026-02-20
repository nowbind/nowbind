# Changelog

All notable changes to NowBind will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-02-20

### Added

#### Core Platform
- Full multi-tenant blogging platform: each user gets their own blog at `/:username`
- TipTap block editor with rich text formatting, code blocks (with syntax highlighting via lowlight), images, embeds, and more
- Dual content format support: TipTap JSON (`content_json`) and Markdown (`content`) with `content_format` field
- Feature images per post with drag-and-drop upload
- Featured post toggle with star badge display on post cards
- Custom slug editing per post
- Live word count display in editor
- Ghost-style post settings slide-out panel

#### Go Backend (`backend/`)
- Go 1.25 HTTP server powered by `chi v5` router
- Repository / Service / Handler layered architecture
- PostgreSQL 16 via `pgx/v5` with connection pooling
- 11 idempotent SQL migrations covering all entities (users, posts, tags, sessions, analytics, social, tracking, media)
- UUID primary keys (`uuid-ossp` extension)
- `pg_trgm` + `tsvector` full-text search with GIN indexes
- JWT access tokens + HttpOnly cookie refresh tokens
- Google OAuth 2.0 and GitHub OAuth login
- Magic link (passwordless) email authentication via Gmail OAuth2
- Rate limiting, security headers, CORS middleware
- Request logging middleware

#### Next.js Frontend (`frontend/`)
- Next.js 16 App Router with React 19 and TypeScript 5
- Route groups: `(auth)`, `(dashboard)`, `(main)`
- Tailwind CSS v4 + shadcn/ui component library + Lucide icons
- Dark / light mode toggle via `next-themes`
- API client (`lib/api.ts`) with automatic token refresh (mutex prevents concurrent refreshes)
- `OptionalAuth` pattern: public endpoints return user-specific enrichment (is_liked, is_bookmarked, is_following) when a JWT is present

#### AI-First Features
- MCP server (JSON-RPC 2.0) at `/mcp` — expose blog content as AI agent resources and tools
- Agent REST API with API key authentication and per-key usage tracking
- `llms.txt` endpoint auto-generated from blog content (served by Go backend, proxied by Next.js)

#### Social Features
- Post likes with real-time count
- Author following / unfollower
- Nested comments with threading
- Post bookmarks
- In-app notification system (likes, comments, follows, mentions)
- Web Push notifications via VAPID + Serwist service worker
- Share post (native Web Share API + clipboard fallback)

#### Analytics
- Per-post view tracking with source and user-agent capture
- AI view count separated from human view count
- Per-post stats dashboard (views over time, top referrers)
- Login logs and API key usage logs

#### Feeds & Discovery
- RSS 2.0 feed per blog and site-wide
- Atom 1.0 feed per blog and site-wide
- JSON Feed 1.1 per blog and site-wide
- Full-text search with `cmdk` command palette UI
- Explore / trending posts page
- Tag pages aggregating posts by tag

#### Media & Storage
- Cloudflare R2 (S3-compatible) media upload service
- Image uploads directly from the editor
- Feature image upload with preview
- Public URL served via R2 custom domain

#### PWA
- Progressive Web App via Serwist service worker (`app/sw.ts`)
- Web App Manifest for installability
- Offline status indicator
- Install prompt component

#### Auth & User Settings
- User profile page (`/:username`) with bio, social links, follower/following counts
- Settings page: display name, bio, avatar, social links, SEO metadata
- Data export (JSON download of all posts and profile data)
- Account deletion

#### OG / SEO
- Dynamic OG image generation (`/api/og`) using `@vercel/og`
- Per-user SEO metadata (og_title, og_description, twitter_handle)
- Structured JSON-LD data on post pages
- Sitemap generation

#### Infrastructure
- `docker-compose.yml` for local development (PostgreSQL 16)
- `Makefile` with `dev`, `dev-backend`, `dev-frontend`, `db`, `db-down`, `migrate`, `build-backend`, `build-frontend`, `lint`, `clean` targets
- GitHub Actions CI pipeline (lint, build, test)
- AGPL-3.0 license

[Unreleased]: https://github.com/niheshr/nowbind/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/niheshr/nowbind/releases/tag/v0.1.0
