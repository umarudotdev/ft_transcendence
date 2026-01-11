**Role:** Act as a senior full-stack developer setting up the ft_transcendence
project—a real-time multiplayer Pong platform using Bun, ElysiaJS, SvelteKit,
and PostgreSQL.

**Context:** This is a monorepo using Bun workspaces. The backend (api) uses
ElysiaJS with vertical slice architecture, and the frontend (web) uses SvelteKit
with Tailwind + Shadcn-Svelte. The goal is **Milestone 1: Setup**—Docker builds
in one command, with type-safe communication via Eden Treaty.

**Task:** Complete the initial setup by implementing the following in order:

### 1. Backend Setup (api)

- Create an ElysiaJS app entry point at `src/index.ts`
- Add a health endpoint (`GET /health`) returning `{ status: "ok" }`
- Configure CORS to allow requests from the frontend origin
- Export the `App` type for Eden Treaty integration

### 2. Database Setup

- Configure Drizzle ORM with PostgreSQL connection (`src/db/index.ts`)
- Create initial schema file (`src/db/schema.ts`) with a `users` table
  containing:
  - `id` (serial primary key)
  - `email` (unique text)
  - `displayName` (text)
  - `avatarUrl` (nullable text)
  - `createdAt` (timestamp with timezone)
- Generate and apply the migration

### 3. Frontend Setup (web)

- Verify SvelteKit is configured with Tailwind CSS
- Install and configure Shadcn-Svelte components
- Create the Eden Treaty client at `src/lib/api.ts` importing the backend `App`
  type
- Add a test page that calls the `/health` endpoint and displays the result

### 4. Docker & Infrastructure

- Create/update `compose.yaml` with services:
  - `db`: PostgreSQL with persistent volume
  - `api`: ElysiaJS backend (depends on db)
  - `web`: SvelteKit frontend
  - `nginx`: Reverse proxy with HTTPS termination (optional for dev)
- Ensure `docker compose up --build` starts the full stack

### 5. Code Quality

- Configure Oxc via `oxlint.json` for linting and formatting
- Set up Lefthook pre-commit hooks for linting/formatting

**Constraints:**

- Follow vertical slice architecture patterns from development.md
- Use TypeBox for request/response validation in controllers
- No `any` types—use proper TypeScript throughout
- All database changes must go through Drizzle migrations

**Output Format:** For each step, provide:

1. The file path
2. The complete code implementation
3. Any terminal commands to run

**Verification:** After setup, confirm success by:

- Running `docker compose up --build` without errors
- Frontend successfully calling backend health endpoint
- `bunx oxlint` passing with no issues
