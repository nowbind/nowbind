.PHONY: dev dev-backend dev-frontend db db-down migrate help

# Load Go from brew if needed
export PATH := $(shell brew --prefix 2>/dev/null)/bin:$(PATH)

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

dev: ## Start backend + frontend (expects Postgres already running locally)
	@$(MAKE) migrate
	@$(MAKE) dev-backend &
	@$(MAKE) dev-frontend

dev-backend: ## Start Go backend with hot reload
	cd backend && go run ./cmd/server

dev-frontend: ## Start Next.js dev server
	cd frontend && npm run dev

db: ## Postgres is intentionally external (host-managed)
	@echo "Postgres is not managed by Docker Compose in this repo. Start your local Postgres service."

db-down: ## Stop PostgreSQL
	docker compose down

migrate: ## Run database migrations
	cd backend && go run ./cmd/server -migrate

build-backend: ## Build Go binary
	cd backend && go build -o bin/server ./cmd/server

build-frontend: ## Build Next.js
	cd frontend && npm run build

lint: ## Lint all code
	cd frontend && npm run lint

clean: ## Clean build artifacts
	rm -rf backend/bin frontend/.next frontend/out
