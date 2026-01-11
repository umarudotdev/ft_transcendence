# Tutorial: User Profile System

> **Difficulty:** Intermediate **Time:** 4-5 hours **Prerequisites:** Completed
> Tutorials 01-02, basic understanding of Svelte components

## What You'll Learn

- Designing game-agnostic database schemas for match history
- Implementing avatar upload with image processing
- Building paginated APIs for match history
- Calculating and displaying player statistics
- Creating reusable Svelte components for profiles
- Implementing the friend system with status management
- Using SvelteKit load functions for SSR

## Conceptual Overview

The profile system is the social hub of your gaming platform. It answers
questions like:

- Who is this player? (identity)
- How good are they? (statistics)
- What have they done? (history)
- Who do they know? (social graph)

### Game-Agnostic Design

A key architectural decision: the profile system should work regardless of what
game is played. Today it's Pong, but tomorrow it might be Chess or Tetris. We
achieve this through:

1. **Generic match schema**: Stores scores and winner, not game-specific state
2. **Metadata field**: JSON blob for game-specific data when needed
3. **Game type identifier**: Allows filtering and separate statistics

```
Match
├── player1Id, player2Id (who played)
├── player1Score, player2Score (final scores)
├── winnerId (who won)
├── gameType: "pong" | "chess" | ... (what game)
├── metadata: { ... } (game-specific data)
└── duration (how long)
```

### The Profile Data Flow

```
┌─────────────────────────────────────────────────────────┐
│  Frontend                                                │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐           │
│  │ Profile  │  │  Stats   │  │ Match History│           │
│  │ Header   │  │  Card    │  │    List      │           │
│  └────┬─────┘  └────┬─────┘  └──────┬───────┘           │
│       │             │               │                    │
│       └─────────────┼───────────────┘                    │
│                     │                                    │
│              ┌──────┴──────┐                             │
│              │  API Client │                             │
│              │ (Eden Treaty│                             │
│              └──────┬──────┘                             │
└─────────────────────┼───────────────────────────────────┘
                      │ HTTP
┌─────────────────────┼───────────────────────────────────┐
│  Backend            │                                    │
│              ┌──────┴──────┐                             │
│              │ Controller  │ ← Validation, pagination    │
│              └──────┬──────┘                             │
│                     │                                    │
│              ┌──────┴──────┐                             │
│              │   Service   │ ← Stats calculation         │
│              └──────┬──────┘                             │
│                     │                                    │
│              ┌──────┴──────┐                             │
│              │ Repository  │ ← Database queries          │
│              └─────────────┘                             │
└─────────────────────────────────────────────────────────┘
```

---

## Phase 1: Database Schema for Profiles

### Learning Objective

Extend the database schema to support match history, statistics, and
friendships.

### Understanding the Approach

We need three new concepts:

1. **Matches**: Record of completed games
2. **Statistics**: Derived from matches (calculated, not stored)
3. **Friendships**: Social connections between users

For friendships, we use a **single-row representation** where each friendship is
stored once with a status:

- `pending`: Request sent, awaiting acceptance
- `accepted`: Both users are friends
- `blocked`: One user blocked the other

### Key Decisions

1. **Why is `player2Id` nullable?** AI games have no second player. Using null
   distinguishes human vs AI matches.

2. **Why `jsonb` for metadata?** Different games need different data. Pong might
   store ball speed, Chess might store move history. JSON is flexible.

3. **Why track `duration`?** It's useful for statistics ("average game length")
   and detecting anomalies (instant wins might indicate bugs).

4. **Why not store calculated stats?** Calculating on-the-fly from matches
   ensures consistency. Stored stats can become stale.

### Implementation Steps

1. Update your schema at `apps/api/src/db/schema.ts`:

```typescript
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Existing users table (from auth tutorial) - ensure these fields exist:
export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    email: text("email").unique().notNull(),
    passwordHash: text("password_hash"),
    emailVerified: boolean("email_verified").default(false).notNull(),
    displayName: text("display_name").notNull(),
    avatarUrl: text("avatar_url"),
    intraId: integer("intra_id").unique(),
    totpSecret: text("totp_secret"),
    twoFactorEnabled: boolean("two_factor_enabled").default(false).notNull(),
    failedLoginAttempts: integer("failed_login_attempts").default(0).notNull(),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    emailIdx: index("users_email_idx").on(table.email),
  })
);

// =============================================================================
// MATCHES TABLE
// =============================================================================
export const matches = pgTable(
  "matches",
  {
    id: serial("id").primaryKey(),

    // Player 1 is always present
    player1Id: integer("player1_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    // Player 2 is nullable for AI games
    player2Id: integer("player2_id").references(() => users.id, {
      onDelete: "cascade",
    }),

    // Scores
    player1Score: integer("player1_score").notNull(),
    player2Score: integer("player2_score").notNull(),

    // Winner - nullable for draws (if your game supports them)
    winnerId: integer("winner_id").references(() => users.id, {
      onDelete: "set null",
    }),

    // Game type for multi-game support
    gameType: text("game_type").notNull().default("pong"),

    // Is this an AI game?
    isAiGame: boolean("is_ai_game").notNull().default(false),

    // Game-specific metadata (e.g., ball speed, difficulty)
    metadata: jsonb("metadata"),

    // Game duration in seconds
    duration: integer("duration").notNull(),

    // When the match was played
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    // Index for fetching user's match history
    player1Idx: index("matches_player1_idx").on(table.player1Id),
    player2Idx: index("matches_player2_idx").on(table.player2Id),
    // Index for filtering by game type
    gameTypeIdx: index("matches_game_type_idx").on(table.gameType),
    // Index for chronological sorting
    createdAtIdx: index("matches_created_at_idx").on(table.createdAt),
  })
);

// =============================================================================
// FRIENDSHIPS TABLE
// =============================================================================
export const friendshipStatusEnum = pgEnum("friendship_status", [
  "pending",
  "accepted",
  "blocked",
]);

export const friendships = pgTable(
  "friendships",
  {
    id: serial("id").primaryKey(),

    // The user who initiated the relationship
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    // The target user
    friendId: integer("friend_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    // Current status of the relationship
    status: friendshipStatusEnum("status").notNull().default("pending"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),

    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    // Each user pair should only have one friendship record
    uniqueFriendship: uniqueIndex("unique_friendship").on(
      table.userId,
      table.friendId
    ),
    // Index for finding a user's friends
    userIdx: index("friendships_user_idx").on(table.userId),
    friendIdx: index("friendships_friend_idx").on(table.friendId),
  })
);

// =============================================================================
// RELATIONS
// =============================================================================
export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  matchesAsPlayer1: many(matches, { relationName: "player1" }),
  matchesAsPlayer2: many(matches, { relationName: "player2" }),
  friendships: many(friendships, { relationName: "initiator" }),
  friendOf: many(friendships, { relationName: "target" }),
}));

export const matchesRelations = relations(matches, ({ one }) => ({
  player1: one(users, {
    fields: [matches.player1Id],
    references: [users.id],
    relationName: "player1",
  }),
  player2: one(users, {
    fields: [matches.player2Id],
    references: [users.id],
    relationName: "player2",
  }),
  winner: one(users, {
    fields: [matches.winnerId],
    references: [users.id],
  }),
}));

export const friendshipsRelations = relations(friendships, ({ one }) => ({
  user: one(users, {
    fields: [friendships.userId],
    references: [users.id],
    relationName: "initiator",
  }),
  friend: one(users, {
    fields: [friendships.friendId],
    references: [users.id],
    relationName: "target",
  }),
}));
```

