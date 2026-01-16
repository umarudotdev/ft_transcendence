# Development Guide

This guide walks through implementing a feature following the best practices
established in this codebase.

## Architecture Overview

This project uses **Vertical Slice Architecture** - code is organized by feature
module, not by technical layer:

```
apps/api/src/modules/[feature]/
├── [feature].controller.ts   # HTTP routes + validation (TypeBox)
├── [feature].service.ts      # Business logic
├── [feature].repository.ts   # Database access (Drizzle ORM)
└── domain/                   # Pure logic (no framework dependencies)
```

### Layer Responsibilities

| Layer          | Responsibility                   | Rules                                  |
| -------------- | -------------------------------- | -------------------------------------- |
| **Controller** | HTTP routing, request validation | No DB access, no business logic        |
| **Service**    | Business logic, orchestration    | No Elysia imports, no direct DB access |
| **Repository** | Database queries only            | No business logic, return raw data     |
| **Domain**     | Pure game/business logic         | No framework imports whatsoever        |

---

## Step-by-Step Implementation

This guide uses a "Tournaments" feature as a concrete example.

---

## 1. Database Schema

Define your tables in the shared schema file.

**File:** `apps/api/src/db/schema.ts`

```typescript
import {
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./schema";

// Define enums first
export const tournamentStatusEnum = pgEnum("tournament_status", [
  "pending",
  "in_progress",
  "completed",
]);

// Define the table
export const tournaments = pgTable("tournaments", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  creatorId: integer("creator_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  status: tournamentStatusEnum("status").default("pending").notNull(),
  maxPlayers: integer("max_players").notNull().default(8),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Define relations for query builder
export const tournamentsRelations = relations(tournaments, ({ one, many }) => ({
  creator: one(users, {
    fields: [tournaments.creatorId],
    references: [users.id],
  }),
  participants: many(tournamentParticipants),
}));
```

### Generate and Run Migration

```bash
cd apps/api
bun run generate   # Creates migration file in drizzle/
bun run migrate    # Applies migration to database
```

**Important:** Never modify the database directly. All changes go through
migrations.

---

## 2. Repository Layer

The repository is the **only place** where database access is allowed.

**File:** `apps/api/src/modules/tournaments/tournaments.repository.ts`

```typescript
import { db } from "../../db";
import { tournaments } from "../../db/schema";
import { eq } from "drizzle-orm";

export const tournamentsRepository = {
  async findAll() {
    return db.query.tournaments.findMany({
      with: {
        creator: true,
        participants: true,
      },
      orderBy: (t, { desc }) => [desc(t.createdAt)],
    });
  },

  async findById(id: number) {
    return db.query.tournaments.findFirst({
      where: eq(tournaments.id, id),
      with: {
        creator: true,
        participants: {
          with: { user: true },
        },
      },
    });
  },

  async create(data: { name: string; creatorId: number; maxPlayers?: number }) {
    const [tournament] = await db.insert(tournaments).values(data).returning();
    return tournament;
  },

  async updateStatus(
    id: number,
    status: "pending" | "in_progress" | "completed",
  ) {
    const [updated] = await db
      .update(tournaments)
      .set({ status })
      .where(eq(tournaments.id, id))
      .returning();
    return updated;
  },

  async delete(id: number) {
    await db.delete(tournaments).where(eq(tournaments.id, id));
  },
};
```

### Repository Rules

- Use Drizzle's query builder with `db.query` for reads with relations
- Use `db.insert`, `db.update`, `db.delete` for writes
- Always use `.returning()` when you need the result
- Return raw data - no transformation or business logic
- Do not throw HTTP-specific errors

---

## 3. Service Layer

The service contains all business logic and validation rules.

**File:** `apps/api/src/modules/tournaments/tournaments.service.ts`

