/**
 * Database test utilities for integration tests.
 *
 * These utilities provide isolated database transactions for testing,
 * ensuring tests don't interfere with each other and don't persist data.
 */

import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

// Test database connection (uses DATABASE_URL or test default)
const testDatabaseUrl =
  process.env.DATABASE_URL ||
  "postgres://postgres:postgres@localhost:5432/ft_transcendence_test";

/**
 * Creates an isolated test database client.
 * Each test file should create its own client to ensure isolation.
 */
export function createTestDb() {
  const client = postgres(testDatabaseUrl, {
    max: 1, // Single connection for test isolation
  });

  const db = drizzle(client, { schema });

  return {
    db,
    client,
    async close() {
      await client.end();
    },
  };
}

/**
 * Cleans all tables in the correct order (respecting foreign keys).
 * Use this in beforeEach/afterEach to ensure test isolation.
 */
export async function cleanDatabase(db: PostgresJsDatabase<typeof schema>) {
  // Delete in reverse dependency order
  await db.delete(schema.messages);
  await db.delete(schema.channelMembers);
  await db.delete(schema.channels);
  await db.delete(schema.moderationAuditLog);
  await db.delete(schema.sanctions);
  await db.delete(schema.reports);
  await db.delete(schema.userRoles);
  await db.delete(schema.notificationPreferences);
  await db.delete(schema.notifications);
  await db.delete(schema.achievementProgress);
  await db.delete(schema.userAchievements);
  await db.delete(schema.achievements);
  await db.delete(schema.loginStreaks);
  await db.delete(schema.pointsTransactions);
  await db.delete(schema.userPoints);
  await db.delete(schema.seasonRankings);
  await db.delete(schema.ratingHistory);
  await db.delete(schema.playerRatings);
  await db.delete(schema.seasons);
  await db.delete(schema.friends);
  await db.delete(schema.matches);
  await db.delete(schema.usernameHistory);
  await db.delete(schema.passwordResetTokens);
  await db.delete(schema.emailVerificationTokens);
  await db.delete(schema.sessions);
  await db.delete(schema.users);
}

/**
 * Resets auto-increment sequences for all tables.
 * Call after cleanDatabase if you want predictable IDs.
 */
export async function resetSequences(db: PostgresJsDatabase<typeof schema>) {
  const tables = [
    "users",
    "username_history",
    "matches",
    "friends",
    "seasons",
    "player_ratings",
    "rating_history",
    "season_rankings",
    "user_points",
    "points_transactions",
    "login_streaks",
    "achievements",
    "user_achievements",
    "achievement_progress",
    "notifications",
    "notification_preferences",
    "user_roles",
    "reports",
    "sanctions",
    "moderation_audit_log",
    "channels",
    "channel_members",
    "messages",
  ];

  for (const table of tables) {
    await db.execute(
      sql.raw(`ALTER SEQUENCE IF EXISTS ${table}_id_seq RESTART WITH 1`)
    );
  }
}

/**
 * Creates a test user with minimal required fields.
 */
export async function createTestUser(
  db: PostgresJsDatabase<typeof schema>,
  overrides: Partial<schema.NewUser> = {}
) {
  const timestamp = Date.now();
  const [user] = await db
    .insert(schema.users)
    .values({
      email: `test-${timestamp}@example.com`,
      displayName: `Test User ${timestamp}`,
      username: `testuser${timestamp}`,
      emailVerified: true,
      ...overrides,
    })
    .returning();

  return user;
}

/**
 * Creates a test session for a user.
 */
export async function createTestSession(
  db: PostgresJsDatabase<typeof schema>,
  userId: number,
  overrides: Partial<Omit<schema.NewSession, "userId">> = {}
) {
  const [session] = await db
    .insert(schema.sessions)
    .values({
      id: `test-session-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      userId,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      ...overrides,
    })
    .returning();

  return session;
}

/**
 * Creates a test match between two users.
 */
export async function createTestMatch(
  db: PostgresJsDatabase<typeof schema>,
  player1Id: number,
  player2Id: number | null,
  overrides: Partial<Omit<schema.NewMatch, "player1Id" | "player2Id">> = {}
) {
  const [match] = await db
    .insert(schema.matches)
    .values({
      player1Id,
      player2Id,
      player1Score: 11,
      player2Score: 5,
      duration: 300,
      winnerId: player1Id,
      ...overrides,
    })
    .returning();

  return match;
}

/**
 * Creates a friendship between two users.
 */
export async function createTestFriendship(
  db: PostgresJsDatabase<typeof schema>,
  userId: number,
  friendId: number,
  status: schema.FriendshipStatus = "accepted"
) {
  const [friendship] = await db
    .insert(schema.friends)
    .values({
      userId,
      friendId,
      status,
    })
    .returning();

  return friendship;
}