2. Generate and apply the migration:

```bash
cd apps/api
bun run generate
bun run migrate
```

### Checkpoint

After this phase:

- `matches` table exists with proper indexes
- `friendships` table supports the friend lifecycle
- Relations allow querying matches with player info

### Common Pitfalls

- **Forgetting unique constraint on friendships**. Without it, duplicate friend
  requests are possible.
- **Not handling cascading deletes**. When a user is deleted, their matches
  should update `winnerId` to null, not cascade delete.
- **Missing indexes**. Match history queries will be slow without proper
  indexing.

---

## Phase 2: Users Repository and Service

### Learning Objective

Build the data access and business logic layers for profile operations.

### Understanding the Approach

The repository handles raw database queries. The service adds:

- Statistics calculation
- Pagination logic
- Access control checks
- Avatar processing

Statistics are **computed on-the-fly** using SQL aggregation. This ensures
they're always accurate, though for very active users you might consider
caching.

### Implementation Steps

1. Create the users repository at
   `apps/api/src/modules/users/users.repository.ts`:

```typescript
import { and, count, desc, eq, or, sql } from "drizzle-orm";
import { db } from "../../db";
import { friendships, matches, users } from "../../db/schema";

export const usersRepository = {
  // ---------------------------------------------------------------------------
  // User Queries
  // ---------------------------------------------------------------------------

  async findById(id: number) {
    return db.query.users.findFirst({
      where: eq(users.id, id),
      columns: {
        // Exclude sensitive fields
        passwordHash: false,
        totpSecret: false,
        failedLoginAttempts: false,
        lockedUntil: false,
      },
    });
  },

  async findByIdPublic(id: number) {
    return db.query.users.findFirst({
      where: eq(users.id, id),
      columns: {
        id: true,
        displayName: true,
        avatarUrl: true,
        createdAt: true,
      },
    });
  },

  // ---------------------------------------------------------------------------
  // Profile Updates
  // ---------------------------------------------------------------------------

  async updateProfile(
    id: number,
    data: { displayName?: string; avatarUrl?: string }
  ) {
    const [updated] = await db
      .update(users)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning({
        id: users.id,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
      });

    return updated;
  },

  // ---------------------------------------------------------------------------
  // Match History
  // ---------------------------------------------------------------------------

  async getMatchHistory(
    userId: number,
    options: {
      limit?: number;
      offset?: number;
      gameType?: string;
      result?: "wins" | "losses" | "all";
      includeAi?: boolean;
    } = {}
  ) {
    const {
      limit = 10,
      offset = 0,
      gameType,
      result,
      includeAi = true,
    } = options;

    // Build the where clause dynamically
    const conditions = [
      or(eq(matches.player1Id, userId), eq(matches.player2Id, userId)),
    ];

    if (gameType) {
      conditions.push(eq(matches.gameType, gameType));
    }

    if (!includeAi) {
      conditions.push(eq(matches.isAiGame, false));
    }

    if (result === "wins") {
      conditions.push(eq(matches.winnerId, userId));
    } else if (result === "losses") {
      conditions.push(
        and(
          sql`${matches.winnerId} IS NOT NULL`,
          sql`${matches.winnerId} != ${userId}`
        )
      );
    }

    const matchList = await db.query.matches.findMany({
      where: and(...conditions),
      with: {
        player1: {
          columns: { id: true, displayName: true, avatarUrl: true },
        },
        player2: {
          columns: { id: true, displayName: true, avatarUrl: true },
        },
      },
      orderBy: [desc(matches.createdAt)],
      limit,
      offset,
    });

    // Get total count for pagination
    const [{ total }] = await db
      .select({ total: count() })
      .from(matches)
      .where(and(...conditions));

    return {
      matches: matchList,
      total,
      hasMore: offset + limit < total,
    };
  },

  // ---------------------------------------------------------------------------
  // Statistics
  // ---------------------------------------------------------------------------

  async getStats(userId: number, gameType?: string) {
    // Build where clause
    const userMatchCondition = or(
      eq(matches.player1Id, userId),
      eq(matches.player2Id, userId)
    );

    const conditions = gameType
      ? and(userMatchCondition, eq(matches.gameType, gameType))
      : userMatchCondition;

    // Get aggregated stats in a single query
    const [stats] = await db
      .select({
        totalGames: count(),
        wins: sql<number>`
          COUNT(CASE WHEN ${matches.winnerId} = ${userId} THEN 1 END)
        `.as("wins"),
        losses: sql<number>`
          COUNT(CASE WHEN ${matches.winnerId} IS NOT NULL
                      AND ${matches.winnerId} != ${userId} THEN 1 END)
        `.as("losses"),
        draws: sql<number>`
          COUNT(CASE WHEN ${matches.winnerId} IS NULL THEN 1 END)
        `.as("draws"),
        aiGames: sql<number>`
          COUNT(CASE WHEN ${matches.isAiGame} = true THEN 1 END)
        `.as("ai_games"),
        totalDuration: sql<number>`
          COALESCE(SUM(${matches.duration}), 0)
        `.as("total_duration"),
        avgDuration: sql<number>`
          COALESCE(AVG(${matches.duration}), 0)
        `.as("avg_duration"),
      })
      .from(matches)
      .where(conditions);

    return {
      totalGames: Number(stats.totalGames),
      wins: Number(stats.wins),
      losses: Number(stats.losses),
      draws: Number(stats.draws),
      aiGames: Number(stats.aiGames),
      winRate:
        stats.totalGames > 0
          ? Math.round((Number(stats.wins) / Number(stats.totalGames)) * 100)
          : 0,
      totalDuration: Number(stats.totalDuration),
      avgDuration: Math.round(Number(stats.avgDuration)),
    };
  },

  // ---------------------------------------------------------------------------
  // Friends
  // ---------------------------------------------------------------------------

  async getFriends(userId: number) {
    // Get accepted friendships where user is either initiator or target
    const friendshipList = await db.query.friendships.findMany({
      where: and(
        or(eq(friendships.userId, userId), eq(friendships.friendId, userId)),
        eq(friendships.status, "accepted")
      ),
      with: {
        user: {
          columns: { id: true, displayName: true, avatarUrl: true },
        },
        friend: {
          columns: { id: true, displayName: true, avatarUrl: true },
        },
      },
    });

    // Return the "other" user in each friendship
    return friendshipList.map((f) => (f.userId === userId ? f.friend : f.user));
  },

  async getPendingRequests(userId: number) {
    // Requests where this user is the target and status is pending
    return db.query.friendships.findMany({
      where: and(
        eq(friendships.friendId, userId),
        eq(friendships.status, "pending")
      ),
      with: {
        user: {
          columns: { id: true, displayName: true, avatarUrl: true },
        },
      },
    });
  },

  async getSentRequests(userId: number) {
    return db.query.friendships.findMany({
      where: and(
        eq(friendships.userId, userId),
        eq(friendships.status, "pending")
      ),
      with: {
        friend: {
          columns: { id: true, displayName: true, avatarUrl: true },
        },
      },
    });
  },

  async getFriendshipBetween(userId: number, otherId: number) {
    return db.query.friendships.findFirst({
      where: or(
        and(eq(friendships.userId, userId), eq(friendships.friendId, otherId)),
        and(eq(friendships.userId, otherId), eq(friendships.friendId, userId))
      ),
    });
  },

  async createFriendRequest(userId: number, friendId: number) {
    const [friendship] = await db
      .insert(friendships)
      .values({
        userId,
        friendId,
        status: "pending",
      })
      .returning();

    return friendship;
  },

  async updateFriendshipStatus(
    id: number,
    status: "pending" | "accepted" | "blocked"
  ) {
    const [updated] = await db
      .update(friendships)
      .set({ status, updatedAt: new Date() })
      .where(eq(friendships.id, id))
      .returning();

    return updated;
  },

  async deleteFriendship(id: number) {
    await db.delete(friendships).where(eq(friendships.id, id));
  },
};
```

