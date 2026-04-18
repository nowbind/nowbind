# Contributing to NowBind

Thanks for your interest in contributing to NowBind! This document outlines the process for contributing.

## Getting Started

1. **Fork the repo** and clone it locally
2. **Set up the dev environment** — see the [README](README.md) for instructions
3. **Create a branch** from `main` for your work: `git checkout -b feature/your-feature`

## Development Setup

No OAuth keys, email credentials, or third-party accounts are needed to run NowBind locally.

### Prerequisites

- Go 1.25+, Node.js 20+, PostgreSQL 15+ (running on your host)

### 1. Backend

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env` and set `JWT_SECRET` (min 32 characters).
If you want one-click local sign-in, also set `DEV_LOGIN=true`:

```
JWT_SECRET=your-secret-key-at-least-32-characters-long
DEV_LOGIN=true
```

```bash
go mod download
go run cmd/server/main.go    # auto-runs migrations, starts on :8080
```

### 2. Frontend

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev                  # starts on :3000
```

### 3. Log in with Dev Login

Open `http://localhost:3000/login`. Enter a username in the dev login field, then click **"Dev Login (no keys needed)"**. Each username maps to its own dev account, so you can switch between multiple local users for testing views/stats.

> Dev Login is only available when the backend has `DEV_LOGIN=true` (exact lowercase `true`). If it is unset/false, the button is hidden and the endpoint returns 404.

### Optional: Full Auth Setup

If you're working on auth-specific features, you'll need the real credentials:

| Feature | Required Keys |
|---|---|
| Google OAuth | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| GitHub OAuth | `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` |
| Magic link emails | `EMAIL_SENDER`, `GMAIL_REFRESH_TOKEN` (+ Google OAuth keys) |
| Web Push | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` |
| Media uploads | `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL` |

See `backend/.env.example` for all options.

## Quick First Contribution

1. Pick an issue labeled `good first issue` or `help wanted`.
2. Create a small, focused branch from `main`.
3. Keep your PR scoped to one bug fix or one enhancement.
4. Run `npm run lint` (frontend) and `go test ./...` (backend).
5. Link the issue in your PR description (`Fixes #123`).

## What to Contribute

- Bug fixes
- Performance improvements
- New features (open an issue first to discuss)
- Documentation improvements
- Test coverage
- Accessibility improvements

## Pull Request Process

1. **Open an issue first** to discuss significant changes before writing code
2. **Keep PRs focused** — one feature or fix per PR
3. **Follow existing patterns** — match the code style, naming conventions, and project structure already in the codebase
4. **Test your changes** — make sure the app builds and runs correctly
5. **Write clear commit messages** — describe what changed and why

### PR Checklist

- [ ] Code follows existing project conventions
- [ ] `go build ./...` passes (backend)
- [ ] `npm run build` passes (frontend)
- [ ] No new lint warnings
- [ ] Migrations are idempotent (`CREATE TABLE IF NOT EXISTS`, etc.)
- [ ] Sensitive data is not committed (`.env`, API keys, secrets)

## Code Style

### Go (Backend)

- Standard Go formatting (`gofmt`)
- Chi router for HTTP
- Repository pattern for data access
- Handlers are thin — business logic goes in services
- Errors are wrapped with context: `fmt.Errorf("doing thing: %w", err)`

### TypeScript (Frontend)

- Next.js App Router conventions
- Server Components by default, `"use client"` only when needed
- shadcn/ui for UI components
- Tailwind CSS for styling (no custom CSS unless necessary)
- Types over interfaces for simple shapes

## Database Migrations

- Migrations go in `backend/internal/database/migrations/`
- Name format: `NNN_description.sql` (e.g., `007_tracking.sql`)
- Always use `IF NOT EXISTS` / `IF EXISTS` for idempotency
- Migrations run automatically on server startup
- Never modify an existing migration that has been merged — create a new one

## Reporting Bugs

Open an issue with:
- What you expected to happen
- What actually happened
- Steps to reproduce
- Your environment (OS, Go version, Node version, browser)

## License

By contributing, you agree that your contributions will be licensed under the [GNU Affero General Public License v3.0](LICENSE).