```typescript
import { tournamentsRepository } from "./tournaments.repository";

export const tournamentsService = {
  async listTournaments() {
    return tournamentsRepository.findAll();
  },

  async getTournament(id: number) {
    const tournament = await tournamentsRepository.findById(id);
    if (!tournament) {
      throw new Error("Tournament not found");
    }
    return tournament;
  },

  async createTournament(
    userId: number,
    data: { name: string; maxPlayers?: number },
  ) {
    // Business validation
    if (data.maxPlayers && (data.maxPlayers < 2 || data.maxPlayers > 16)) {
      throw new Error("Max players must be between 2 and 16");
    }

    return tournamentsRepository.create({
      name: data.name,
      creatorId: userId,
      maxPlayers: data.maxPlayers ?? 8,
    });
  },

  async startTournament(userId: number, tournamentId: number) {
    const tournament = await tournamentsRepository.findById(tournamentId);

    // Business rule validations
    if (!tournament) {
      throw new Error("Tournament not found");
    }
    if (tournament.creatorId !== userId) {
      throw new Error("Only the creator can start the tournament");
    }
    if (tournament.status !== "pending") {
      throw new Error("Tournament has already started");
    }
    if (tournament.participants.length < 2) {
      throw new Error("Need at least 2 participants to start");
    }

    return tournamentsRepository.updateStatus(tournamentId, "in_progress");
  },

  async joinTournament(userId: number, tournamentId: number) {
    const tournament = await tournamentsRepository.findById(tournamentId);

    if (!tournament) {
      throw new Error("Tournament not found");
    }
    if (tournament.status !== "pending") {
      throw new Error("Cannot join a tournament that has started");
    }
    if (tournament.participants.length >= tournament.maxPlayers) {
      throw new Error("Tournament is full");
    }

    const alreadyJoined = tournament.participants.some(
      (p) => p.userId === userId,
    );
    if (alreadyJoined) {
      throw new Error("Already joined this tournament");
    }

    // Add participant logic here
    return tournament;
  },
};
```

### Service Rules

- Framework-agnostic: no Elysia or Express imports
- Contains all business rules and validation
- Calls repository for data access
- Throws plain `Error` objects (controller handles HTTP codes)
- Can call other services for cross-feature logic

---

## 4. Controller Layer

The controller handles HTTP concerns: routing, validation, and response
formatting.

**File:** `apps/api/src/modules/tournaments/tournaments.controller.ts`

```typescript
import { Elysia, t } from "elysia";
import { tournamentsService } from "./tournaments.service";

export const tournamentsController = new Elysia({ prefix: "/tournaments" })
  // List all tournaments
  .get("/", async () => {
    const tournaments = await tournamentsService.listTournaments();
    return { tournaments };
  })
  // Get single tournament by ID
  .get(
    "/:id",
    async ({ params, error }) => {
      try {
        const tournament = await tournamentsService.getTournament(params.id);
        return { tournament };
      } catch (e) {
        return error(404, { message: (e as Error).message });
      }
    },
    {
      params: t.Object({
        id: t.Numeric(), // Converts string param to number
      }),
    },
  )
  // Create a new tournament
  .post(
    "/",
    async ({ body, error }) => {
      // TODO: Extract userId from authenticated session
      const userId = 1;

      try {
        const tournament = await tournamentsService.createTournament(
          userId,
          body,
        );
        return { tournament };
      } catch (e) {
        return error(400, { message: (e as Error).message });
      }
    },
    {
      body: t.Object({
        name: t.String({ minLength: 3, maxLength: 50 }),
        maxPlayers: t.Optional(t.Integer({ minimum: 2, maximum: 16 })),
      }),
    },
  )
  // Start a tournament
  .post(
    "/:id/start",
    async ({ params, error }) => {
      const userId = 1;

      try {
        const tournament = await tournamentsService.startTournament(
          userId,
          params.id,
        );
        return { tournament };
      } catch (e) {
        const message = (e as Error).message;
        if (message.includes("not found")) {
          return error(404, { message });
        }
        if (message.includes("Only the creator")) {
          return error(403, { message });
        }
        return error(400, { message });
      }
    },
    {
      params: t.Object({
        id: t.Numeric(),
      }),
    },
  )
  // Join a tournament
  .post(
    "/:id/join",
    async ({ params, error }) => {
      const userId = 1;

      try {
        const tournament = await tournamentsService.joinTournament(
          userId,
          params.id,
        );
        return { tournament };
      } catch (e) {
        return error(400, { message: (e as Error).message });
      }
    },
    {
      params: t.Object({
        id: t.Numeric(),
      }),
    },
  )
  // Delete a tournament
  .delete(
    "/:id",
    async ({ params, error }) => {
      const userId = 1;

      try {
        await tournamentsService.deleteTournament(userId, params.id);
        return { success: true };
      } catch (e) {
        return error(400, { message: (e as Error).message });
      }
    },
    {
      params: t.Object({
        id: t.Numeric(),
      }),
    },
  );
```

### Controller Rules

- Use TypeBox `t.*` for all request validation
- Never access the database directly
- Keep handlers thin - delegate to service
- Map service errors to appropriate HTTP status codes
- Export as a named constant

### TypeBox Validation Reference