2. Create the users service at `apps/api/src/modules/users/users.service.ts`:

```typescript
import { err, ok, ResultAsync } from "neverthrow";
import { usersRepository } from "./users.repository";
import sharp from "sharp";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";

// Types for service responses
interface PublicProfile {
  id: number;
  displayName: string;
  avatarUrl: string | null;
  createdAt: Date;
}

interface UserStats {
  totalGames: number;
  wins: number;
  losses: number;
  draws: number;
  aiGames: number;
  winRate: number;
  totalDuration: number;
  avgDuration: number;
}

// Error types
type ProfileError = { type: "NOT_FOUND" } | { type: "FORBIDDEN" };

type FriendError =
  | { type: "NOT_FOUND" }
  | { type: "SELF_REQUEST" }
  | { type: "ALREADY_EXISTS" }
  | { type: "NOT_PENDING" };

type AvatarError =
  | { type: "INVALID_TYPE" }
  | { type: "TOO_LARGE" }
  | { type: "PROCESSING_FAILED" };

// Avatar storage path
const AVATAR_DIR = join(process.cwd(), "uploads", "avatars");
const MAX_AVATAR_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export const usersService = {
  // ---------------------------------------------------------------------------
  // Profile
  // ---------------------------------------------------------------------------

  getOwnProfile(userId: number): ResultAsync<PublicProfile, ProfileError> {
    return ResultAsync.fromPromise(usersRepository.findById(userId), () => ({
      type: "NOT_FOUND" as const,
    })).andThen((user) => {
      if (!user) {
        return err({ type: "NOT_FOUND" as const });
      }
      return ok(user as PublicProfile);
    });
  },

  getPublicProfile(targetId: number): ResultAsync<PublicProfile, ProfileError> {
    return ResultAsync.fromPromise(
      usersRepository.findByIdPublic(targetId),
      () => ({ type: "NOT_FOUND" as const })
    ).andThen((user) => {
      if (!user) {
        return err({ type: "NOT_FOUND" as const });
      }
      return ok(user);
    });
  },

  updateProfile(
    userId: number,
    data: { displayName?: string }
  ): ResultAsync<PublicProfile, ProfileError> {
    return ResultAsync.fromPromise(
      (async () => {
        // Validate display name if provided
        if (data.displayName) {
          const name = data.displayName.trim();

          // 3-20 characters, alphanumeric and spaces only
          if (!/^[a-zA-Z0-9 ]{3,20}$/.test(name)) {
            throw new Error("Invalid display name format");
          }

          return usersRepository.updateProfile(userId, {
            displayName: name,
          });
        }

        return usersRepository.findById(userId);
      })(),
      () => ({ type: "NOT_FOUND" as const })
    ).andThen((user) => {
      if (!user) {
        return err({ type: "NOT_FOUND" as const });
      }
      return ok(user as PublicProfile);
    });
  },

  // ---------------------------------------------------------------------------
  // Avatar Upload
  // ---------------------------------------------------------------------------

  uploadAvatar(
    userId: number,
    file: File
  ): ResultAsync<{ avatarUrl: string }, AvatarError> {
    return ResultAsync.fromPromise(
      (async () => {
        // Validate file type
        if (!ALLOWED_TYPES.includes(file.type)) {
          throw { type: "INVALID_TYPE" };
        }

        // Validate file size
        if (file.size > MAX_AVATAR_SIZE) {
          throw { type: "TOO_LARGE" };
        }

        // Read file buffer
        const buffer = await file.arrayBuffer();

        // Process image with Sharp
        // Resize to 256x256, convert to WebP for efficiency
        const processedBuffer = await sharp(Buffer.from(buffer))
          .resize(256, 256, {
            fit: "cover", // Crop to fill
            position: "center",
          })
          .webp({ quality: 80 })
          .toBuffer();

        // Ensure upload directory exists
        await mkdir(AVATAR_DIR, { recursive: true });

        // Save with user ID as filename
        const filename = `${userId}.webp`;
        const filepath = join(AVATAR_DIR, filename);
        await writeFile(filepath, processedBuffer);

        // Update user's avatar URL
        const avatarUrl = `/uploads/avatars/${filename}`;
        await usersRepository.updateProfile(userId, { avatarUrl });

        return { avatarUrl };
      })(),
      (e) => {
        if (typeof e === "object" && e !== null && "type" in e) {
          return e as AvatarError;
        }
        return { type: "PROCESSING_FAILED" as const };
      }
    );
  },

  // ---------------------------------------------------------------------------
  // Match History
  // ---------------------------------------------------------------------------

  getMatchHistory(
    userId: number,
    options: {
      limit?: number;
      offset?: number;
      gameType?: string;
      result?: "wins" | "losses" | "all";
    }
  ) {
    // Cap limit to prevent abuse
    const limit = Math.min(options.limit ?? 10, 50);
    const offset = Math.max(options.offset ?? 0, 0);

    return ResultAsync.fromPromise(
      usersRepository.getMatchHistory(userId, {
        ...options,
        limit,
        offset,
      }),
      () => ({ type: "NOT_FOUND" as const })
    );
  },

  // ---------------------------------------------------------------------------
  // Statistics
  // ---------------------------------------------------------------------------

  getStats(
    userId: number,
    gameType?: string
  ): ResultAsync<UserStats, ProfileError> {
    return ResultAsync.fromPromise(
      usersRepository.getStats(userId, gameType),
      () => ({ type: "NOT_FOUND" as const })
    );
  },

  // ---------------------------------------------------------------------------
  // Friends
  // ---------------------------------------------------------------------------

  sendFriendRequest(
    userId: number,
    targetId: number
  ): ResultAsync<void, FriendError> {
    return ResultAsync.fromPromise(
      (async () => {
        // Can't friend yourself
        if (userId === targetId) {
          return err({ type: "SELF_REQUEST" as const });
        }

        // Check if target exists
        const target = await usersRepository.findByIdPublic(targetId);
        if (!target) {
          return err({ type: "NOT_FOUND" as const });
        }

        // Check for existing relationship
        const existing = await usersRepository.getFriendshipBetween(
          userId,
          targetId
        );
        if (existing) {
          return err({ type: "ALREADY_EXISTS" as const });
        }

        // Create the request
        await usersRepository.createFriendRequest(userId, targetId);
        return ok(undefined);
      })(),
      () => ({ type: "NOT_FOUND" as const })
    ).andThen((result) => result);
  },

  acceptFriendRequest(
    userId: number,
    requestId: number
  ): ResultAsync<void, FriendError> {
    return ResultAsync.fromPromise(
      (async () => {
        // Find the friendship
        const friendship = await db.query.friendships.findFirst({
          where: eq(friendships.id, requestId),
        });

        if (!friendship) {
          return err({ type: "NOT_FOUND" as const });
        }

        // Must be the target of the request
        if (friendship.friendId !== userId) {
          return err({ type: "NOT_FOUND" as const });
        }

        // Must be pending
        if (friendship.status !== "pending") {
          return err({ type: "NOT_PENDING" as const });
        }

        await usersRepository.updateFriendshipStatus(requestId, "accepted");
        return ok(undefined);
      })(),
      () => ({ type: "NOT_FOUND" as const })
    ).andThen((result) => result);
  },

  rejectFriendRequest(
    userId: number,
    requestId: number
  ): ResultAsync<void, FriendError> {
    return ResultAsync.fromPromise(
      (async () => {
        const friendship = await db.query.friendships.findFirst({
          where: eq(friendships.id, requestId),
        });

        if (!friendship || friendship.friendId !== userId) {
          return err({ type: "NOT_FOUND" as const });
        }

        if (friendship.status !== "pending") {
          return err({ type: "NOT_PENDING" as const });
        }

        await usersRepository.deleteFriendship(requestId);
        return ok(undefined);
      })(),
      () => ({ type: "NOT_FOUND" as const })
    ).andThen((result) => result);
  },

  removeFriend(
    userId: number,
    friendId: number
  ): ResultAsync<void, FriendError> {
    return ResultAsync.fromPromise(
      (async () => {
        const friendship = await usersRepository.getFriendshipBetween(
          userId,
          friendId
        );

        if (!friendship || friendship.status !== "accepted") {
          return err({ type: "NOT_FOUND" as const });
        }

        await usersRepository.deleteFriendship(friendship.id);
        return ok(undefined);
      })(),
      () => ({ type: "NOT_FOUND" as const })
    ).andThen((result) => result);
  },

  blockUser(userId: number, targetId: number): ResultAsync<void, FriendError> {
    return ResultAsync.fromPromise(
      (async () => {
        if (userId === targetId) {
          return err({ type: "SELF_REQUEST" as const });
        }

        const existing = await usersRepository.getFriendshipBetween(
          userId,
          targetId
        );

        if (existing) {
          // Update existing relationship to blocked
          await usersRepository.updateFriendshipStatus(existing.id, "blocked");
        } else {
          // Create new blocked relationship
          await db.insert(friendships).values({
            userId,
            friendId: targetId,
            status: "blocked",
          });
        }

        return ok(undefined);
      })(),
      () => ({ type: "NOT_FOUND" as const })
    ).andThen((result) => result);
  },

  getFriends(userId: number) {
    return ResultAsync.fromPromise(usersRepository.getFriends(userId), () => ({
      type: "NOT_FOUND" as const,
    }));
  },

  getPendingRequests(userId: number) {
    return ResultAsync.fromPromise(
      usersRepository.getPendingRequests(userId),
      () => ({ type: "NOT_FOUND" as const })
    );
  },
};
```

