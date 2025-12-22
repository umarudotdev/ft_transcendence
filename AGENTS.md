# Agents

This file provides guidance to AI assistants when working with code in this repository.

## Project Overview

ft_transcendence is a real-time Pong platform for the 42 curriculum featuring multiplayer gameplay, chat, and 2FA.

## Tech Stack

- **Runtime:** Bun (native TypeScript, no build step for backend)
- **Backend:** ElysiaJS with Eden Treaty for end-to-end type safety
- **Frontend:** SvelteKit (SSR) with Tailwind CSS and Shadcn-Svelte
- **Database:** PostgreSQL with Drizzle ORM
- **Auth:** Database sessions (Lucia patterns), Arctic for 42 OAuth, Oslo for TOTP 2FA
- **Infra:** Docker + Nginx (HTTPS termination)
- **Tooling:** Biome (TS/JS formatting/linting), Prettier (Svelte files), Lefthook (git hooks)

## Common Commands

```bash
# Start entire stack
docker compose up --build

# Install dependencies
bun install

# Run database migrations
cd apps/api && bun run migrate

# Format/lint (runs automatically via Lefthook on commit)
bun run biome check --apply .

# Format Svelte files
bunx prettier --write "**/*.svelte"

# Type check
bun run tsc --noEmit                    # API
cd apps/web && bun run check            # Web (svelte-check)
```

## Architecture

### Monorepo Structure (Bun Workspaces)

- `apps/api` - ElysiaJS API and WebSocket game server
- `apps/web` - SvelteKit client
- `packages/` - Shared types/configs

### Backend: Vertical Slice Architecture

Code is organized by **Feature Module**, not by technical layer:

```
apps/api/src/
├── common/              # Shared guards, decorators, types
├── db/                  # Drizzle config & schema
└── modules/
    ├── auth/            # Authentication (OAuth, 2FA, sessions)
    ├── chat/            # WebSocket chat system
    └── game/            # Game engine
        ├── *.controller.ts   # HTTP + validation (TypeBox). NO DB calls.
        ├── *.service.ts      # Business logic
        ├── *.repository.ts   # Drizzle ORM queries (ONLY place for DB access)
        └── domain/           # Pure game logic (physics, rules) - no framework deps
```

### Frontend Structure

```
apps/web/src/
├── lib/
│   ├── api.ts           # Eden Treaty client
│   ├── stores/          # Svelte stores (client state)
│   └── components/ui/   # Shadcn-Svelte components
└── routes/              # SvelteKit pages
```

### Frontend: Eden Treaty Integration

API calls use Eden Treaty for type-safe access to backend routes:

```typescript
import { api } from "$lib/api";
const { data } = await api.users.index.get(); // Full autocomplete
```

## Key Patterns

- **Controllers:** HTTP/validation only using TypeBox `t.Object()`. Must call Services, never DB directly.
- **Services:** Business logic, framework-agnostic where possible
- **Repositories:** Only place where Drizzle `db.select/insert` is allowed
- **Game Domain:** Pure TypeScript classes in `domain/` folder - no Elysia/Drizzle imports
- **Sessions:** Database-backed (PostgreSQL), HttpOnly cookies - can be revoked immediately
- **Real-time:** WebSocket for game state (60 ticks/s) and chat
- **State Management:** Native Svelte stores for client state, SvelteKit `load` functions for server state

## Database

Schema changes must go through Drizzle migrations:

1. Edit `apps/api/src/db/schema.ts`
2. Run `cd apps/api && bun run migrate`
3. Commit generated migration files

Never modify the database directly via GUI clients.

## Git Conventions

- **Branch naming:** `type/scope/description` (e.g., `feat/game/paddle-physics`)
- **Commits:** Conventional Commits format: `type(scope): description`
- **Merge:** Squash and merge only, 1 peer review required