```typescript
// Common validation patterns
t.String({ minLength: 1, maxLength: 100 });
t.Integer({ minimum: 0, maximum: 100 });
t.Numeric(); // String -> Number conversion
t.Optional(t.String()); // Optional field
t.Array(t.String()); // Array of strings
t.Union([t.Literal("a"), t.Literal("b")]); // Enum-like
t.Object({ nested: t.String() }); // Nested object
```

---

## 5. Register the Controller

Add the controller to the main app.

**File:** `apps/api/src/index.ts`

```typescript
import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { authController } from "./modules/auth/auth.controller";
import { usersController } from "./modules/users/users.controller";
import { gameController } from "./modules/game/game.controller";
import { chatController } from "./modules/chat/chat.controller";
import { tournamentsController } from "./modules/tournaments/tournaments.controller";

const app = new Elysia()
  .use(cors())
  .get("/health", () => ({
    status: "ok",
    timestamp: new Date().toISOString(),
  }))
  .group("/api", (app) =>
    app
      .use(authController)
      .use(usersController)
      .use(gameController)
      .use(chatController)
      .use(tournamentsController))
  .listen(4000);

export type App = typeof app;
```

The `export type App` is critical - it enables Eden Treaty's type inference.

---

## 6. Frontend: API Integration

### Eden Treaty Client

The API client is already configured in `apps/web/src/lib/api.ts`:

```typescript
import { treaty } from "@elysiajs/eden";
import type { App } from "../../../api/src/index";

const baseUrl = typeof window !== "undefined"
  ? window.location.origin
  : "http://localhost:4000";

export const api = treaty<App>(baseUrl);
```

### Using the API in Components

**File:** `apps/web/src/routes/tournaments/+page.svelte`

```svelte
<script lang="ts">
  import { api } from "$lib/api";
  import { onMount } from "svelte";

  // Svelte 5 runes for reactive state
  let tournaments = $state<
    Array<{
      id: number;
      name: string;
      status: string;
      maxPlayers: number;
    }>
  >([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let newTournamentName = $state("");

  onMount(async () => {
    await loadTournaments();
  });

  async function loadTournaments() {
    loading = true;
    error = null;

    try {
      const { data, error: apiError } = await api.api.tournaments.index.get();

      if (apiError) {
        error = "Failed to load tournaments";
        return;
      }

      tournaments = data?.tournaments ?? [];
    } catch (e) {
      error = "Network error";
    } finally {
      loading = false;
    }
  }

  async function createTournament() {
    if (!newTournamentName.trim()) return;

    const { data, error: apiError } = await api.api.tournaments.index.post({
      name: newTournamentName,
      maxPlayers: 8,
    });

    if (apiError) {
      error = apiError.value?.message ?? "Failed to create tournament";
      return;
    }

    if (data?.tournament) {
      tournaments = [data.tournament, ...tournaments];
      newTournamentName = "";
    }
  }

  async function joinTournament(id: number) {
    const { error: apiError } = await api.api.tournaments({ id }).join.post();

    if (apiError) {
      error = apiError.value?.message ?? "Failed to join";
      return;
    }

    await loadTournaments();
  }
</script>

<div class="container mx-auto p-4">
  <h1 class="text-2xl font-bold mb-4">Tournaments</h1>

  <!-- Create Form -->
  <form onsubmit={createTournament} class="mb-6 flex gap-2">
    <input
      type="text"
      bind:value={newTournamentName}
      placeholder="Tournament name"
      class="border rounded px-3 py-2 flex-1"
    />
    <button type="submit" class="bg-primary text-primary-foreground px-4 py-2 rounded">
      Create
    </button>
  </form>

  <!-- Error Display -->
  {#if error}
    <div class="bg-destructive/10 text-destructive p-3 rounded mb-4">
      {error}
    </div>
  {/if}

  <!-- Loading State -->
  {#if loading}
    <p class="text-muted-foreground">Loading tournaments...</p>
  {:else if tournaments.length === 0}
    <p class="text-muted-foreground">No tournaments yet.</p>
  {:else}
    <!-- Tournament List -->
    <ul class="space-y-2">
      {#each tournaments as tournament (tournament.id)}
        <li class="border rounded p-4 flex justify-between items-center">
          <div>
            <a href="/tournaments/{tournament.id}" class="font-medium hover:underline">
              {tournament.name}
            </a>
            <span class="text-sm text-muted-foreground ml-2">
              ({tournament.status})
            </span>
          </div>

          {#if tournament.status === "pending"}
            <button
              onclick={() => joinTournament(tournament.id)}
              class="text-sm bg-secondary px-3 py-1 rounded"
            >
              Join
            </button>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</div>
```