3. Install Sharp for image processing:

```bash
cd apps/api
bun add sharp
```

### Checkpoint

After this phase:

- Can fetch user profiles with stats
- Match history supports filtering and pagination
- Friend operations handle all status transitions

### Common Pitfalls

- **Not capping pagination limits**. Malicious users could request
  limit=1000000.
- **Allowing self-friend requests**. Always validate userId !== targetId.
- **Not handling both directions of friendships**. Remember either user could
  have initiated.

---

## Phase 3: Users Controller

### Learning Objective

Expose profile, statistics, and friend management endpoints with proper
validation.

### Implementation Steps

Create the controller at `apps/api/src/modules/users/users.controller.ts`:

```typescript
import { Elysia, t } from "elysia";
import { usersService } from "./users.service";
import { authGuard } from "../../common/guards/auth.guard";

export const usersController = new Elysia({ prefix: "/users" })
  // ---------------------------------------------------------------------------
  // Protected Routes (require authentication)
  // ---------------------------------------------------------------------------
  .use(authGuard)
  // Get own profile
  .get("/me", async ({ user, error }) => {
    const result = await usersService.getOwnProfile(user.id);

    if (result.isErr()) {
      return error(404, { message: "Profile not found" });
    }

    return { user: result.value };
  })
  // Update own profile
  .patch(
    "/me",
    async ({ body, user, error }) => {
      const result = await usersService.updateProfile(user.id, body);

      if (result.isErr()) {
        return error(400, { message: "Update failed" });
      }

      return { user: result.value };
    },
    {
      body: t.Object({
        displayName: t.Optional(
          t.String({
            minLength: 3,
            maxLength: 20,
            pattern: "^[a-zA-Z0-9 ]+$",
          })
        ),
      }),
    }
  )
  // Upload avatar
  .post(
    "/me/avatar",
    async ({ body, user, error }) => {
      const result = await usersService.uploadAvatar(user.id, body.file);

      if (result.isErr()) {
        const err = result.error;
        switch (err.type) {
          case "INVALID_TYPE":
            return error(400, {
              message: "Invalid file type. Use JPEG, PNG, or WebP.",
            });
          case "TOO_LARGE":
            return error(400, { message: "File too large. Maximum 2MB." });
          default:
            return error(500, { message: "Failed to process image" });
        }
      }

      return { avatarUrl: result.value.avatarUrl };
    },
    {
      body: t.Object({
        file: t.File({
          type: ["image/jpeg", "image/png", "image/webp"],
          maxSize: 2 * 1024 * 1024, // 2MB
        }),
      }),
    }
  )
  // Get own stats
  .get(
    "/me/stats",
    async ({ query, user }) => {
      const result = await usersService.getStats(user.id, query.gameType);

      if (result.isErr()) {
        return { stats: null };
      }

      return { stats: result.value };
    },
    {
      query: t.Object({
        gameType: t.Optional(t.String()),
      }),
    }
  )
  // Get own match history
  .get(
    "/me/matches",
    async ({ query, user }) => {
      const result = await usersService.getMatchHistory(user.id, {
        limit: query.limit,
        offset: query.offset,
        gameType: query.gameType,
        result: query.result as "wins" | "losses" | "all" | undefined,
      });

      if (result.isErr()) {
        return { matches: [], total: 0, hasMore: false };
      }

      return result.value;
    },
    {
      query: t.Object({
        limit: t.Optional(t.Numeric({ minimum: 1, maximum: 50 })),
        offset: t.Optional(t.Numeric({ minimum: 0 })),
        gameType: t.Optional(t.String()),
        result: t.Optional(
          t.Union([t.Literal("wins"), t.Literal("losses"), t.Literal("all")])
        ),
      }),
    }
  )
  // ---------------------------------------------------------------------------
  // Friend Management
  // ---------------------------------------------------------------------------

  // Get friends list
  .get("/me/friends", async ({ user }) => {
    const result = await usersService.getFriends(user.id);

    if (result.isErr()) {
      return { friends: [] };
    }

    return { friends: result.value };
  })
  // Get pending friend requests
  .get("/me/friends/pending", async ({ user }) => {
    const result = await usersService.getPendingRequests(user.id);

    if (result.isErr()) {
      return { requests: [] };
    }

    return { requests: result.value };
  })
  // Send friend request
  .post(
    "/me/friends/:targetId",
    async ({ params, user, error }) => {
      const result = await usersService.sendFriendRequest(
        user.id,
        params.targetId
      );

      if (result.isErr()) {
        const err = result.error;
        switch (err.type) {
          case "SELF_REQUEST":
            return error(400, {
              message: "Cannot send friend request to yourself",
            });
          case "NOT_FOUND":
            return error(404, { message: "User not found" });
          case "ALREADY_EXISTS":
            return error(409, { message: "Friend request already exists" });
        }
      }

      return { message: "Friend request sent" };
    },
    {
      params: t.Object({
        targetId: t.Numeric(),
      }),
    }
  )
  // Accept friend request
  .post(
    "/me/friends/accept/:requestId",
    async ({ params, user, error }) => {
      const result = await usersService.acceptFriendRequest(
        user.id,
        params.requestId
      );

      if (result.isErr()) {
        return error(400, { message: "Cannot accept this request" });
      }

      return { message: "Friend request accepted" };
    },
    {
      params: t.Object({
        requestId: t.Numeric(),
      }),
    }
  )
  // Reject friend request
  .delete(
    "/me/friends/reject/:requestId",
    async ({ params, user, error }) => {
      const result = await usersService.rejectFriendRequest(
        user.id,
        params.requestId
      );

      if (result.isErr()) {
        return error(400, { message: "Cannot reject this request" });
      }

      return { message: "Friend request rejected" };
    },
    {
      params: t.Object({
        requestId: t.Numeric(),
      }),
    }
  )
  // Remove friend
  .delete(
    "/me/friends/:friendId",
    async ({ params, user, error }) => {
      const result = await usersService.removeFriend(user.id, params.friendId);

      if (result.isErr()) {
        return error(404, { message: "Friend not found" });
      }

      return { message: "Friend removed" };
    },
    {
      params: t.Object({
        friendId: t.Numeric(),
      }),
    }
  )
  // Block user
  .post(
    "/me/blocks/:targetId",
    async ({ params, user, error }) => {
      const result = await usersService.blockUser(user.id, params.targetId);

      if (result.isErr()) {
        return error(400, { message: "Cannot block this user" });
      }

      return { message: "User blocked" };
    },
    {
      params: t.Object({
        targetId: t.Numeric(),
      }),
    }
  )
  // ---------------------------------------------------------------------------
  // Public Routes (viewing other users)
  // ---------------------------------------------------------------------------

  // Get user's public profile
  .get(
    "/:id",
    async ({ params, error }) => {
      const result = await usersService.getPublicProfile(params.id);

      if (result.isErr()) {
        return error(404, { message: "User not found" });
      }

      return { user: result.value };
    },
    {
      params: t.Object({
        id: t.Numeric(),
      }),
    }
  )
  // Get user's stats
  .get(
    "/:id/stats",
    async ({ params, query }) => {
      const result = await usersService.getStats(params.id, query.gameType);

      if (result.isErr()) {
        return { stats: null };
      }

      return { stats: result.value };
    },
    {
      params: t.Object({
        id: t.Numeric(),
      }),
      query: t.Object({
        gameType: t.Optional(t.String()),
      }),
    }
  )
  // Get user's match history
  .get(
    "/:id/matches",
    async ({ params, query }) => {
      const result = await usersService.getMatchHistory(params.id, {
        limit: query.limit,
        offset: query.offset,
        gameType: query.gameType,
      });

      if (result.isErr()) {
        return { matches: [], total: 0, hasMore: false };
      }

      return result.value;
    },
    {
      params: t.Object({
        id: t.Numeric(),
      }),
      query: t.Object({
        limit: t.Optional(t.Numeric({ minimum: 1, maximum: 50 })),
        offset: t.Optional(t.Numeric({ minimum: 0 })),
        gameType: t.Optional(t.String()),
      }),
    }
  );
```

