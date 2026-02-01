# Drizzle ORM Guide

This guide covers everything you need to know about using Drizzle ORM in the ft_transcendence project.

## Table of Contents

1. [Overview](#overview)
2. [Project Setup](#project-setup)
3. [Schema Definition](#schema-definition)
4. [Query Patterns](#query-patterns)
5. [Migration Workflow](#migration-workflow)
6. [Repository Pattern](#repository-pattern)
7. [Testing](#testing)
8. [Common Pitfalls](#common-pitfalls)
9. [Best Practices](#best-practices)

---

## Overview

We use [Drizzle ORM](https://orm.drizzle.team/) with PostgreSQL for type-safe database operations. Drizzle provides:

- **Type Safety**: Full TypeScript inference from schema definitions
- **SQL-like API**: Familiar syntax for developers comfortable with SQL
- **Performance**: Minimal overhead, no heavy abstractions
- **Migrations**: Built-in migration generation and management

### Key Files

```
apps/api/
├── drizzle.config.ts          # Drizzle Kit configuration
├── drizzle/                   # Generated migrations
│   ├── 0000_*.sql            # Migration files
│   └── meta/                 # Migration metadata
└── src/db/
    ├── index.ts              # Database connection
    ├── schema.ts             # All table definitions
    ├── seed.ts               # Test data seeding
    └── test-utils.ts         # Testing utilities
```

---

## Project Setup

### Environment Variables

```bash
# Required for all database operations
DATABASE_URL=postgres://user:password@localhost:5432/ft_transcendence
```

### Running with Docker (Recommended)

```bash
docker compose up -d db    # Start PostgreSQL only
docker compose up --build  # Start full stack
```

### Local Development

```bash
# 1. Start PostgreSQL (Docker or local)
docker compose up -d db

# 2. Run migrations
cd apps/api && bun run migrate

# 3. (Optional) Seed test data
cd apps/api && bun run seed
```

---

## Schema Definition

### Creating a Table

```typescript
// src/db/schema.ts
import { pgTable, serial, text, timestamp, integer, boolean, index, unique } from "drizzle-orm/pg-core";

export const users = pgTable(
  "users",
  {
    // Primary key with auto-increment
    id: serial("id").primaryKey(),

    // Required text field with unique constraint
    email: text("email").unique().notNull(),

    // Optional field (nullable by default)
    avatarUrl: text("avatar_url"),

    // Boolean with default
    isActive: boolean("is_active").default(true).notNull(),

    // Timestamps with timezone
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  // Indexes and constraints
  (table) => [
    index("users_email_idx").on(table.email),
  ]
);
```

### Foreign Keys

```typescript
export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),

  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),

  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});
```

### Composite Unique Constraints

```typescript
export const channelMembers = pgTable(
  "channel_members",
  {
    id: serial("id").primaryKey(),
    channelId: integer("channel_id").notNull(),
    userId: integer("user_id").notNull(),
  },
  (table) => [
    // Composite unique constraint
    unique("channel_members_channel_user_unique").on(
      table.channelId,
      table.userId
    ),
  ]
);
```

### Defining Relations

Relations enable the query builder to join tables automatically:

```typescript
import { relations } from "drizzle-orm";

export const usersRelations = relations(users, ({ many, one }) => ({
  // One-to-many: a user has many sessions
  sessions: many(sessions),

  // One-to-one: a user has one profile
  profile: one(userProfiles),

  // Named relations for disambiguation
  sentMessages: many(messages, { relationName: "sentMessages" }),
  receivedMessages: many(messages, { relationName: "receivedMessages" }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  // Many-to-one: a session belongs to one user
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));
```

### Type Exports

Always export inferred types for use in services:

```typescript
// Select type (for reading)
export type User = typeof users.$inferSelect;

// Insert type (for creating)
export type NewUser = typeof users.$inferInsert;
```

---

## Query Patterns

### Basic CRUD

```typescript
import { eq, and, or, desc, sql } from "drizzle-orm";
import { db } from "../db";
import { users } from "../db/schema";

// CREATE
const [newUser] = await db
  .insert(users)
  .values({
    email: "user@example.com",
    displayName: "John Doe",
  })
  .returning();

// READ (single)
const user = await db.query.users.findFirst({
  where: eq(users.id, 1),
});

// READ (multiple)
const allUsers = await db.query.users.findMany({
  where: eq(users.isActive, true),
  orderBy: [desc(users.createdAt)],
  limit: 10,
});

// UPDATE
const [updated] = await db
  .update(users)
  .set({ displayName: "Jane Doe", updatedAt: new Date() })
  .where(eq(users.id, 1))
  .returning();

// DELETE
await db.delete(users).where(eq(users.id, 1));
```

### Filtering

```typescript
// AND conditions
const result = await db.query.users.findMany({
  where: and(
    eq(users.isActive, true),
    eq(users.emailVerified, true)
  ),
});

// OR conditions
const result = await db.query.users.findMany({
  where: or(
    eq(users.role, "admin"),
    eq(users.role, "moderator")
  ),
});

// Complex conditions
const result = await db.query.matches.findMany({
  where: and(
    or(
      eq(matches.player1Id, userId),
      eq(matches.player2Id, userId)
    ),
    eq(matches.gameType, "pong")
  ),
});
```

### Relations (Joins)

```typescript
// Include related data
const userWithSessions = await db.query.users.findFirst({
  where: eq(users.id, 1),
  with: {
    sessions: true,  // Include all sessions
    profile: true,   // Include profile
  },
});

// Select specific columns from relations
const match = await db.query.matches.findFirst({
  where: eq(matches.id, matchId),
  with: {
    player1: {
      columns: { id: true, displayName: true, avatarUrl: true },
    },
    player2: {
      columns: { id: true, displayName: true, avatarUrl: true },
    },
  },
});
```

### Aggregations

```typescript
import { count, avg, sum, sql } from "drizzle-orm";

// Count
const [result] = await db
  .select({ count: count() })
  .from(matches)
  .where(eq(matches.player1Id, userId));

// Average
const [result] = await db
  .select({ avgDuration: avg(matches.duration) })
  .from(matches);

// Custom SQL
const [result] = await db
  .select({
    total: sql<number>`count(*)::int`,
    avgScore: sql<number>`AVG(${matches.player1Score})`,
  })
  .from(matches);
```

### Raw SQL (escape hatch)

```typescript
// For complex queries not supported by the builder
const result = await db.execute(sql`
  SELECT u.*, COUNT(m.id) as match_count
  FROM users u
  LEFT JOIN matches m ON m.player1_id = u.id OR m.player2_id = u.id
  GROUP BY u.id
  ORDER BY match_count DESC
  LIMIT 10
`);
```

---

## Migration Workflow

### Adding a New Table

1. **Edit the schema**

   ```typescript
   // src/db/schema.ts
   export const newTable = pgTable("new_table", {
     id: serial("id").primaryKey(),
     name: text("name").notNull(),
   });
   ```

2. **Generate migration**

   ```bash
   cd apps/api && bun run generate
   ```

3. **Review the generated SQL** in `drizzle/XXXX_*.sql`

4. **Apply migration**

   ```bash
   cd apps/api && bun run migrate
   ```

5. **Commit both** `schema.ts` and migration files together

### Modifying Existing Tables

Same workflow, but be careful with:

- **Adding NOT NULL columns**: Provide a default or make migration in two steps
- **Renaming columns**: Drizzle may generate DROP + ADD instead of RENAME
- **Removing columns**: Data will be lost

### Rolling Back

Drizzle doesn't have built-in rollback. For manual rollback:

```bash
# Connect to database
docker compose exec db psql -U postgres -d ft_transcendence

# View migration history
SELECT * FROM __drizzle_migrations;

# Manual rollback (example)
DROP TABLE new_table;
DELETE FROM __drizzle_migrations WHERE hash = 'migration_hash';
```

---

## Repository Pattern

We use the repository pattern to isolate database queries. Controllers never access the database directly.

### Repository Structure

```typescript
// modules/users/users.repository.ts
import { eq } from "drizzle-orm";
import { db } from "../../db";
import { users } from "../../db/schema";

export const usersRepository = {
  async findById(id: number) {
    return db.query.users.findFirst({
      where: eq(users.id, id),
    });
  },

  async findByEmail(email: string) {
    return db.query.users.findFirst({
      where: eq(users.email, email.toLowerCase()),
    });
  },

  async create(data: { email: string; displayName: string }) {
    const [user] = await db
      .insert(users)
      .values({
        email: data.email.toLowerCase(),
        displayName: data.displayName,
      })
      .returning();
    return user;
  },

  async updateProfile(id: number, data: { displayName?: string }) {
    const [updated] = await db
      .update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return updated;
  },
};
```

### Using in Services

```typescript
// modules/users/users.service.ts
import { usersRepository } from "./users.repository";

export const UsersService = {
  async getProfile(userId: number) {
    const user = await usersRepository.findById(userId);
    if (!user) {
      return { type: "NOT_FOUND" as const };
    }
    return { type: "SUCCESS" as const, user };
  },
};
```

---

## Testing

### Setup Test Database

Tests use the same schema but a separate database (or the same with cleanup):

```typescript
// src/db/test-utils.ts
import { createTestDb, cleanDatabase, createTestUser } from "./test-utils";

const { db, close } = createTestDb();

beforeEach(async () => {
  await cleanDatabase(db);
});

afterAll(async () => {
  await close();
});
```

### Writing Integration Tests

```typescript
// src/db/integration/users.repository.test.ts
import { describe, expect, test, beforeEach, afterAll } from "bun:test";
import { eq } from "drizzle-orm";
import * as schema from "../schema";
import { createTestDb, cleanDatabase, createTestUser } from "../test-utils";

describe("Users Repository", () => {
  const { db, close } = createTestDb();

  beforeEach(async () => {
    await cleanDatabase(db);
  });

  afterAll(async () => {
    await close();
  });

  test("creates a user", async () => {
    const [user] = await db
      .insert(schema.users)
      .values({
        email: "test@example.com",
        displayName: "Test User",
        username: "testuser",
      })
      .returning();

    expect(user.email).toBe("test@example.com");
  });

  test("enforces unique email", async () => {
    await createTestUser(db, { email: "unique@test.com" });

    await expect(
      createTestUser(db, { email: "unique@test.com" })
    ).rejects.toThrow();
  });
});
```

### Running Tests

```bash
# All tests
cd apps/api && bun test

# Integration tests only
cd apps/api && bun test src/db/integration/

# Watch mode
cd apps/api && bun test --watch
```

---

## Common Pitfalls

### 1. Forgetting `.returning()`

```typescript
// ❌ Wrong - returns nothing
await db.insert(users).values({ email: "test@test.com" });

// ✅ Correct - returns inserted row
const [user] = await db
  .insert(users)
  .values({ email: "test@test.com" })
  .returning();
```

### 2. Case Sensitivity

```typescript
// ❌ Won't match "John@Example.com"
where: eq(users.email, "john@example.com")

// ✅ Store lowercase, query lowercase
.values({ email: data.email.toLowerCase() })
where: eq(users.email, email.toLowerCase())
```

### 3. Missing Relation Definitions

```typescript
// ❌ Error: relation not found
await db.query.users.findFirst({
  with: { sessions: true },
});

// ✅ Define relations in schema.ts
export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
}));
```

### 4. Implicit Type Coercion

```typescript
// ❌ May cause issues
where: eq(users.id, "1")  // string instead of number

// ✅ Explicit types
where: eq(users.id, Number(id))
```

### 5. N+1 Queries

```typescript
// ❌ N+1 problem
const users = await db.query.users.findMany();
for (const user of users) {
  const sessions = await db.query.sessions.findMany({
    where: eq(sessions.userId, user.id),
  });
}

// ✅ Use relations
const users = await db.query.users.findMany({
  with: { sessions: true },
});
```

---

## Best Practices

### 1. Always Use Indexes

```typescript
// Add indexes for frequently queried columns
(table) => [
  index("users_email_idx").on(table.email),
  index("sessions_user_id_idx").on(table.userId),
  index("matches_created_at_idx").on(table.createdAt),
]
```

### 2. Use Transactions for Multiple Operations

```typescript
import { db } from "../db";

await db.transaction(async (tx) => {
  const [user] = await tx
    .insert(users)
    .values({ email: "test@test.com" })
    .returning();

  await tx.insert(userPoints).values({
    userId: user.id,
    balance: 100,
  });
});
```

### 3. Validate at the Edge

Don't rely on database constraints for validation—validate in controllers:

```typescript
// Controller validates, repository just executes
const UserSchema = Type.Object({
  email: Type.String({ format: "email" }),
  displayName: Type.String({ minLength: 1, maxLength: 50 }),
});
```

### 4. Keep Repositories Thin

Repositories should only contain database operations, no business logic:

```typescript
// ❌ Business logic in repository
async createUser(data) {
  if (data.password.length < 8) throw new Error("...");  // Wrong place
  // ...
}

// ✅ Business logic in service
// Service validates, then calls repository
```

### 5. Use Explicit Column Selection

For public APIs, select only needed columns:

```typescript
// ❌ Exposes all columns including sensitive data
return db.query.users.findFirst({ where: eq(users.id, id) });

// ✅ Select specific columns
return db.query.users.findFirst({
  where: eq(users.id, id),
  columns: {
    id: true,
    displayName: true,
    username: true,
    avatarUrl: true,
    // passwordHash: false (not included)
  },
});
```

---

## Quick Reference

| Task               | Command                               |
| ------------------ | ------------------------------------- |
| Generate migration | `cd apps/api && bun run generate`     |
| Apply migrations   | `cd apps/api && bun run migrate`      |
| Seed database      | `cd apps/api && bun run seed`         |
| Run tests          | `cd apps/api && bun test`             |
| Type check         | `cd apps/api && bun run tsc --noEmit` |

### Useful Links

- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [Drizzle Kit (Migrations)](https://orm.drizzle.team/kit-docs/overview)
- [PostgreSQL Column Types](https://orm.drizzle.team/docs/column-types/pg)