### Eden Treaty API Patterns

```typescript
// GET /api/tournaments
await api.api.tournaments.index.get();

// GET /api/tournaments/:id
await api.api.tournaments({ id: 123 }).get();

// POST /api/tournaments
await api.api.tournaments.index.post({ name: "My Tournament" });

// POST /api/tournaments/:id/start
await api.api.tournaments({ id: 123 }).start.post();

// DELETE /api/tournaments/:id
await api.api.tournaments({ id: 123 }).delete();
```

---

## 7. Server-Side Data Loading (SSR)

For better SEO and initial load performance, use SvelteKit's server-side
loading.

**File:** `apps/web/src/routes/tournaments/+page.server.ts`

```typescript
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ fetch }) => {
  try {
    const res = await fetch("http://localhost:4000/api/tournaments");

    if (!res.ok) {
      return { tournaments: [], error: "Failed to load" };
    }

    const data = await res.json();
    return { tournaments: data.tournaments ?? [] };
  } catch {
    return { tournaments: [], error: "Server unavailable" };
  }
};
```

**File:** `apps/web/src/routes/tournaments/+page.svelte`

```svelte
<script lang="ts">
  // Data from server load function
  let { data } = $props();
</script>

{#if data.error}
  <p class="text-destructive">{data.error}</p>
{/if}

<ul>
  {#each data.tournaments as tournament}
    <li>{tournament.name}</li>
  {/each}
</ul>
```

---

## 8. Svelte Stores (Client State)

For complex client-side state that needs to be shared across components.

**File:** `apps/web/src/lib/stores/tournaments.ts`

```typescript
import { derived, writable } from "svelte/store";
import { api } from "$lib/api";

interface Tournament {
  id: number;
  name: string;
  status: "pending" | "in_progress" | "completed";
  maxPlayers: number;
  creatorId: number;
}

function createTournamentsStore() {
  const { subscribe, set, update } = writable<Tournament[]>([]);

  return {
    subscribe,

    async load() {
      const { data } = await api.api.tournaments.index.get();
      if (data?.tournaments) {
        set(data.tournaments);
      }
    },

    async create(name: string, maxPlayers = 8) {
      const { data } = await api.api.tournaments.index.post({
        name,
        maxPlayers,
      });

      if (data?.tournament) {
        update((list) => [data.tournament, ...list]);
        return data.tournament;
      }
      return null;
    },

    async join(id: number) {
      const { error } = await api.api.tournaments({ id }).join.post();
      if (!error) {
        // Reload to get updated participant list
        await this.load();
      }
      return !error;
    },

    remove(id: number) {
      update((list) => list.filter((t) => t.id !== id));
    },
  };
}

export const tournaments = createTournamentsStore();

// Derived store for filtering
export const pendingTournaments = derived(
  tournaments,
  ($tournaments) => $tournaments.filter((t) => t.status === "pending"),
);
```

**Usage in component:**

```svelte
<script lang="ts">
  import { tournaments, pendingTournaments } from "$lib/stores/tournaments";
  import { onMount } from "svelte";

  onMount(() => {
    tournaments.load();
  });
</script>

<p>Pending: {$pendingTournaments.length}</p>

{#each $tournaments as tournament}
  <div>{tournament.name}</div>
{/each}
```

---

## 9. WebSocket Integration

For real-time features like game state or chat.

**Backend Controller:**

```typescript
export const tournamentsController = new Elysia({ prefix: "/tournaments" })
  // ... HTTP routes ...

  .ws("/ws", {
    query: t.Object({
      tournamentId: t.Numeric(),
    }),

    open(ws) {
      const { tournamentId } = ws.data.query;
      ws.subscribe(`tournament:${tournamentId}`);
      console.log(`Client joined tournament ${tournamentId}`);
    },

    message(ws, message) {
      // Handle incoming messages
      const { tournamentId } = ws.data.query;
      ws.publish(`tournament:${tournamentId}`, {
        type: "update",
        data: message,
      });
    },

    close(ws) {
      const { tournamentId } = ws.data.query;
      ws.unsubscribe(`tournament:${tournamentId}`);
    },
  });
```

**Frontend WebSocket:**

```svelte
<script lang="ts">
  import { onMount, onDestroy } from "svelte";

  let ws: WebSocket | null = null;
  let messages = $state<Array<{ type: string; data: unknown }>>([]);

  export let tournamentId: number;

  onMount(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/api/tournaments/ws?tournamentId=${tournamentId}`;

    ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      messages = [...messages, data];
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };
  });

  onDestroy(() => {
    ws?.close();
  });

  function sendMessage(data: unknown) {
    ws?.send(JSON.stringify(data));
  }
