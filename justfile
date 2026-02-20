set dotenv-load

# ─── Development ──────────────────────────────────────────────────────────────

# Install all dependencies
install:
    bun install

# Start development servers (db + api + web + game)
dev:
    docker compose up db -d
    @echo "Waiting for database..."
    @sleep 2
    just --parallel dev-api dev-web dev-game

# Start API development server
dev-api:
    bun run dev:api

# Start web development server
dev-web:
    bun run dev:web

# Start game server
dev-game:
    bun run dev:game

# ─── Build ────────────────────────────────────────────────────────────────────

# Build all apps
build-app:
    bun run build

# Build API
build-api:
    bun run --filter '@ft/api' build

# Build web
build-web:
    bun run build:web

# ─── Docker ───────────────────────────────────────────────────────────────────

# Start all services with Docker Compose
up:
    docker compose up --build

# Start all services in detached mode
up-d:
    docker compose up --build -d

# Stop all services
down:
    docker compose down

# Build all Docker images
docker-build:
    docker compose build

# Follow logs from all services (or a specific one)
logs service="":
    docker compose logs -f {{ service }}

# Open shell in a container
shell service:
    docker compose exec {{ service }} sh

# ─── Database ─────────────────────────────────────────────────────────────────

# Apply database migrations
migrate:
    bun run db:migrate

# Generate migration from schema changes
generate:
    bun run db:generate

# Open PostgreSQL shell
db-shell:
    docker compose exec db psql -U ${POSTGRES_USER:-postgres} -d ${POSTGRES_DB:-ft_transcendence}

# Reset database (drop and recreate)
db-reset:
    docker compose down -v
    docker compose up db -d
    @echo "Waiting for database..."
    @sleep 3
    just migrate

# Seed database with test data
db-seed:
    bun run --filter '@ft/api' seed

# Open Drizzle Studio GUI
db-studio:
    bun run --filter '@ft/api' drizzle-kit studio

# ─── Code Quality ─────────────────────────────────────────────────────────────

# Check for lint issues
lint:
    bun run lint

# Auto-format code
format:
    bun run lint:fix

# Run all type checks
typecheck:
    bun run typecheck

# TypeScript check for API
typecheck-api:
    bun run typecheck:api

# Svelte check for web
typecheck-web:
    bun run typecheck:web

# Run all checks (lint + typecheck)
check: lint typecheck

# ─── Testing ──────────────────────────────────────────────────────────────────

# Run all unit tests
test:
    bun run test

# Run API unit tests
test-api:
    bun run test:api

# Run web unit tests
test-web:
    bun run test:web

# Run E2E tests (requires: just up-d)
test-e2e:
    cd apps/web && bun run test:e2e

# ─── Cleanup ──────────────────────────────────────────────────────────────────

# Remove node_modules and build artifacts
clean:
    rm -rf node_modules apps/*/node_modules packages/*/node_modules
    rm -rf apps/web/.svelte-kit apps/web/build
    rm -rf apps/api/dist

# Full reset: clean + reinstall + rebuild Docker
reset: clean down
    docker compose down -v
    just install
    just up
