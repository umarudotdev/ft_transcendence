# AGENTS.md

This file provides guidance to AI assistants when working with code in this
repository.

## Project Overview

ft_transcendence is a real-time multiplayer **bullet hell shoot 'em up** (42
curriculum capstone) featuring server-authoritative gameplay at 60 ticks/s, AI
opponents, live chat, and 42 OAuth with optional TOTP 2FA.

**Tech Stack:** Bun monorepo with ElysiaJS API, Colyseus game server, SvelteKit

- Tailwind + Bits UI frontend, PostgreSQL + Drizzle ORM.

## Commands

```bash
# Install & run
bun install                          # Install all workspace dependencies
docker compose up --build            # Start full stack (db + api + web)
make dev                             # Start db container + api + web dev servers

# Lint & format
bun x ultracite fix                  # Auto-format (Biome) — run before committing
bun x ultracite check                # Check for lint issues

# Type checking
bun run typecheck                    # All apps
bun run typecheck:api                # API only (tsc --noEmit)
bun run typecheck:web                # Web only (svelte-check)

# Testing
bun run test                         # All tests
bun run test:api                     # API tests (Bun test runner)
bun run test:web                     # Web tests (Vitest + Playwright browser)
cd apps/api && bun test src/modules/auth/auth.service.test.ts  # Single API test
cd apps/web && bun run test -- src/lib/some.svelte.test.ts     # Single web test

# Database
make migrate                         # Apply Drizzle migrations
make generate                        # Generate migration from schema changes
make db.shell                        # Open psql shell
make db.studio                       # Open Drizzle Studio GUI

```

## Architecture

### Monorepo Layout

- `apps/api/` — ElysiaJS backend (auth, users, chat, rankings, matchmaking,
  gamification, moderation, notifications)
- `apps/web/` — SvelteKit frontend (Svelte 5 runes, TanStack Query, Paraglide
  i18n)
- `apps/game/` — Colyseus game server (planned, not yet created)
- `packages/` — Shared types/configs
- `docs/` — VitePress documentation

### API: Vertical Slice Pattern

Each feature module in `apps/api/src/modules/` is self-contained:

```
modules/[feature]/
├── [feature].controller.ts   # Routes + TypeBox validation (NO DB calls)
├── [feature].service.ts      # Business logic (no Elysia imports, no direct DB)
├── [feature].repository.ts   # Drizzle queries ONLY
├── [feature].model.ts        # TypeBox schemas → derive types with typeof schema.static
└── [feature].test.ts         # Tests (Bun test runner)
```

**Controller rules:** Destructure context properties (`{ body, cookie, set }`),
never pass entire `Context` to services.

**Error handling:** Services return `neverthrow` `Result<T, E>` types.
Controllers match on results and map errors to RFC 9457 Problem Details via
error mapper functions (e.g., `mapLoginError`). A global `errorHandler` plugin
catches unhandled exceptions.

**Auth patterns:**

- `AuthMacro` with `{ isSignedIn: true }` — newer macro-based auth guard
- `authGuard` — legacy `derive`-based guard (still used in some controllers)
- Session cookies: `session` (7d), `pending_2fa` (5min), `OAUTH_STATE_COOKIE`
  (10min)

**Elysia plugin stack** (in `src/index.ts`): logging → errorHandler → cors →
openapi → static → route modules under `/api` prefix.

### Frontend: SvelteKit + Svelte 5

- **API client:** Eden Treaty (`lib/api.ts`) — fully typed from Elysia server,
  never use raw `fetch()`
- **Server data:** SvelteKit `load` functions with API proxy in
  `hooks.server.ts`
- **Client state:** TanStack Svelte Query with query key factories (e.g.,
  `authKeys.me()`)
- **Reactive state:** Svelte 5 runes (`$state`, `$derived`), not legacy stores
- **Real-time:** WebSocket stores with auto-reconnect and exponential backoff
- **Components:** Bits UI (headless) + Tailwind + `tailwind-variants`, M3
  design patterns
- **i18n:** Paraglide JS
- **Hooks pipeline** (`hooks.server.ts`): API proxy → auth guard → Paraglide

**Route groups:**

- `(auth)/` — login, register, password reset, 2FA, email verification
- `(app)/` — dashboard, profile, settings, chat, admin, leaderboard,
  achievements, notifications

### Type Safety Pipeline

TypeBox schemas in `.model.ts` files are the single source of truth. Elysia
validates requests/responses automatically. Eden Treaty infers types from the
Elysia app type (`App`), giving the frontend fully typed API calls with zero
codegen.