Register the controller in `apps/api/src/index.ts`:

```typescript
import { usersController } from "./modules/users/users.controller";

// In the group:
.group("/api", (app) =>
  app
    .use(authController)
    .use(usersController)
)
```

### Checkpoint

After this phase:

- All profile endpoints are accessible
- Avatar upload works with proper validation
- Friend management endpoints handle all cases

---

## Phase 4: Frontend Profile Components

### Learning Objective

Build reusable Svelte components for displaying profiles, stats, and match
history.

### Understanding the Approach

We'll create:

1. **StatsCard**: Visual display of wins, losses, and win rate
2. **MatchHistory**: Paginated list of matches with filtering
3. **ProfileHeader**: Avatar, name, and quick actions
4. **FriendsList**: List of friends with online status

These components follow Shadcn-Svelte patterns and use Tailwind for styling.

### Implementation Steps

1. Install additional Shadcn components:

```bash
cd apps/web
bunx shadcn-svelte@next add avatar card table badge progress button
```

2. Create the Stats Card component at
   `apps/web/src/lib/components/StatsCard.svelte`:

```svelte
<script lang="ts">
  import * as Card from "$lib/components/ui/card";
  import { Progress } from "$lib/components/ui/progress";

  interface Stats {
    totalGames: number;
    wins: number;
    losses: number;
    draws: number;
    winRate: number;
    avgDuration: number;
  }

  let { stats }: { stats: Stats | null } = $props();

  // Format duration in seconds to MM:SS
  function formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }
</script>

<Card.Root>
  <Card.Header>
    <Card.Title>Statistics</Card.Title>
    <Card.Description>Your gaming performance</Card.Description>
  </Card.Header>
  <Card.Content>
    {#if !stats || stats.totalGames === 0}
      <p class="text-muted-foreground text-center py-4">
        No games played yet. Start playing to see your stats!
      </p>
    {:else}
      <div class="space-y-4">
        <!-- Win Rate -->
        <div>
          <div class="flex justify-between mb-2">
            <span class="text-sm font-medium">Win Rate</span>
            <span class="text-sm font-bold">{stats.winRate}%</span>
          </div>
          <Progress value={stats.winRate} class="h-2" />
        </div>

        <!-- Stats Grid -->
        <div class="grid grid-cols-2 gap-4">
          <div class="text-center p-3 bg-muted rounded-lg">
            <p class="text-2xl font-bold text-green-600">{stats.wins}</p>
            <p class="text-xs text-muted-foreground">Wins</p>
          </div>
          <div class="text-center p-3 bg-muted rounded-lg">
            <p class="text-2xl font-bold text-red-600">{stats.losses}</p>
            <p class="text-xs text-muted-foreground">Losses</p>
          </div>
          <div class="text-center p-3 bg-muted rounded-lg">
            <p class="text-2xl font-bold">{stats.totalGames}</p>
            <p class="text-xs text-muted-foreground">Total Games</p>
          </div>
          <div class="text-center p-3 bg-muted rounded-lg">
            <p class="text-2xl font-bold">{formatDuration(stats.avgDuration)}</p>
            <p class="text-xs text-muted-foreground">Avg Duration</p>
          </div>
        </div>
      </div>
    {/if}
  </Card.Content>
</Card.Root>
```

