# AGENTS.md

This file provides guidance to AI assistants when working with code in this repository.

## Project Overview

ft_transcendence is a real-time multiplayer Pong platform (42 curriculum capstone) featuring server-authoritative gameplay at 60 ticks/s, AI opponent, live chat, and 42 OAuth with optional TOTP 2FA.

**Tech Stack:** Bun runtime, ElysiaJS (backend), SvelteKit (frontend), PostgreSQL + Drizzle ORM, Tailwind + Shadcn-Svelte

## Build Commands

```bash
# Development
bun install                          # Install all workspace dependencies
docker compose up --build            # Start full stack (recommended)

# Code Quality
bun x ultracite fix                  # Auto-format code (Biome)
bun x ultracite check                # Check for linting issues

# Backend (apps/api)
cd apps/api && bun run migrate       # Apply Drizzle migrations
cd apps/api && bun run generate      # Generate migration from schema changes
cd apps/api && bun run tsc --noEmit  # TypeScript type check

# Frontend (apps/web)
cd apps/web && bun run check         # svelte-check validation

# Documentation
bun run docs:dev                     # Start VitePress dev server
bun run docs:build                   # Build docs
```

## Monorepo Structure

```
ft_transcendence/
├── apps/
│   ├── api/                 # ElysiaJS backend
│   │   └── src/
│   │       ├── db/          # Drizzle config, schema, migrations
│   │       └── modules/     # Vertical slices (auth, chat, game, users)
│   └── web/                 # SvelteKit frontend
│       └── src/
│           ├── lib/         # Eden Treaty client, stores, components
│           └── routes/      # SvelteKit pages
├── packages/                # Shared types/configs
└── docs/                    # VitePress documentation
```

## Architecture Patterns

### Vertical Slice Pattern (Backend)

Each feature module is self-contained:

```
modules/[feature]/
├── [feature].controller.ts   # HTTP routes + TypeBox validation (NO DB calls)
├── [feature].service.ts      # Business logic (framework-agnostic)
├── [feature].repository.ts   # Drizzle queries ONLY
└── [feature].model.ts        # TypeBox schemas (single source of truth for types)
```

**Key Rules:**

- Controllers: Destructure context properties, never pass entire `Context` to services
- Services: No Elysia imports, no direct database access
- Repositories: Database queries only, no business logic
- Models: Define TypeBox schemas and derive types with `typeof schema.static`

### Frontend Patterns

- **API calls:** Always use Eden Treaty, never raw `fetch()`
- **Server data:** SvelteKit `load` functions
- **Client state:** Svelte stores (`writable`, `derived`)
- **Real-time:** WebSocket writes to stores
- **Svelte attributes:** Use `class` and `for` (not `className`/`htmlFor`)

### Database Changes

1. Edit `apps/api/src/db/schema.ts`
2. Run `cd apps/api && bun run generate`
3. Run `cd apps/api && bun run migrate`
4. Commit schema + migration files together

Never modify the database directly via GUI or raw SQL.

## Code Standards

This project uses **Ultracite** (zero-config Biome preset). Key rules:

- No `any` types (use `unknown` + type guards)
- No `@ts-ignore` (fix the error)
- `const` by default, `let` when needed, never `var`
- Arrow functions for callbacks
- `for...of` over `.forEach()` and indexed loops
- `async/await` over promise chains
- Template literals over string concatenation
- Remove `console.log`, `debugger`, `alert` from production code

## Commit Convention

Commits follow [Conventional Commits](https://conventionalcommits.org). Commitlint enforces this.

```
<type>(<scope>): <description>
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `chore`, `ci`

Breaking changes: Add `!` before colon (e.g., `feat(api)!: remove deprecated endpoint`)

## Branch Naming

Follow [Conventional Branch](https://conventional-branch.github.io/):

```
<type>/<description>
```

Examples: `feat/paddle-physics`, `fix/session-expiry`, `hotfix/security-patch`

## Troubleshooting

```bash
docker compose down -v && docker compose up --build  # Reset Docker + DB
docker compose logs -f api                           # View API logs
rm -rf node_modules apps/*/node_modules && bun install  # Reset deps
docker compose exec db psql -U postgres -d ft_transcendence  # Connect to DB
```
