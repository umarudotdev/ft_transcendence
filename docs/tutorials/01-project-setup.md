# Tutorial: Project Setup

> **Difficulty:** Beginner **Time:** 2-3 hours **Prerequisites:** Basic
> TypeScript knowledge, familiarity with npm/package managers, Docker installed

## What You'll Learn

- How to structure a Bun monorepo with workspaces
- Setting up ElysiaJS with type-safe routing
- Configuring SvelteKit with Tailwind CSS and Shadcn-Svelte
- Connecting to PostgreSQL using Drizzle ORM
- Creating a Docker Compose environment for local development
- Establishing end-to-end type safety with Eden Treaty

## Conceptual Overview

Before writing any code, let's understand **why** we're building things this
way.

### The Monorepo Advantage

Imagine you're building two applications that need to talk to each other: a
backend API and a frontend web app. The traditional approach is two separate
repositories. But this creates a problem: when you change an API endpoint, how
does the frontend know? You'd need to manually update types, hope nothing
breaks, and coordinate releases.

A **monorepo** solves this by keeping both applications in one repository. With
Bun workspaces, the frontend can directly import types from the backend. Change
an API response shape, and TypeScript immediately tells you everywhere in the
frontend that needs updating.

```
ft_transcendence/
├── apps/
│   ├── api/          # ElysiaJS backend
│   └── web/          # SvelteKit frontend
├── packages/         # Shared code (if needed)
└── package.json      # Workspace configuration
```

### Why This Stack?

| Technology     | Purpose                   | Key Benefit                                  |
| -------------- | ------------------------- | -------------------------------------------- |
| **Bun**        | Runtime & package manager | Fast, built-in TypeScript, unified toolchain |
| **ElysiaJS**   | Backend framework         | Eden Treaty enables type-safe API clients    |
| **SvelteKit**  | Frontend framework        | SSR support, simple state management         |
| **Drizzle**    | Database ORM              | TypeScript-native, SQL-like syntax           |
| **PostgreSQL** | Database                  | Relational integrity, battle-tested          |

### The Type Safety Pipeline

Here's the magic: when you define an API endpoint in ElysiaJS, Eden Treaty
automatically generates a typed client. No code generation step, no manual type
definitions:

```
Backend defines endpoint → Eden Treaty infers types → Frontend gets autocomplete
```

This means if you return `{ user: { id: number, name: string } }` from an
endpoint, the frontend automatically knows the exact shape of that response.

---

## Phase 1: Initializing the Monorepo

### Learning Objective

Understand how Bun workspaces link multiple packages together and share
dependencies.

### Understanding the Approach

A Bun workspace is configured through the root `package.json`. Each "workspace"
is a directory containing its own `package.json`. Bun automatically links them,
so `apps/web` can import from `apps/api` without publishing to npm.

The key insight: **workspaces share a single `node_modules` at the root**. This
means:

- One version of each dependency across all packages
- Faster installs (no duplicate downloads)
- Consistent behavior between packages

### Key Decisions

1. **Why `apps/` and `packages/` directories?** This is a convention. `apps/`
   contains deployable applications, `packages/` contains shared libraries. You
   could name them differently, but this pattern is widely recognized.

2. **Why separate `api` and `web`?** They serve different purposes and may have
   different deployment targets. Separation makes it clear what runs where.

### Implementation Steps

1. Create the project root with a `package.json`:

```json
{
  "name": "ft_transcendence",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev": "bun run --filter '*' dev",
    "build": "bun run --filter '*' build",
    "lint": "bun x ultracite check",
    "format": "bun x ultracite fix"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "ultracite": "^4.2.7"
  }
}
```

The `workspaces` array tells Bun: "Look in `apps/*` and `packages/*` for
sub-packages." The glob pattern means any directory inside those folders with a
`package.json` becomes a workspace.

2. Create the backend package at `apps/api/package.json`:

```json
{
  "name": "@ft/api",
  "version": "1.0.0",
  "scripts": {
    "dev": "bun run --watch src/index.ts",
    "build": "bun build src/index.ts --outdir dist",
    "migrate": "bun run src/db/migrate.ts",
    "generate": "drizzle-kit generate"
  },
  "dependencies": {
    "elysia": "^1.2.0",
    "@elysiajs/cors": "^1.2.0",
    "drizzle-orm": "^0.39.0",
    "postgres": "^3.4.0"
  },
  "devDependencies": {
    "drizzle-kit": "^0.30.0",
    "@types/bun": "latest"
  }
}
```

> **Pro tip:** The `@ft/` prefix is a naming convention for internal packages.
> It prevents conflicts with npm packages and makes imports clearly identifiable
> as local.

3. Create the frontend package at `apps/web/package.json`:

```json
{
  "name": "@ft/web",
  "version": "1.0.0",
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "preview": "vite preview",
    "check": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json"
  },
  "dependencies": {
    "@elysiajs/eden": "^1.2.0",
    "@ft/api": "workspace:*"
  },
  "devDependencies": {
    "@sveltejs/adapter-node": "^5.2.0",
    "@sveltejs/kit": "^2.15.0",
    "@sveltejs/vite-plugin-svelte": "^5.0.0",
    "svelte": "^5.0.0",
    "svelte-check": "^4.0.0",
    "tailwindcss": "^4.0.0",
    "vite": "^6.0.0"
  }
}
```

Notice `"@ft/api": "workspace:*"`. This tells Bun to link the local `apps/api`
package rather than fetching from npm. The `workspace:*` protocol is how you
reference sibling packages.

4. Install all dependencies:

```bash
bun install
```

This single command installs dependencies for all workspaces.

### Checkpoint

After this phase, you should have:

- A root `package.json` with workspaces configured
- `apps/api/package.json` and `apps/web/package.json` created
- Running `bun install` completes without errors
- A single `node_modules` directory at the root

### Common Pitfalls

- **Forgetting `"private": true`** in root package.json. Without this, you might
  accidentally publish your monorepo to npm.
- **Mismatched package names**. If `apps/web` imports `@ft/api`, that must
  exactly match the `name` field in `apps/api/package.json`.
- **Running `bun install` in subdirectories**. Always run from the root to
  ensure workspace linking works.

---

## Phase 2: Backend Foundation with ElysiaJS

### Learning Objective

Create an ElysiaJS application with proper structure for the vertical slice
architecture.

### Understanding the Approach

ElysiaJS is designed around **plugins** and **method chaining**. Each route is
added to the app with `.get()`, `.post()`, etc. The framework automatically
infers types from your handlers.

The vertical slice architecture means we organize code by **feature**, not by
layer:

```
modules/
├── auth/           # All auth code together
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   └── auth.repository.ts
└── users/          # All user code together
    ├── users.controller.ts
    └── ...
```

This is different from traditional layered architecture where all controllers go
in one folder, all services in another. Vertical slices keep related code
together, reducing context switching.

### Key Decisions

1. **Why export the `App` type?** Eden Treaty needs to know the shape of your
   API. Exporting `typeof app` gives the frontend everything it needs for type
   inference.

2. **Why use TypeBox for validation?** TypeBox schemas serve double duty: they
   validate incoming requests AND generate TypeScript types. One schema, two
   purposes.

3. **Why separate controller/service/repository?** Controllers handle HTTP
   concerns (routing, validation, status codes). Services contain business
   logic. Repositories handle database queries. This separation makes testing
   easier and keeps code focused.

### Implementation Steps

1. Create the entry point at `apps/api/src/index.ts`:

```typescript
import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";

// Create the app with CORS enabled
const app = new Elysia()
  .use(
    cors({
      // Allow requests from the frontend origin
      origin: ["http://localhost:5173", "http://localhost:3000"],
      // Allow cookies to be sent cross-origin
      credentials: true,
    })
  )
  // Health check endpoint - useful for Docker and load balancers
  .get("/health", () => ({
    status: "ok",
    timestamp: new Date().toISOString(),
  }))
  // Group all API routes under /api prefix
  .group("/api", (app) =>
    app.get("/", () => ({ message: "ft_transcendence API" }))
  )
  // Start the server
  .listen(4000);

// This export is CRITICAL - it enables Eden Treaty type inference
export type App = typeof app;

console.log(`API running at ${app.server?.url}`);
```

Let's break down the important parts:

- **CORS configuration**: Without this, the browser blocks requests from
  `localhost:5173` (frontend) to `localhost:4000` (backend). The
  `credentials: true` allows cookies.
- **Health endpoint**: Docker Compose and orchestrators use this to know if your
  service is ready.
- **Group prefix**: All routes inside `.group("/api", ...)` are prefixed with
  `/api`. This makes reverse proxy configuration cleaner.
- **`export type App`**: This is the magic. It exports the complete type
  signature of your API.

2. Create the directory structure:

```bash
mkdir -p apps/api/src/{db,modules,common}
mkdir -p apps/api/src/modules/{auth,users,game,chat}
mkdir -p apps/api/src/common/guards
```

3. Test the backend:

```bash
cd apps/api && bun run dev
```

Visit `http://localhost:4000/health` - you should see
`{"status":"ok","timestamp":"..."}`.

### Checkpoint

After this phase:

- `bun run dev` starts the server without errors
- `http://localhost:4000/health` returns JSON response
- The `App` type is exported from `index.ts`

### Common Pitfalls

- **Missing CORS configuration**. Without it, the frontend cannot make requests.
  You'll see "CORS policy" errors in the browser console.
- **Forgetting to export `App` type**. Eden Treaty will fail with cryptic errors
  if the type isn't exported.
- **Wrong port in CORS origin**. Make sure the port matches where your frontend
  runs.

---

## Phase 3: Database Setup with Drizzle

### Learning Objective

Configure Drizzle ORM for type-safe database access with PostgreSQL.

### Understanding the Approach

Drizzle is different from ORMs like Prisma or TypeORM. Instead of generating
code, Drizzle is **TypeScript-native**. You define schemas using TypeScript
functions, and they directly produce types.

The migration workflow:

1. Edit your schema in TypeScript
2. Run `drizzle-kit generate` to create SQL migration files
3. Run your migrate script to apply them to the database

This approach gives you version-controlled, reviewable SQL migrations.

### Key Decisions

1. **Why `text` instead of `varchar`?** PostgreSQL treats them identically, but
   `text` has no arbitrary length limit. Using `text` avoids "string too long"
   errors.

2. **Why `withTimezone: true` for timestamps?** PostgreSQL stores the value in
   UTC and converts to the client's timezone on read. This prevents timezone
   bugs.

3. **Why a separate `drizzle.config.ts`?** Drizzle-kit (the migration tool)
   needs to know where your schema is and where to output migrations. Keeping
   this in a config file separates concerns.

### Implementation Steps

1. Create the database connection at `apps/api/src/db/index.ts`:

```typescript
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Connection string from environment variable
// Format: postgres://user:password@host:port/database
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is required");
}

// Create the postgres client
// max: 10 limits connection pool size (good for development)
const client = postgres(connectionString, { max: 10 });

// Create the Drizzle instance with our schema
// Passing schema enables the query builder with relations
export const db = drizzle(client, { schema });
```

> **Warning:** Never commit database credentials. Always use environment
> variables.

2. Create the initial schema at `apps/api/src/db/schema.ts`:

```typescript
import {
  boolean,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Users table - the foundation of the auth system
export const users = pgTable("users", {
  // Auto-incrementing primary key
  id: serial("id").primaryKey(),

  // Email is the unique identifier for login
  email: text("email").unique().notNull(),

  // Display name shown in the UI (editable by user)
  displayName: text("display_name").notNull(),

  // Avatar URL - nullable because not all users upload one
  avatarUrl: text("avatar_url"),

  // Track account creation time
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Define relations for the query builder
// This enables db.query.users.findMany({ with: { sessions: true } })
export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
}));

// Sessions table for database-backed authentication
export const sessions = pgTable("sessions", {
  // Random string ID, not auto-increment (security)
  id: text("id").primaryKey(),

  // Link to the user who owns this session
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),

  // When this session expires
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),

  // When the session was created
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));
```

3. Create Drizzle configuration at `apps/api/drizzle.config.ts`:

```typescript
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  // Where to find schema definitions
  schema: "./src/db/schema.ts",

  // Where to output migration files
  out: "./drizzle",

  // Database driver
  dialect: "postgresql",

  // Connection details from environment
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },

  // Generate verbose migration names
  verbose: true,

  // Enable strict mode for safety
  strict: true,
});
```

4. Create the migration runner at `apps/api/src/db/migrate.ts`:

```typescript
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is required");
}

// Use a separate connection for migrations
// max: 1 because migrations should run sequentially
const migrationClient = postgres(connectionString, { max: 1 });

const db = drizzle(migrationClient);

console.log("Running migrations...");

await migrate(db, { migrationsFolder: "./drizzle" });

console.log("Migrations complete!");

// Close the connection when done
await migrationClient.end();
```

5. Generate and apply migrations:

```bash
# Generate migration files from schema
cd apps/api && bun run generate

# Apply migrations to database (requires DATABASE_URL set)
bun run migrate
```

### Checkpoint

After this phase:

- `drizzle/` directory contains SQL migration files
- Running `bun run migrate` applies schema to database
- You can explain why each column type was chosen

### Common Pitfalls

- **Missing `DATABASE_URL`**. Set it before running migrations:
  `export DATABASE_URL="postgres://..."`
- **Forgetting `onDelete: "cascade"`** on foreign keys. Without it, deleting a
  user leaves orphaned sessions.
- **Not running `generate` after schema changes**. Your database won't update
  automatically.

---

## Phase 4: Frontend with SvelteKit

### Learning Objective

Set up SvelteKit with Tailwind CSS and connect to the backend via Eden Treaty.

### Understanding the Approach

SvelteKit provides file-based routing. Each file in `src/routes/` becomes a
page:

- `src/routes/+page.svelte` → `/`
- `src/routes/profile/+page.svelte` → `/profile`
- `src/routes/users/[id]/+page.svelte` → `/users/:id`

Eden Treaty creates a type-safe API client. Instead of writing:

```typescript
const res = await fetch("/api/users/me");
const data = await res.json(); // data is `any`
```

You write:

```typescript
const { data, error } = await api.api.users.me.get();
// data is fully typed based on your ElysiaJS endpoint
```

### Key Decisions

1. **Why Shadcn-Svelte?** It provides accessible, customizable components that
   you own. Unlike traditional component libraries, Shadcn copies components
   into your source code, giving you full control.

2. **Why check `typeof window`?** SvelteKit runs code on both server and client.
   The server doesn't have `window`, so we need different base URLs for each
   environment.

3. **Why `credentials: "include"`?** This tells fetch to include cookies in
   cross-origin requests. Without it, your session cookie won't be sent.

### Implementation Steps

1. Initialize SvelteKit (if not already done):

```bash
cd apps/web
bunx sv create . --template minimal --types ts
```

2. Install and configure Tailwind CSS:

```bash
bunx @sveltejs/cli@latest add tailwindcss
```

3. Install Shadcn-Svelte:

```bash
bunx shadcn-svelte@next init
```

Follow the prompts to configure the component library.

4. Create the Eden Treaty client at `apps/web/src/lib/api.ts`:

```typescript
import { treaty } from "@elysiajs/eden";
// Import the App type from the backend workspace
import type { App } from "@ft/api/src/index";

// Determine the base URL based on environment
// Server-side: use internal Docker network or localhost
// Client-side: use the browser's origin
const getBaseUrl = () => {
  // Running in browser
  if (typeof window !== "undefined") {
    // Use current origin - works with reverse proxy
    return window.location.origin;
  }
  // Running on server during SSR
  return process.env.API_URL ?? "http://localhost:4000";
};

// Create the type-safe API client
// The treaty function returns a proxy that builds requests
export const api = treaty<App>(getBaseUrl(), {
  // Include credentials (cookies) in all requests
  fetch: {
    credentials: "include",
  },
});

// Example usage:
// const { data, error } = await api.api.users.me.get();
// const { data, error } = await api.api.auth.login.post({ email, password });
```

The magic here is `treaty<App>`. TypeScript sees the exported `App` type from
your backend and creates a client with matching methods and types.

5. Create a test page at `apps/web/src/routes/+page.svelte`:

```svelte
<script lang="ts">
  import { api } from "$lib/api";
  import { onMount } from "svelte";

  // Using Svelte 5 runes for state
  let health = $state<{ status: string; timestamp: string } | null>(null);
  let error = $state<string | null>(null);
  let loading = $state(true);

  onMount(async () => {
    try {
      // Call the health endpoint
      const response = await api.health.get();

      if (response.error) {
        error = "Failed to connect to API";
        return;
      }

      health = response.data;
    } catch (e) {
      error = "Network error - is the API running?";
    } finally {
      loading = false;
    }
  });
</script>

<main class="container mx-auto p-8">
  <h1 class="text-3xl font-bold mb-4">ft_transcendence</h1>

  {#if loading}
    <p class="text-muted-foreground">Connecting to API...</p>
  {:else if error}
    <div class="bg-destructive/10 text-destructive p-4 rounded">
      {error}
    </div>
  {:else if health}
    <div class="bg-green-100 dark:bg-green-900/20 p-4 rounded">
      <p><strong>API Status:</strong> {health.status}</p>
      <p><strong>Timestamp:</strong> {health.timestamp}</p>
    </div>
  {/if}
</main>
```

6. Test the frontend:

```bash
cd apps/web && bun run dev
```

Visit `http://localhost:5173` - you should see the API health status.

### Checkpoint

After this phase:

- Frontend loads at `http://localhost:5173`
- Eden Treaty client is configured in `src/lib/api.ts`
- Health check displays data from the backend
- TypeScript provides autocomplete for API calls

### Common Pitfalls

- **Import path for `App` type**. It must match the workspace package name. If
  you see "cannot find module," check your `package.json` names.
- **CORS errors**. The backend must allow the frontend's origin. Check the CORS
  configuration in `apps/api/src/index.ts`.
- **Missing `credentials: "include"`**. Without this, cookies won't be sent and
  authentication will fail.

---

## Phase 5: Docker Compose Environment

### Learning Objective

Create a containerized development environment that starts with one command.

### Understanding the Approach

Docker Compose orchestrates multiple containers. For our stack:

- **db**: PostgreSQL database
- **api**: ElysiaJS backend
- **web**: SvelteKit frontend

Each service can reference others by name. The `api` service connects to
`db:5432` because Docker's internal DNS resolves `db` to the database
container's IP.

### Key Decisions

1. **Why volumes for the database?** Without a volume, data is lost when the
   container stops. The named volume `postgres_data` persists across restarts.

2. **Why `depends_on` with health checks?** The API can't start until the
   database is ready. `depends_on` with `condition: service_healthy` ensures
   proper startup order.

3. **Why bind mounts for code?** During development, we want code changes to
   immediately reflect in containers. Bind mounts (`./apps/api:/app`) sync your
   local files into the container.

### Implementation Steps

1. Create `compose.yaml` at the project root:

```yaml
services:
  # PostgreSQL database
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: ft_transcendence
    volumes:
      # Named volume for data persistence
      - postgres_data:/var/lib/postgresql/data
    ports:
      # Expose for local database tools (optional)
      - "5432:5432"
    healthcheck:
      # Check if database is ready to accept connections
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  # ElysiaJS backend
  api:
    build:
      context: ./apps/api
      dockerfile: Dockerfile
    environment:
      DATABASE_URL: postgres://postgres:postgres@db:5432/ft_transcendence
      NODE_ENV: development
    ports:
      - "4000:4000"
    depends_on:
      db:
        condition: service_healthy
    volumes:
      # Bind mount for hot reload during development
      - ./apps/api:/app
      - /app/node_modules
    command: bun run dev

  # SvelteKit frontend
  web:
    build:
      context: ./apps/web
      dockerfile: Dockerfile
    environment:
      API_URL: http://api:4000
    ports:
      - "5173:5173"
    depends_on:
      - api
    volumes:
      - ./apps/web:/app
      - /app/node_modules
    command: bun run dev -- --host

volumes:
  postgres_data:
```

2. Create `apps/api/Dockerfile`:

```dockerfile
FROM oven/bun:1-alpine

WORKDIR /app

# Copy package files first (better layer caching)
COPY package.json bun.lockb* ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Expose the API port
EXPOSE 4000

# Default command (overridden by compose for dev)
CMD ["bun", "run", "src/index.ts"]
```

3. Create `apps/web/Dockerfile`:

```dockerfile
FROM oven/bun:1-alpine

WORKDIR /app

# Copy package files
COPY package.json bun.lockb* ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Expose the dev server port
EXPOSE 5173

# Default command
CMD ["bun", "run", "dev", "--", "--host"]
```

4. Create `.dockerignore` in both `apps/api/` and `apps/web/`:

```
node_modules
dist
.svelte-kit
drizzle/*.sql
```

5. Start the stack:

```bash
docker compose up --build
```

6. Run initial migrations:

```bash
docker compose exec api bun run migrate
```

### Checkpoint

After this phase:

- `docker compose up --build` starts all services
- Database is accessible at `localhost:5432`
- API is accessible at `localhost:4000`
- Frontend is accessible at `localhost:5173`
- Changes to code trigger hot reload

### Common Pitfalls

- **Port conflicts**. If port 5432 is in use, change the host port:
  `"5433:5432"`.
- **Volume permission issues**. On Linux, you may need to match container user
  to host user.
- **Database not ready**. If API fails to connect, the healthcheck may need more
  time. Increase `retries`.

---

## Phase 6: Code Quality Setup

### Learning Objective

Configure automated code formatting and linting with Ultracite (Biome preset).

### Understanding the Approach

Ultracite is a zero-config preset for Biome, a fast Rust-based linter and
formatter. Instead of configuring ESLint + Prettier separately, Biome handles
both in one tool.

Pre-commit hooks with Lefthook ensure code is formatted before every commit.
This prevents "fix formatting" commits and keeps the codebase consistent.

### Implementation Steps

1. Install Ultracite (already in root `package.json`):

```bash
bun install
```

2. Create `biome.json` at the root:

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.4/schema.json",
  "extends": ["ultracite"]
}
```

That's it! Ultracite provides sensible defaults for TypeScript projects.

3. Install and configure Lefthook for pre-commit hooks:

```bash
bun add -D lefthook
```

4. Create `lefthook.yml`:

```yaml
pre-commit:
  parallel: true
  commands:
    lint:
      glob: "*.{ts,tsx,js,jsx,svelte}"
      run: bun x ultracite check {staged_files}
    format:
      glob: "*.{ts,tsx,js,jsx,svelte,json,md}"
      run: bun x ultracite fix {staged_files} && git add {staged_files}

commit-msg:
  commands:
    commitlint:
      run: bun x commitlint --edit {1}
