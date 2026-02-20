# NowBind Roadmap

This document tracks planned features and their progress. Community feedback drives prioritization — open a GitHub Discussion or +1 an existing issue to influence what gets built next.

| Status | Meaning |
|--------|---------|
| 🟢 Done | Shipped and available |
| 🔵 In Progress | Actively being worked on |
| ⚪ Planned | Scoped and accepted, not yet started |

---

## v0.1.0 — Initial Launch (Released 2026-02-20)

| Status | Feature |
|--------|---------|
| 🟢 Done | Full blogging platform (multi-tenant, `/:username`) |
| 🟢 Done | TipTap block editor with rich text, code, images |
| 🟢 Done | Go 1.25 backend + chi v5 + PostgreSQL 16 |
| 🟢 Done | Next.js 16 + React 19 frontend |
| 🟢 Done | MCP server (JSON-RPC 2.0) |
| 🟢 Done | Agent REST API + API key auth |
| 🟢 Done | `llms.txt` auto-generated feed |
| 🟢 Done | Social features: likes, follows, comments, bookmarks |
| 🟢 Done | In-app + Web Push notifications |
| 🟢 Done | Per-post analytics dashboard |
| 🟢 Done | RSS 2.0, Atom 1.0, JSON Feed 1.1 |
| 🟢 Done | Full-text search (pg_trgm + tsvector) |
| 🟢 Done | Multi-auth: Google OAuth, GitHub OAuth, magic links |
| 🟢 Done | PWA: service worker, offline mode, install prompt |
| 🟢 Done | Cloudflare R2 media uploads |
| 🟢 Done | Dynamic OG image generation |
| 🟢 Done | Docker Compose dev environment |
| 🟢 Done | GitHub Actions CI/CD |

---

## v0.2.0 — Editor & Import Polish

Target: Q2 2026

| Status | Feature | Issue |
|--------|---------|-------|
| ⚪ Planned | Drag-and-drop block reorder in TipTap editor | [#1](https://github.com/niheshr/nowbind/issues/1) |
| ⚪ Planned | Medium → NowBind import tool (ZIP parser) | [#6](https://github.com/niheshr/nowbind/issues/6) |
| ⚪ Planned | Substack → NowBind import tool | [#7](https://github.com/niheshr/nowbind/issues/7) |
| ⚪ Planned | WordPress → NowBind import tool (WXR parser) | [#8](https://github.com/niheshr/nowbind/issues/8) |
| ⚪ Planned | Accessibility audit + WCAG 2.1 AA remediation | [#3](https://github.com/niheshr/nowbind/issues/3) |
| ⚪ Planned | Per-blog theme color presets (5 palettes) | [#4](https://github.com/niheshr/nowbind/issues/4) |
| ⚪ Planned | Font picker (Google Fonts + system fonts) | [#5](https://github.com/niheshr/nowbind/issues/5) |
| ⚪ Planned | Per-post SEO metadata editor + SERP preview | [#12](https://github.com/niheshr/nowbind/issues/12) |
| ⚪ Planned | Custom OG/Twitter card preview per post | [#13](https://github.com/niheshr/nowbind/issues/13) |
| ⚪ Planned | Copy-to-clipboard on code blocks | [#19](https://github.com/niheshr/nowbind/issues/19) |
| ⚪ Planned | Keyboard shortcuts in editor (Notion-style) | [#20](https://github.com/niheshr/nowbind/issues/20) |

---

## v0.3.0 — Content Types & Community

Target: Q3 2026

| Status | Feature | Issue |
|--------|---------|-------|
| ⚪ Planned | Static pages content type (`/about`, `/contact`) | [#9](https://github.com/niheshr/nowbind/issues/9) |
| ⚪ Planned | Newsletter subscribe form with Resend integration | [#10](https://github.com/niheshr/nowbind/issues/10) |
| ⚪ Planned | Reading series / collections (group posts) | [#11](https://github.com/niheshr/nowbind/issues/11) |
| ⚪ Planned | Comment emoji reactions | [#14](https://github.com/niheshr/nowbind/issues/14) |
| ⚪ Planned | Tag management CRUD page | [#15](https://github.com/niheshr/nowbind/issues/15) |
| ⚪ Planned | Comment moderation dashboard | [#16](https://github.com/niheshr/nowbind/issues/16) |
| ⚪ Planned | Multilingual UI support (i18n with next-intl) | [#2](https://github.com/niheshr/nowbind/issues/2) |

---

## v0.4.0 — Scale & Federation

Target: Q4 2026

| Status | Feature | Issue |
|--------|---------|-------|
| ⚪ Planned | Redis caching layer for hot posts | [#17](https://github.com/niheshr/nowbind/issues/17) |
| ⚪ Planned | ActivityPub / Fediverse federation | [#18](https://github.com/niheshr/nowbind/issues/18) |
| ⚪ Planned | Collaborative editing (Yjs CRDT) | — |
| ⚪ Planned | Self-hosting PaaS guides (Coolify, Caprover) | — |

---

## Beyond v0.4.0 (Backlog / Ideas)

These are not yet scheduled but have been raised by the community:

- Paid memberships / Stripe integration
- Email digest (weekly roundup of followed authors)
- Video embedding (YouTube, Vimeo, native upload)
- Audio posts / podcast player
- Custom domain mapping per blog
- Mobile app (React Native)
- Plugin / extension system

---

## Contributing to the Roadmap

Have an idea not listed here? Open a [GitHub Discussion](https://github.com/niheshr/nowbind/discussions) with the `idea` label. Well-scoped ideas get promoted to issues and added to the roadmap.

Bug reports go directly to [GitHub Issues](https://github.com/niheshr/nowbind/issues) — no discussion needed.
