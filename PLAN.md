# NowBind Feature Parity Enhancement Plan

## Context

NowBind is a **Medium.com-style** multi-tenant blogging platform with social features (likes, follows, feed, comments). This plan brings NowBind to feature parity with leading CMS platforms on content management, editor UX, and settings.

**Exclusions:** Subscriptions/membership/newsletters/payments (different model), self-hosting/themes (multi-tenant), scheduled posts, staff/roles (personal blogs).

**Constraint:** Feature images must NOT be included in llms.txt or MCP server feeds (visual-only, not useful for AI agents).

---

## Phase 1 (P0) - Editor & Settings Enhancements

| # | Feature | Description |
|---|---------|-------------|
| 1 | Feature/Cover Image | Clickable upload area above title, full-width hero on post view |
| 2 | Featured Post Flag | Toggle in post settings sidebar, star badge on cards, filter support |
| 3 | Custom Slug Editing | Editable post URL in settings sidebar with validation |
| 4 | Post Settings Sidebar | Ghost-style slide-out panel (gear icon) with tags, excerpt, slug, featured, feature image |
| 5 | Word Count | Live word count + reading time in editor footer |
| 6 | Post List Filters | Tabs (All/Drafts/Published), tag filter, sort options |
| 7 | Enhanced Settings | Profile (avatar upload, social links), SEO metadata, notifications, account management (export, delete) |

## Phase 2 (P1) - Content Management

| # | Feature | Description |
|---|---------|-------------|
| 8 | SEO Meta per Post | meta_title, meta_description, canonical_url with SERP preview |
| 9 | Social Card Preview | Custom OG/Twitter card per post with live preview |
| 10 | Static Pages | Separate content type rendered at /page/{slug} |
| 11 | Tag Management | Dedicated CRUD page for tags |
| 12 | Comment Management | Centralized comment moderation page |

## Phase 3 (P2) - Polish & Advanced

| # | Feature | Description |
|---|---------|-------------|
| 13 | Navigation Management | Customizable nav links |
| 14 | Code Injection | Global + per-post custom HTML/JS |
| 15 | Announcement Bar | Global banner |
| 16 | Import/Export | Migration tools (WordPress/Substack/Medium) |
| 17 | Recommendations | Recommend other blogs |
| 18 | History/Audit Log | Event log of actions |

---

## Schema Changes (Phase 1)

```sql
-- Posts table
ALTER TABLE posts ADD COLUMN feature_image TEXT;
ALTER TABLE posts ADD COLUMN featured BOOLEAN DEFAULT FALSE;

-- Users table
ALTER TABLE users ADD COLUMN website TEXT;
ALTER TABLE users ADD COLUMN twitter_url TEXT;
ALTER TABLE users ADD COLUMN github_url TEXT;
ALTER TABLE users ADD COLUMN meta_title TEXT;
ALTER TABLE users ADD COLUMN meta_description TEXT;
```

## Files Modified (Phase 1)

### Backend
- `backend/internal/database/migrations/011_feature_parity.sql` - Schema changes
- `backend/internal/model/models.go` - Add fields to Post and User structs
- `backend/internal/repository/post.go` - Update queries for new columns
- `backend/internal/repository/user.go` - Update queries for new user columns
- `backend/internal/service/post.go` - Accept new fields, slug validation
- `backend/internal/handler/post.go` - Accept new fields in create/update
- `backend/internal/handler/user.go` - Export/delete endpoints, new user fields
- `backend/internal/router/router.go` - Register new routes

### Frontend
- `frontend/lib/types.ts` - Add new Post + User fields
- `frontend/components/editor/post-settings-panel.tsx` - **NEW** slide-out settings panel
- `frontend/app/(dashboard)/editor/page.tsx` - Feature image, settings panel
- `frontend/app/(dashboard)/editor/[id]/page.tsx` - Same + load existing metadata
- `frontend/app/(dashboard)/dashboard/page.tsx` - Filter tabs, thumbnails, featured badges
- `frontend/app/(dashboard)/settings/page.tsx` - Full redesign with sections
- `frontend/components/post/post-header.tsx` - Feature image hero banner
- `frontend/components/post/post-card.tsx` - Thumbnail + featured badge
- `frontend/components/editor/block-editor.tsx` - Word count display

---

## Verification Checklist

1. `go build ./...` passes
2. `npx next build` passes
3. Feature image upload works, visible in dashboard + post view, excluded from llms.txt/MCP
4. Featured toggle works, star badge appears on cards
5. Custom slug editable, post accessible at new URL
6. Settings sidebar opens/closes, all fields persist
7. Word count updates live
8. Dashboard filters work correctly
9. Settings page: avatar upload, social links, export data all work
10. Delete account flow works with confirmation
