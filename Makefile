.DEFAULT_GOAL := help

### Help

.PHONY: help
help: ## Show this help message
	@echo "Usage: make [target]"
	@echo ""
	@awk '\
		/^###/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5) } \
		/^[a-zA-Z_-]+:.*##/ { split($$0, a, ":.*##"); printf "  \033[36m%-15s\033[0m %s\n", a[1], a[2] } \
	' $(MAKEFILE_LIST)

### Development

.PHONY: install
install: ## Install all dependencies
	bun install

.PHONY: dev
dev: ## Start development servers (requires Docker for db)
	docker compose up db -d
	@echo "Waiting for database..."
	@sleep 2
	$(MAKE) -j2 dev-api dev-web

.PHONY: dev-api
dev-api: ## Start API development server
	cd apps/api && bun run dev

.PHONY: dev-web
dev-web: ## Start web development server
	cd apps/web && bun run dev

### Docker

.PHONY: up
up: ## Start all services with Docker Compose
	docker compose up --build

.PHONY: up-d
up-d: ## Start all services in detached mode
	docker compose up --build -d

.PHONY: down
down: ## Stop all services
	docker compose down

.PHONY: build
build: ## Build all Docker images
	docker compose build

.PHONY: logs
logs: ## Follow logs from all services
	docker compose logs -f

.PHONY: logs-api
logs-api: ## Follow API service logs
	docker compose logs -f api

.PHONY: logs-web
logs-web: ## Follow web service logs
	docker compose logs -f web

.PHONY: logs-db
logs-db: ## Follow database logs
	docker compose logs -f db

### Database

.PHONY: migrate
migrate: ## Apply database migrations
	cd apps/api && DATABASE_URL=postgres://postgres:postgres@localhost:5432/ft_transcendence bun run migrate

.PHONY: generate
generate: ## Generate migration from schema changes
	cd apps/api && DATABASE_URL=postgres://postgres:postgres@localhost:5432/ft_transcendence bun run generate

.PHONY: db-shell
db-shell: ## Open PostgreSQL shell
	docker compose exec db psql -U postgres -d ft_transcendence

.PHONY: db-reset
db-reset: ## Reset database (drop and recreate)
	docker compose down -v
	docker compose up db -d
	@echo "Waiting for database..."
	@sleep 3
	$(MAKE) migrate

### Code Quality

.PHONY: lint
lint: ## Check code for linting issues
	bun x ultracite check

.PHONY: format
format: ## Auto-format code
	bun x ultracite fix

.PHONY: check
check: ## Run all checks (lint + typecheck)
	bun x ultracite check
	cd apps/api && bun x tsc --noEmit
	cd apps/web && bun run check

.PHONY: check-api
check-api: ## TypeScript check for API
	cd apps/api && bun x tsc --noEmit

.PHONY: check-web
check-web: ## Svelte check for web
	cd apps/web && bun run check

### Shell Access

.PHONY: api-shell
api-shell: ## Open shell in API container
	docker compose exec api sh

.PHONY: web-shell
web-shell: ## Open shell in web container
	docker compose exec web sh

### Cleanup

.PHONY: clean
clean: ## Remove node_modules and build artifacts
	rm -rf node_modules apps/*/node_modules packages/*/node_modules
	rm -rf apps/web/.svelte-kit apps/web/build
	rm -rf apps/api/dist

.PHONY: reset
reset: ## Full reset: clean + reinstall + rebuild Docker
	$(MAKE) clean
	$(MAKE) down
	docker compose down -v
	$(MAKE) install
	$(MAKE) up