```

5. Install the git hooks:

```bash
bunx lefthook install
```

6. Test the setup:

```bash
# Check for issues
bun x ultracite check

# Auto-fix issues
bun x ultracite fix
```

### Checkpoint

After this phase:

- `bun x ultracite check` runs without errors
- Git commits trigger format/lint checks
- Code style is consistent across the project

### Common Pitfalls

- **Ignoring linter errors**. Fix them rather than disabling rules. The rules
  exist for good reasons.
- **Not running `lefthook install`**. The git hooks won't work until installed.

---

## Testing Your Implementation

### Manual Testing Checklist

1. **Database connection**:

   ```bash
   docker compose exec db psql -U postgres -d ft_transcendence -c "\dt"
   ```

   Should show your tables.

2. **API health**:

   ```bash
   curl http://localhost:4000/health
   ```

   Should return `{"status":"ok","timestamp":"..."}`.

3. **Frontend connection**:
   - Open `http://localhost:5173`
   - Should display API health status

4. **Type safety**:
   - In `apps/web/src/lib/api.ts`, hover over `api.health.get()`
   - Should show the return type matches the backend

5. **Code quality**:
   ```bash
   bun x ultracite check
   ```
   Should pass with no errors.

### What to Test After Changes

- After schema changes: Run `bun run generate` and `bun run migrate`
- After adding endpoints: Verify Eden Treaty types update
- After adding dependencies: Run `bun install` from root

---

## Troubleshooting

### "Cannot find module '@ft/api'"

**Cause:** Workspace linking failed.

**Solution:**

1. Verify `apps/api/package.json` has `"name": "@ft/api"`
2. Verify `apps/web/package.json` has `"@ft/api": "workspace:*"` in dependencies
3. Run `bun install` from the project root

### "CORS policy: No 'Access-Control-Allow-Origin' header"

**Cause:** Backend isn't allowing frontend origin.

**Solution:** Check CORS configuration in `apps/api/src/index.ts`:

```typescript
cors({
  origin: ["http://localhost:5173"],
  credentials: true,
});
```

### "Connection refused" on database

**Cause:** Database container not ready or wrong connection string.

**Solution:**

1. Check database is running: `docker compose ps`
2. Check logs: `docker compose logs db`
3. Verify DATABASE_URL matches compose service name: `db:5432`

### "Port already in use"

**Cause:** Another process is using the port.

**Solution:**

1. Find the process: `lsof -i :4000`
2. Kill it or change the port in compose.yaml

---

## Going Deeper

### Official Documentation

- [Bun Documentation](https://bun.sh/docs)
- [ElysiaJS Documentation](https://elysiajs.com/)
- [SvelteKit Documentation](https://kit.svelte.dev/docs)
- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [Eden Treaty Guide](https://elysiajs.com/eden/treaty/overview.html)

### Related Patterns

- **Vertical Slice Architecture**:
  [Jimmy Bogard's article](https://www.jimmybogard.com/vertical-slice-architecture/)
- **Repository Pattern**: Abstracting data access for testability
- **Dependency Injection**: Making services configurable (covered in auth
  tutorial)

### Suggested Improvements

- Add TypeScript path aliases for cleaner imports
- Configure environment-specific settings
- Add health checks for all services in Docker
- Set up CI/CD with GitHub Actions

---

## Self-Assessment Questions

1. **Conceptual**: Why do we export `type App = typeof app` from the backend?
   What would happen if we didn't?

2. **Application**: If you added a new endpoint `GET /api/stats` to the backend,
   what steps would you take to use it in the frontend with full type safety?

3. **Extension**: How would you modify the Docker setup to use an Nginx reverse
   proxy that serves both frontend and API on the same port?

4. **Debugging**: You see "cannot find module" when importing from `@ft/api`.
   List three things you would check.

5. **Architecture**: Why does vertical slice architecture reduce merge conflicts
   compared to layered architecture?
