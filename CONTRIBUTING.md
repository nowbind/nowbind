# Contributing to NowBind

Thanks for your interest in contributing to NowBind! This document outlines the process for contributing.

## Getting Started

1. **Fork the repo** and clone it locally
2. **Set up the dev environment** — see the [README](README.md) for instructions
3. **Create a branch** from `main` for your work: `git checkout -b feature/your-feature`

## Development Setup

```bash
# Start the database
docker compose up -d postgres

# Backend (Go)
cd backend
cp .env.example .env   # configure your env
go mod download
go run cmd/server/main.go -migrate
go run cmd/server/main.go

# Frontend (Next.js)
cd frontend
npm install
cp .env.example .env.local   # configure your env
npm run dev
```

Or use `make dev` from the project root to start everything.

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
