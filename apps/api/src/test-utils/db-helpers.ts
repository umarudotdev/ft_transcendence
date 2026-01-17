/**
 * Database test helpers for integration tests.
 * Provides transaction isolation and cleanup utilities.
 *
 * Note: These helpers require a running test database.
 * For unit tests, prefer mocking the repository layer instead.
 */

import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import { db } from "../db";
import * as schema from "../db/schema";

export type TestDatabase = PostgresJsDatabase<typeof schema>;

/**
 * Clean up test data from the database.
 * Use this in afterEach/afterAll to ensure test isolation.
 *
 * IMPORTANT: Only use in test environment!
 */
export async function cleanupTestData(): Promise<void> {
  if (process.env.NODE_ENV !== "test") {
    throw new Error(
      "cleanupTestData should only be called in test environment"
    );
  }

  // Delete in reverse order of dependencies
  await db.delete(schema.messages);
  await db.delete(schema.channelMembers);
  await db.delete(schema.channels);
  await db.delete(schema.passwordResetTokens);
  await db.delete(schema.emailVerificationTokens);
  await db.delete(schema.sessions);
  await db.delete(schema.userRoles);
  await db.delete(schema.friends);
  await db.delete(schema.users);
}

/**
 * Create a test user directly in the database.
 * Returns the created user for use in integration tests.
 */
export async function createUserInDb(data: {
  email: string;
  displayName: string;
  username?: string;
  passwordHash?: string;
  emailVerified?: boolean;
  intraId?: number;
  twoFactorEnabled?: boolean;
  totpSecret?: string;
}) {
  // Generate a unique username if not provided
  const username =
    data.username ??
    `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const [user] = await db
    .insert(schema.users)
    .values({
      email: data.email.toLowerCase(),
      passwordHash: data.passwordHash ?? null,
      displayName: data.displayName,
      username: username.toLowerCase(),
      emailVerified: data.emailVerified ?? true,
      intraId: data.intraId ?? null,
      twoFactorEnabled: data.twoFactorEnabled ?? false,
      totpSecret: data.totpSecret ?? null,
    })
    .returning();

  return user;
}

/**
 * Create a test session directly in the database.
 */
export async function createSessionInDb(data: {
  id: string;
  userId: number;
  expiresAt: Date;
}) {
  const [session] = await db
    .insert(schema.sessions)
    .values({
      id: data.id,
      userId: data.userId,
      expiresAt: data.expiresAt,
    })
    .returning();

  return session;
}

/**
 * Create a test channel directly in the database.
 */
export async function createChannelInDb(data: {
  type: "dm" | "public" | "private";
  name?: string;
  createdBy?: number;
}) {
  const [channel] = await db
    .insert(schema.channels)
    .values({
      type: data.type,
      name: data.name ?? null,
      createdBy: data.createdBy ?? null,
    })
    .returning();

  return channel;
}

/**
 * Add a member to a channel in the database.
 */
export async function addChannelMemberInDb(data: {
  channelId: number;
  userId: number;
  role?: "owner" | "admin" | "member";
}) {
  const [member] = await db
    .insert(schema.channelMembers)
    .values({
      channelId: data.channelId,
      userId: data.userId,
      role: data.role ?? "member",
    })
    .returning();

  return member;
}

/**
 * Create a test message directly in the database.
 * Note: Content should already be encrypted if testing real repository behavior.
 */
export async function createMessageInDb(data: {
  channelId: number;
  senderId: number;
  content: string;
}) {
  const [message] = await db
    .insert(schema.messages)
    .values({
      channelId: data.channelId,
      senderId: data.senderId,
      content: data.content,
    })
    .returning();

  return message;
}

/**
 * Create a blocked relationship between two users.
 */
export async function createBlockInDb(userId: number, blockedUserId: number) {
  const [friend] = await db
    .insert(schema.friends)
    .values({
      userId,
      friendId: blockedUserId,
      status: "blocked",
    })
    .returning();

  return friend;
}

/**
 * Create an email verification token in the database.
 */
export async function createEmailTokenInDb(data: {
  id: string;
  userId: number;
  expiresAt: Date;
}) {
  const [token] = await db
    .insert(schema.emailVerificationTokens)
    .values({
      id: data.id,
      userId: data.userId,
      expiresAt: data.expiresAt,
    })
    .returning();

  return token;
}

/**
 * Create a password reset token in the database.
 */
export async function createPasswordResetTokenInDb(data: {
  id: string;
  userId: number;
  expiresAt: Date;
}) {
  const [token] = await db
    .insert(schema.passwordResetTokens)
    .values({
      id: data.id,
      userId: data.userId,
      expiresAt: data.expiresAt,
    })
    .returning();

  return token;
}

/**
 * Set up a complete DM channel between two users.
 * Returns the channel and both memberships.
 */
export async function setupDMInDb(user1Id: number, user2Id: number) {
  const channel = await createChannelInDb({ type: "dm", createdBy: user1Id });
  const member1 = await addChannelMemberInDb({
    channelId: channel.id,
    userId: user1Id,
  });
  const member2 = await addChannelMemberInDb({
    channelId: channel.id,
    userId: user2Id,
  });

  return { channel, member1, member2 };
}

/**
 * Generate a unique test email to avoid conflicts.
 */
export function generateTestEmail(prefix = "test"): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}@test.local`;
}

/**
 * Generate a unique test session ID.
 */
export function generateTestSessionId(): string {
  return `test_session_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Wait for a specified time (useful for testing time-dependent behavior).
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
