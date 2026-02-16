# AGENTS.md

This file provides guidance to AI assistants when working with code in this
repository.

## Project Overview

ft_transcendence is a real-time multiplayer **bullet hell shoot 'em up** (42
curriculum capstone) featuring server-authoritative gameplay at 60 ticks/s, AI
opponents, live chat, and 42 OAuth with optional TOTP 2FA.

**Tech Stack:**

- **API Server:** Bun + ElysiaJS (auth, matchmaking, chat, rankings)
- **Game Server:** Bun + Colyseus (game rooms, physics, combat)
- **Frontend:** SvelteKit + Tailwind + Shadcn-Svelte
- **Database:** PostgreSQL + Drizzle ORM

## Build Commands

```bash
# Development
bun install                          # Install all workspace dependencies
docker compose up --build            # Start full stack (recommended)

# Code Quality
bun x ultracite fix                  # Auto-format code (Biome)
bun x ultracite check                # Check for linting issues

# Backend - API (apps/api)
cd apps/api && bun run migrate       # Apply Drizzle migrations
cd apps/api && bun run generate      # Generate migration from schema changes
cd apps/api && bun run tsc --noEmit  # TypeScript type check

# Backend - Game Server (apps/game)
cd apps/game && bun run build        # Build Colyseus game server
cd apps/game && bun test             # Run game server tests
cd apps/game && bun run dev          # Run game server (dev)

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
│   ├── api/                 # ElysiaJS backend (auth, matchmaking, chat)
│   │   └── src/
│   │       ├── db/          # Drizzle config, schema, migrations
│   │       └── modules/     # Vertical slices (auth, chat, matchmaking, users)
│   └── web/                 # SvelteKit frontend
│       └── src/
│           ├── lib/         # Eden Treaty client, stores, components
│           └── routes/      # SvelteKit pages
│   └── game/                # Colyseus game server (rooms, physics, combat)
│       └── src/
│           ├── rooms/       # Game room handlers
│           ├── schemas/     # Colyseus state schemas
│           ├── systems/     # Movement, collision, combat
│           └── ai/          # AI patterns
├── packages/                # Shared types/configs
└── docs/                    # VitePress documentation
```

## Architecture Patterns

### Hybrid Architecture

This project uses two backend services:

1. **ElysiaJS (apps/api)** - HTTP/REST services
   - Authentication (OAuth, 2FA, sessions)
   - User management (profiles, friends, stats)
   - Chat system (channels, messages)
   - Matchmaking (queue management, player pairing)
   - Rankings (Elo calculations, leaderboards)

2. **Colyseus Game Server (apps/game)** - Real-time game logic
   - Room-based game sessions
   - 60Hz fixed timestep game loop
   - Entity management (players, bullets)
   - Physics and collision detection
   - Combat system (damage, HP, lives)
   - Ability system (cooldowns, effects)

### Vertical Slice Pattern (ElysiaJS)

Each feature module is self-contained:

```
modules/[feature]/
├── [feature].controller.ts   # HTTP routes + TypeBox validation (NO DB calls)
├── [feature].service.ts      # Business logic (framework-agnostic)
├── [feature].repository.ts   # Drizzle queries ONLY
└── [feature].model.ts        # TypeBox schemas (single source of truth for types)
```

**Key Rules:**

- Controllers: Destructure context properties, never pass entire `Context` to
  services
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

Commits follow [Conventional Commits](https://conventionalcommits.org).
Commitlint enforces this.

```
<type>(<scope>): <description>
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`,
`chore`, `ci`

Scopes: `api`, `web`, `game`, `docs`

Breaking changes: Add `!` before colon (e.g.,
`feat(api)!: remove deprecated endpoint`)

## Branch Naming

Follow [Conventional Branch](https://conventional-branch.github.io/):

```
<type>/<description>
```

Examples: `feat/bullet-patterns`, `fix/collision-detection`,
`hotfix/security-patch`

## Troubleshooting

```bash
docker compose down -v && docker compose up --build  # Reset Docker + DB
docker compose logs -f api                           # View API logs
docker compose logs -f game                           # View game server logs
rm -rf node_modules apps/*/node_modules && bun install  # Reset deps
docker compose exec db psql -U postgres -d ft_transcendence  # Connect to DB
```