3. Create the Match History component at
   `apps/web/src/lib/components/MatchHistory.svelte`:

```svelte
<script lang="ts">
  import * as Card from "$lib/components/ui/card";
  import * as Table from "$lib/components/ui/table";
  import { Badge } from "$lib/components/ui/badge";
  import { Button } from "$lib/components/ui/button";
  import { Avatar, AvatarFallback, AvatarImage } from "$lib/components/ui/avatar";

  interface Match {
    id: number;
    player1: { id: number; displayName: string; avatarUrl: string | null };
    player2: { id: number; displayName: string; avatarUrl: string | null } | null;
    player1Score: number;
    player2Score: number;
    winnerId: number | null;
    isAiGame: boolean;
    duration: number;
    createdAt: string;
  }

  interface Props {
    matches: Match[];
    total: number;
    hasMore: boolean;
    currentUserId: number;
    onLoadMore?: () => void;
    loading?: boolean;
  }

  let {
    matches,
    total,
    hasMore,
    currentUserId,
    onLoadMore,
    loading = false,
  }: Props = $props();

  // Determine match result for the current user
  function getResult(match: Match): "win" | "loss" | "draw" {
    if (match.winnerId === null) return "draw";
    if (match.winnerId === currentUserId) return "win";
    return "loss";
  }

  // Get the opponent in a match
  function getOpponent(match: Match) {
    if (match.isAiGame) {
      return { displayName: "AI Opponent", avatarUrl: null };
    }
    return match.player1.id === currentUserId ? match.player2 : match.player1;
  }

  // Get user's score in the match
  function getScore(match: Match): { mine: number; theirs: number } {
    if (match.player1.id === currentUserId) {
      return { mine: match.player1Score, theirs: match.player2Score };
    }
    return { mine: match.player2Score, theirs: match.player1Score };
  }

  // Format duration
  function formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }

  // Format date
  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  // Get initials for avatar fallback
  function getInitials(name: string): string {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }
</script>

<Card.Root>
  <Card.Header>
    <Card.Title>Match History</Card.Title>
    <Card.Description>{total} total matches</Card.Description>
  </Card.Header>
  <Card.Content>
    {#if matches.length === 0}
      <p class="text-muted-foreground text-center py-8">
        No matches found. Start playing to build your history!
      </p>
    {:else}
      <Table.Root>
        <Table.Header>
          <Table.Row>
            <Table.Head>Opponent</Table.Head>
            <Table.Head>Score</Table.Head>
            <Table.Head>Result</Table.Head>
            <Table.Head class="text-right">Date</Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {#each matches as match (match.id)}
            {@const opponent = getOpponent(match)}
            {@const score = getScore(match)}
            {@const result = getResult(match)}

            <Table.Row>
              <Table.Cell>
                <div class="flex items-center gap-2">
                  <Avatar class="h-8 w-8">
                    {#if opponent?.avatarUrl}
                      <AvatarImage src={opponent.avatarUrl} alt={opponent.displayName} />
                    {/if}
                    <AvatarFallback>
                      {opponent ? getInitials(opponent.displayName) : "AI"}
                    </AvatarFallback>
                  </Avatar>
                  <span class="font-medium">
                    {opponent?.displayName ?? "AI Opponent"}
                  </span>
                  {#if match.isAiGame}
                    <Badge variant="outline" class="text-xs">AI</Badge>
                  {/if}
                </div>
              </Table.Cell>
              <Table.Cell>
                <span class="font-mono">
                  {score.mine} - {score.theirs}
                </span>
              </Table.Cell>
              <Table.Cell>
                <Badge
                  variant={result === "win"
                    ? "default"
                    : result === "loss"
                      ? "destructive"
                      : "secondary"}
                >
                  {result.charAt(0).toUpperCase() + result.slice(1)}
                </Badge>
              </Table.Cell>
              <Table.Cell class="text-right text-muted-foreground">
                <div>{formatDate(match.createdAt)}</div>
                <div class="text-xs">{formatDuration(match.duration)}</div>
              </Table.Cell>
            </Table.Row>
          {/each}
        </Table.Body>
      </Table.Root>

      {#if hasMore}
        <div class="mt-4 text-center">
          <Button
            variant="outline"
            onclick={onLoadMore}
            disabled={loading}
          >
            {loading ? "Loading..." : "Load More"}
          </Button>
        </div>
      {/if}
    {/if}
  </Card.Content>
</Card.Root>
```

4. Create the Profile Header component at
   `apps/web/src/lib/components/ProfileHeader.svelte`:

```svelte
<script lang="ts">
  import { Avatar, AvatarFallback, AvatarImage } from "$lib/components/ui/avatar";
  import { Button } from "$lib/components/ui/button";
  import * as Card from "$lib/components/ui/card";

  interface User {
    id: number;
    displayName: string;
    avatarUrl: string | null;
    createdAt: string;
  }

  interface Stats {
    totalGames: number;
    wins: number;
    winRate: number;
  }

  interface Props {
    user: User;
    stats?: Stats | null;
    isOwnProfile?: boolean;
    onEditAvatar?: () => void;
    onEditName?: () => void;
  }

  let {
    user,
    stats = null,
    isOwnProfile = false,
    onEditAvatar,
    onEditName,
  }: Props = $props();

  function getInitials(name: string): string {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }

  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
    });
  }
</script>

<Card.Root>
  <Card.Content class="pt-6">
    <div class="flex flex-col md:flex-row gap-6 items-center md:items-start">
      <!-- Avatar -->
      <div class="relative group">
        <Avatar class="h-24 w-24 md:h-32 md:w-32">
          {#if user.avatarUrl}
            <AvatarImage src={user.avatarUrl} alt={user.displayName} />
          {/if}
          <AvatarFallback class="text-2xl">
            {getInitials(user.displayName)}
          </AvatarFallback>
        </Avatar>

        {#if isOwnProfile && onEditAvatar}
          <button
            onclick={onEditAvatar}
            class="absolute inset-0 bg-black/50 rounded-full opacity-0 group-hover:opacity-100
                   transition-opacity flex items-center justify-center text-white text-sm"
          >
            Change
          </button>
        {/if}
      </div>

      <!-- Info -->
      <div class="flex-1 text-center md:text-left">
        <div class="flex items-center gap-2 justify-center md:justify-start">
          <h1 class="text-2xl font-bold">{user.displayName}</h1>
          {#if isOwnProfile && onEditName}
            <Button variant="ghost" size="sm" onclick={onEditName}>
              Edit
            </Button>
          {/if}
        </div>

        <p class="text-muted-foreground text-sm">
          Member since {formatDate(user.createdAt)}
        </p>

        {#if stats}
          <div class="flex gap-4 mt-4 justify-center md:justify-start">
            <div class="text-center">
              <p class="text-xl font-bold">{stats.totalGames}</p>
              <p class="text-xs text-muted-foreground">Games</p>
            </div>
            <div class="text-center">
              <p class="text-xl font-bold text-green-600">{stats.wins}</p>
              <p class="text-xs text-muted-foreground">Wins</p>
            </div>
            <div class="text-center">
              <p class="text-xl font-bold">{stats.winRate}%</p>
              <p class="text-xs text-muted-foreground">Win Rate</p>
            </div>
          </div>
        {/if}
      </div>

      <!-- Actions -->
      {#if !isOwnProfile}
        <div class="flex gap-2">
          <Button variant="default">Add Friend</Button>
          <Button variant="outline">Challenge</Button>
        </div>
      {/if}
    </div>
  </Card.Content>
</Card.Root>
```

5. Create the Profile page at `apps/web/src/routes/profile/+page.svelte`:

```svelte
<script lang="ts">
  import { api } from "$lib/api";
  import { onMount } from "svelte";
  import ProfileHeader from "$lib/components/ProfileHeader.svelte";
  import StatsCard from "$lib/components/StatsCard.svelte";
  import MatchHistory from "$lib/components/MatchHistory.svelte";
  import * as Tabs from "$lib/components/ui/tabs";

  // State
  let user = $state<{
    id: number;
    displayName: string;
    avatarUrl: string | null;
    createdAt: string;
  } | null>(null);

  let stats = $state<{
    totalGames: number;
    wins: number;
    losses: number;
    draws: number;
    winRate: number;
    avgDuration: number;
  } | null>(null);

  let matches = $state<Array<{
    id: number;
    player1: { id: number; displayName: string; avatarUrl: string | null };
    player2: { id: number; displayName: string; avatarUrl: string | null } | null;
    player1Score: number;
    player2Score: number;
    winnerId: number | null;
    isAiGame: boolean;
    duration: number;
    createdAt: string;
  }>>([]);

  let matchesTotal = $state(0);
  let hasMoreMatches = $state(false);
  let loading = $state(true);
  let loadingMore = $state(false);
  let error = $state<string | null>(null);

  // Avatar upload state
  let fileInput: HTMLInputElement;
  let uploading = $state(false);

  onMount(async () => {
    await loadProfile();
  });

  async function loadProfile() {
    loading = true;
    error = null;

    try {
      // Fetch user, stats, and matches in parallel
      const [userRes, statsRes, matchesRes] = await Promise.all([
        api.api.users.me.get(),
        api.api.users.me.stats.get(),
        api.api.users.me.matches.get({ query: { limit: 10 } }),
      ]);

      if (userRes.error) {
        error = "Failed to load profile";
        return;
      }

      user = userRes.data.user;
      stats = statsRes.data?.stats ?? null;

      if (matchesRes.data) {
        matches = matchesRes.data.matches;
        matchesTotal = matchesRes.data.total;
        hasMoreMatches = matchesRes.data.hasMore;
      }
    } catch (e) {
      error = "Network error";
    } finally {
      loading = false;
    }
  }

  async function loadMoreMatches() {
    if (loadingMore || !hasMoreMatches) return;

    loadingMore = true;

    try {
      const res = await api.api.users.me.matches.get({
        query: { limit: 10, offset: matches.length },
      });

      if (res.data) {
        matches = [...matches, ...res.data.matches];
        hasMoreMatches = res.data.hasMore;
      }
    } finally {
      loadingMore = false;
    }
  }

  function handleEditAvatar() {
    fileInput.click();
  }

  async function handleAvatarUpload(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) return;

    uploading = true;

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await api.api.users.me.avatar.post({
        file,
      });

      if (res.data) {
        // Update user avatar
        user = user ? { ...user, avatarUrl: res.data.avatarUrl } : null;
      }
    } catch (e) {
      error = "Failed to upload avatar";
    } finally {
      uploading = false;
      input.value = ""; // Reset input
    }
  }
</script>

<div class="container mx-auto py-8 px-4 max-w-4xl">
  {#if loading}
    <div class="text-center py-12">
      <p class="text-muted-foreground">Loading profile...</p>
    </div>
  {:else if error}
    <div class="bg-destructive/10 text-destructive p-4 rounded text-center">
      {error}
    </div>
  {:else if user}
    <!-- Hidden file input for avatar upload -->
    <input
      type="file"
      accept="image/jpeg,image/png,image/webp"
      class="hidden"
      bind:this={fileInput}
      onchange={handleAvatarUpload}
    />

    <div class="space-y-6">
      <!-- Profile Header -->
      <ProfileHeader
        {user}
        {stats}
        isOwnProfile={true}
        onEditAvatar={handleEditAvatar}
      />

      <!-- Tabs for Stats / History / Friends -->
      <Tabs.Root value="overview" class="w-full">
        <Tabs.List>
          <Tabs.Trigger value="overview">Overview</Tabs.Trigger>
          <Tabs.Trigger value="history">Match History</Tabs.Trigger>
          <Tabs.Trigger value="friends">Friends</Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="overview" class="mt-4">
          <div class="grid gap-6 md:grid-cols-2">
            <StatsCard {stats} />
            <MatchHistory
              {matches}
              total={matchesTotal}
              hasMore={hasMoreMatches}
              currentUserId={user.id}
              onLoadMore={loadMoreMatches}
              loading={loadingMore}
            />
          </div>
        </Tabs.Content>

        <Tabs.Content value="history" class="mt-4">
          <MatchHistory
            {matches}
            total={matchesTotal}
            hasMore={hasMoreMatches}
            currentUserId={user.id}
            onLoadMore={loadMoreMatches}
            loading={loadingMore}
          />
        </Tabs.Content>

        <Tabs.Content value="friends" class="mt-4">
          <!-- Friends list component would go here -->
          <p class="text-muted-foreground text-center py-8">
            Friends feature coming soon!
          </p>
        </Tabs.Content>
      </Tabs.Root>
    </div>
  {/if}
</div>
```