### Database Schema

Edit `apps/api/src/db/schema.ts`, then `make generate && make migrate`. Commit
schema + migration files together. Never modify the database directly.

Key table groups: users/sessions/auth tokens, matches/playerRatings/seasons,
friends, channels/messages, achievements/points/streaks,
notifications/preferences, roles/reports/sanctions/audit logs.

## Naming Conventions

### Files & Directories

- **Module directories:** kebab-case (`modules/chat/`, `common/errors/`)
- **API layer files:** `[feature].[layer].ts` (`chat.controller.ts`,
  `auth.service.ts`, `users.repository.ts`, `rankings.model.ts`)
- **Specialized files:** `[feature].[role].ts` (`chat.crypto.ts`,
  `auth.totp.ts`, `auth.oauth.ts`)
- **Tests:** `[feature].[layer].test.ts` (`auth.service.test.ts`)
- **Svelte components:** PascalCase (`MessageInput.svelte`,
  `ConversationList.svelte`); kebab-case for layout utilities
  (`app-sidebar.svelte`, `header-user-menu.svelte`)
- **Routes:** kebab-case (`/forgot-password/`, `/verify-email/`), dynamic
  segments in brackets (`[token]/`, `[channelId]/`)

### Code Identifiers

| Category              | Convention        | Examples                                          |
| --------------------- | ----------------- | ------------------------------------------------- |
| Functions/methods     | camelCase + verb  | `getConversations()`, `createMessage()`           |
| Variables             | camelCase         | `userId`, `isConnected`, `channelId`              |
| Constants             | UPPER_SNAKE_CASE  | `TYPING_TIMEOUT_MS`, `K_FACTOR`, `INITIAL_RATING` |
| Types                 | PascalCase        | `UserProfile`, `ChatError`, `ConversationItem`    |
| Error discriminants   | UPPER_SNAKE_CASE  | `"EMAIL_EXISTS"`, `"INVALID_CREDENTIALS"`         |
| Error mappers         | `map*Error()`     | `mapLoginError()`, `mapFriendshipError()`         |
| DB tables             | snake_case plural | `users`, `channel_members`, `points_transactions` |
| DB columns            | snake_case        | `user_id`, `created_at`, `email_verified`         |
| API routes            | kebab-case plural | `/chat/conversations`, `/users/:id/friends`       |
| Svelte event handlers | `handle` prefix   | `handleSubmit()`, `handleKeydown()`               |

### Frontend Query Patterns

- **Query key factories:** `featureKeys` object (`authKeys`, `chatKeys`,
  `usersKeys`) with hierarchical scopes
- **Queries:** `create<Resource>Query()` (`createMeQuery()`,
  `createMessagesQuery()`)
- **Mutations:** `create<Action>Mutation()` (`createLoginMutation()`,
  `createSendMessageMutation()`)

### Exports

- Named exports everywhere, no default exports (except Svelte components)
- Services as `abstract class` with static methods
- Repositories as plain exported objects
- Controllers as `export const featureController = new Elysia(...)`
- DB types: `type User = typeof users.$inferSelect`
- Frontend imports backend types via `@api` alias:
  `import type { ConversationItem } from "@api/modules/chat/chat.model"`

## Code Standards

**Ultracite** (Biome preset) enforces formatting and linting. Key rules:

- No `any` (use `unknown` + type guards), no `@ts-ignore`
- `const` by default, `let` when needed, never `var`
- `for...of` over `.forEach()`, `async/await` over promise chains
- Use `class` and `for` attributes in Svelte (not `className`/`htmlFor`)

## Commit Convention

Conventional Commits enforced by commitlint + Lefthook:

```
<type>(<scope>): <description>
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`,
`chore`, `ci` — Scopes: `api`, `web`, `game`, `docs`

Branch naming: `<type>/<description>` (e.g., `feat/bullet-patterns`)

## Environment Setup

Copy `.env.example` to `.env`. Required variables:

- `DATABASE_URL` — PostgreSQL connection string
- `CHAT_ENCRYPTION_KEY` — 32+ char key (`openssl rand -hex 32`)

Optional (dev defaults exist):

- `INTRA_CLIENT_ID` / `INTRA_CLIENT_SECRET` — 42 OAuth (warns if missing)
- `TOTP_ENCRYPTION_KEY` — Uses test key in dev, required in production
- `RESEND_API_KEY` — Email delivery (logs to console if unset)
