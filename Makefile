.DEFAULT_GOAL := help

### Help

.PHONY: help
help: ## Show this help message
	@echo "Usage: make [target]"
	@echo ""
	@awk '\
		/^###/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5) } \
		/^[a-zA-Z_.-]+:.*##/ { split($$0, a, ":.*##"); printf "  \033[36m%-15s\033[0m %s\n", a[1], a[2] } \
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
	$(MAKE) -j2 dev.api dev.web

.PHONY: dev.api
dev.api: ## Start API development server
	bun run dev:api

.PHONY: dev.web
dev.web: ## Start web development server
	bun run dev:web

### Build

.PHONY: build.app
build.app: ## Build all apps
	bun run build

.PHONY: build.api
build.api: ## Build API
	bun run --filter '@ft/api' build

.PHONY: build.web
build.web: ## Build web
	bun run build:web

### Docker

.PHONY: up
up: ## Start all services with Docker Compose
	docker compose up --build

.PHONY: up.d
up.d: ## Start all services in detached mode
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

.PHONY: logs.api
logs.api: ## Follow API service logs
	docker compose logs -f api

.PHONY: logs.web
logs.web: ## Follow web service logs
	docker compose logs -f web

.PHONY: logs.db
logs.db: ## Follow database logs
	docker compose logs -f db

### Database

.PHONY: migrate
migrate: ## Apply database migrations
	DATABASE_URL=postgres://postgres:postgres@localhost:5432/ft_transcendence bun run db:migrate

.PHONY: generate
generate: ## Generate migration from schema changes
	DATABASE_URL=postgres://postgres:postgres@localhost:5432/ft_transcendence bun run db:generate

.PHONY: db.shell
db.shell: ## Open PostgreSQL shell
	docker compose exec db psql -U postgres -d ft_transcendence

.PHONY: db.reset
db.reset: ## Reset database (drop and recreate)
	docker compose down -v
	docker compose up db -d
	@echo "Waiting for database..."
	@sleep 3
	$(MAKE) migrate

### Code Quality

.PHONY: lint
lint: ## Check code for linting issues
	bun run lint

.PHONY: format
format: ## Auto-format code
	bun run lint:fix

.PHONY: typecheck
typecheck: ## Run all type checks
	bun run typecheck

.PHONY: typecheck.api
typecheck.api: ## TypeScript check for API
	bun run typecheck:api

.PHONY: typecheck.web
typecheck.web: ## Svelte check for web
	bun run typecheck:web

.PHONY: check
check: lint typecheck ## Run all checks (lint + typecheck)

### Testing

.PHONY: test
test: ## Run all tests
	bun run test

.PHONY: test.api
test.api: ## Run API tests
	bun run test:api

.PHONY: test.web
test.web: ## Run web tests
	bun run test:web

### Shell Access

.PHONY: shell.api
shell.api: ## Open shell in API container
	docker compose exec api sh

.PHONY: shell.web
shell.web: ## Open shell in web container
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