</script>
```

---

## 10. Authentication Guard Pattern

Protect routes that require authentication.

**File:** `apps/api/src/common/guards/auth.guard.ts`

```typescript
import { Elysia } from "elysia";
import { db } from "../../db";
import { sessions, users } from "../../db/schema";
import { and, eq, gt } from "drizzle-orm";

export const authGuard = new Elysia({ name: "auth-guard" }).derive(
  async ({ cookie, error }) => {
    const sessionId = cookie.session?.value;

    if (!sessionId) {
      return error(401, { message: "Not authenticated" });
    }

    const session = await db.query.sessions.findFirst({
      where: and(
        eq(sessions.id, sessionId),
        gt(sessions.expiresAt, new Date()),
      ),
      with: { user: true },
    });

    if (!session) {
      return error(401, { message: "Invalid or expired session" });
    }

    return {
      user: session.user,
      session,
    };
  },
);
```

**Using the guard:**

```typescript
import { authGuard } from "../../common/guards/auth.guard";

export const tournamentsController = new Elysia({ prefix: "/tournaments" })
  // Public route - no guard
  .get("/", async () => {
    return { tournaments: await tournamentsService.listTournaments() };
  })
  // Protected routes - use guard
  .use(authGuard)
  .post("/", async ({ body, user }) => {
    // `user` is now available from the guard
    const tournament = await tournamentsService.createTournament(user.id, body);
    return { tournament };
  });
```

---

## File Structure Summary

After implementing a feature, your structure should look like:

```
apps/api/src/
├── common/
│   └── guards/
│       └── auth.guard.ts
├── db/
│   ├── index.ts
│   ├── schema.ts          # Add new tables here
│   └── migrate.ts
└── modules/
    └── tournaments/
        ├── tournaments.controller.ts
        ├── tournaments.service.ts
        ├── tournaments.repository.ts
        └── domain/        # Optional: pure logic classes

apps/web/src/
├── lib/
│   ├── api.ts
│   ├── stores/
│   │   └── tournaments.ts
│   └── components/
│       └── TournamentCard.svelte
└── routes/
    └── tournaments/
        ├── +page.svelte
        ├── +page.server.ts
        └── [id]/
            └── +page.svelte
```

---

## Checklist

When implementing a new feature:

- [ ] Define database schema in `apps/api/src/db/schema.ts`
- [ ] Run `bun run generate && bun run migrate`
- [ ] Create repository with database queries
- [ ] Create service with business logic
- [ ] Create controller with routes and validation
- [ ] Register controller in `apps/api/src/index.ts`
- [ ] Create frontend pages/components
- [ ] Use Eden Treaty for type-safe API calls
- [ ] Add Svelte stores if needed for client state
- [ ] Use SSR load functions for initial data
- [ ] Test all endpoints manually or with automated tests

---

## Common Patterns Reference

### TypeBox Validation

```typescript
t.String({ minLength: 1, maxLength: 255 });
t.Integer({ minimum: 0 });
t.Numeric(); // Converts "123" to 123
t.Optional(t.String());
t.Array(t.Object({ id: t.Number() }));
t.Union([t.Literal("a"), t.Literal("b")]);
```

### Drizzle Queries

```typescript
// Select with relations
db.query.tournaments.findMany({
  with: { creator: true },
  where: eq(tournaments.status, "pending"),
  orderBy: (t, { desc }) => [desc(t.createdAt)],
  limit: 10,
});

// Insert
db.insert(tournaments).values({ name: "Test" }).returning();

// Update
db.update(tournaments)
  .set({ status: "completed" })
  .where(eq(tournaments.id, 1))
  .returning();

// Delete
db.delete(tournaments).where(eq(tournaments.id, 1));
```

### Svelte 5 Runes

```svelte
<script lang="ts">
  // Props
  let { tournament, onJoin } = $props<{
    tournament: Tournament;
    onJoin: (id: number) => void;
  }>();

  // Reactive state
  let count = $state(0);
  let doubled = $derived(count * 2);

  // Effects
  $effect(() => {
    console.log("Count changed:", count);
  });
</script>
```

### Eden Treaty Calls

```typescript
// Response structure
const { data, error, status } = await api.endpoint.get();

// Check for errors
if (error) {
  console.error(error.value?.message);
}

// Access data
if (data) {
  console.log(data.tournaments);
}
```