### Checkpoint

After this phase:

- Profile page displays user info, stats, and history
- Avatar upload works with preview
- Match history loads with pagination
- Components are reusable for public profiles

---

## Phase 5: Server-Side Rendering

### Learning Objective

Use SvelteKit load functions to fetch profile data server-side for better SEO
and initial load performance.

### Understanding the Approach

SSR means the server renders HTML before sending it to the browser. Benefits:

- Faster initial paint (no "loading" spinner)
- Better SEO (search engines see content)
- Works without JavaScript (graceful degradation)

In SvelteKit, `+page.server.ts` files contain load functions that run on the
server.

### Implementation Steps

1. Create the server load function at
   `apps/web/src/routes/profile/+page.server.ts`:

```typescript
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ fetch, cookies }) => {
  // Get session cookie to pass to API
  const sessionId = cookies.get("session");

  if (!sessionId) {
    // Redirect to login if not authenticated
    return {
      redirect: "/auth/login",
    };
  }

  try {
    // Fetch profile data from API (server-to-server)
    const [userRes, statsRes, matchesRes] = await Promise.all([
      fetch("http://localhost:4000/api/users/me", {
        headers: { Cookie: `session=${sessionId}` },
      }),
      fetch("http://localhost:4000/api/users/me/stats", {
        headers: { Cookie: `session=${sessionId}` },
      }),
      fetch("http://localhost:4000/api/users/me/matches?limit=10", {
        headers: { Cookie: `session=${sessionId}` },
      }),
    ]);

    if (!userRes.ok) {
      return { error: "Failed to load profile" };
    }

    const userData = await userRes.json();
    const statsData = statsRes.ok ? await statsRes.json() : { stats: null };
    const matchesData = matchesRes.ok
      ? await matchesRes.json()
      : { matches: [], total: 0, hasMore: false };

    return {
      user: userData.user,
      stats: statsData.stats,
      matches: matchesData.matches,
      matchesTotal: matchesData.total,
      hasMoreMatches: matchesData.hasMore,
    };
  } catch (e) {
    return { error: "Server error" };
  }
};
```

2. Update the page component to use loaded data:

```svelte
<script lang="ts">
  import type { PageData } from "./$types";
  import { api } from "$lib/api";
  // ... other imports

  // Get data from server load function
  let { data }: { data: PageData } = $props();

  // Initialize state from SSR data
  let user = $state(data.user);
  let stats = $state(data.stats);
  let matches = $state(data.matches ?? []);
  let matchesTotal = $state(data.matchesTotal ?? 0);
  let hasMoreMatches = $state(data.hasMoreMatches ?? false);

  // Client-side loading for additional data
  let loadingMore = $state(false);

  // ... rest of component remains the same
</script>
```

### Checkpoint

After this phase:

- Profile page renders on server with data
- Initial load is faster (no client-side fetch)
- Search engines can index profile content

---

## Testing Your Implementation

### Manual Testing Checklist

1. **Profile Display**
   - [ ] Own profile shows correct info
   - [ ] Stats calculate correctly from match data
   - [ ] Avatar displays or shows initials

2. **Avatar Upload**
   - [ ] Can select and upload JPEG/PNG/WebP
   - [ ] Files >2MB are rejected
   - [ ] Avatar updates immediately after upload
   - [ ] Resized to 256x256

3. **Match History**
   - [ ] Displays matches correctly
   - [ ] Shows opponent info
   - [ ] Pagination loads more
   - [ ] Filters work (wins/losses/AI)

4. **Friends**
   - [ ] Can send friend request
   - [ ] Can accept/reject requests
   - [ ] Can unfriend
   - [ ] Can block users

5. **Responsive Design**
   - [ ] Works on mobile (stacked layout)
   - [ ] Works on desktop (side-by-side)
   - [ ] Touch interactions work

---

## Troubleshooting

### Avatar not updating after upload

**Possible causes:**

- File not being sent correctly
- Image processing failing
- Browser caching old avatar

**Solution:**

- Check network tab for upload request
- Add cache-busting query param: `?v=${Date.now()}`
- Check server logs for Sharp errors

### Stats showing wrong numbers

**Possible causes:**

- Query not finding all matches
- User ID comparison failing

**Solution:**

- Check raw SQL in database
- Verify `player1Id` and `player2Id` match user

### Friend request not appearing

**Possible causes:**

- Creating duplicate requests
- Wrong user ID

**Solution:**

- Check unique constraint on friendships table
- Log the IDs being used in requests

---

## Going Deeper

### Official Documentation

- [SvelteKit Load Functions](https://kit.svelte.dev/docs/load)
- [Sharp Image Processing](https://sharp.pixelplumbing.com/)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Shadcn-Svelte](https://shadcn-svelte.com/)

### Related Patterns

- **Optimistic Updates**: Update UI before server confirms
- **Infinite Scroll**: Alternative to pagination buttons
- **Image CDN**: Offload image serving and transformation

### Suggested Improvements

- Add image cropping before upload
- Implement online status indicators
- Add game type filtering to stats
- Create leaderboard ranking
- Add profile badges/achievements

---

## Self-Assessment Questions

1. **Conceptual**: Why do we store `winnerId` instead of calculating it from
   scores?

2. **Architecture**: How would you add support for a new game type (e.g., Chess)
   without changing existing code?

3. **Performance**: The stats query runs on every profile view. How would you
   optimize this for a user with 10,000 matches?

4. **UX**: What's the benefit of SSR for the profile page? When might you skip
   it?

5. **Security**: A user can view anyone's match history via
   `/users/:id/matches`. Is this a problem? When might you restrict it?
