/**
 * Test fixture factory functions for creating test data.
 * These provide consistent, isolated test data for unit and integration tests.
 */

let userIdCounter = 1;
let channelIdCounter = 1;
let messageIdCounter = 1;
let sessionIdCounter = 1;

/**
 * Reset all counters. Call this in beforeEach to ensure test isolation.
 */
export function resetCounters() {
  userIdCounter = 1;
  channelIdCounter = 1;
  messageIdCounter = 1;
  sessionIdCounter = 1;
}

/**
 * Generate a unique test user
 */
export function createTestUser(overrides: Partial<TestUser> = {}): TestUser {
  const id = userIdCounter++;
  return {
    id,
    email: `testuser${id}@example.com`,
    displayName: `Test User ${id}`,
    passwordHash: "$argon2id$v=19$m=65536,t=3,p=4$randomsalt$hashedpassword", // Mock hash
    avatarUrl: null,
    emailVerified: true,
    twoFactorEnabled: false,
    totpSecret: null,
    intraId: null,
    failedLoginAttempts: 0,
    lockedUntil: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Generate a test user with 2FA enabled
 */
export function createTestUserWith2FA(
  overrides: Partial<TestUser> = {}
): TestUser {
  return createTestUser({
    twoFactorEnabled: true,
    totpSecret: "encrypted-secret-here",
    ...overrides,
  });
}

/**
 * Generate a test user from OAuth (no password)
 */
export function createTestOAuthUser(
  overrides: Partial<TestUser> = {}
): TestUser {
  const id = userIdCounter++;
  return createTestUser({
    id,
    email: `oauth${id}@42.fr`,
    displayName: `oauth_user_${id}`,
    passwordHash: null,
    intraId: 10000 + id,
    avatarUrl: `https://cdn.intra.42.fr/users/${id}.jpg`,
    ...overrides,
  });
}

/**
 * Generate a test session
 */
export function createTestSession(
  userId: number,
  overrides: Partial<TestSession> = {}
): TestSession {
  const id = `session_${sessionIdCounter++}_${Date.now()}`;
  return {
    id,
    userId,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    createdAt: new Date(),
    ...overrides,
  };
}

/**
 * Generate an expired test session
 */
export function createExpiredSession(
  userId: number,
  overrides: Partial<TestSession> = {}
): TestSession {
  return createTestSession(userId, {
    expiresAt: new Date(Date.now() - 60 * 60 * 1000), // Expired 1 hour ago
    ...overrides,
  });
}

/**
 * Generate a test channel
 */
export function createTestChannel(
  overrides: Partial<TestChannel> = {}
): TestChannel {
  const id = channelIdCounter++;
  return {
    id,
    name: null,
    type: "dm",
    createdBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Generate a test public channel
 */
export function createTestPublicChannel(
  createdBy: number,
  overrides: Partial<TestChannel> = {}
): TestChannel {
  const id = channelIdCounter++;
  return createTestChannel({
    id,
    name: `Test Channel ${id}`,
    type: "public",
    createdBy,
    ...overrides,
  });
}

/**
 * Generate a test channel membership
 */
export function createTestChannelMember(
  channelId: number,
  userId: number,
  overrides: Partial<TestChannelMember> = {}
): TestChannelMember {
  return {
    id: channelIdCounter++,
    channelId,
    userId,
    role: "member",
    lastReadAt: null,
    joinedAt: new Date(),
    ...overrides,
  };
}

/**
 * Generate a test message (plaintext, pre-encryption)
 */
export function createTestMessage(
  channelId: number,
  senderId: number,
  overrides: Partial<TestMessage> = {}
): TestMessage {
  const id = messageIdCounter++;
  return {
    id,
    channelId,
    senderId,
    content: `Test message ${id}`,
    editedAt: null,
    deletedAt: null,
    createdAt: new Date(),
    ...overrides,
  };
}

/**
 * Generate a test message with sender info (as returned from repository)
 */
export function createTestMessageWithSender(
  channelId: number,
  sender: { id: number; displayName: string; avatarUrl: string | null },
  overrides: Partial<TestMessageWithSender> = {}
): TestMessageWithSender {
  const base = createTestMessage(channelId, sender.id, overrides);
  return {
    ...base,
    sender: {
      id: sender.id,
      displayName: sender.displayName,
      avatarUrl: sender.avatarUrl,
    },
  };
}

/**
 * Generate a DM setup between two users
 */
export function createTestDMSetup(): TestDMSetup {
  const user1 = createTestUser();
  const user2 = createTestUser();
  const channel = createTestChannel({ createdBy: user1.id });
  const member1 = createTestChannelMember(channel.id, user1.id);
  const member2 = createTestChannelMember(channel.id, user2.id);

  return {
    user1,
    user2,
    channel,
    members: [member1, member2],
  };
}

/**
 * Generate a blocked relationship
 */
export function createTestBlock(
  userId: number,
  blockedUserId: number
): TestFriendship {
  return {
    id: userIdCounter++,
    userId,
    friendId: blockedUserId,
    status: "blocked",
    createdAt: new Date(),
  };
}

/**
 * Generate email verification token
 */
export function createTestEmailToken(
  userId: number,
  expired = false
): TestEmailToken {
  const id = `email_token_${Date.now()}_${userId}`;
  return {
    id,
    userId,
    expiresAt: expired
      ? new Date(Date.now() - 60 * 60 * 1000)
      : new Date(Date.now() + 24 * 60 * 60 * 1000),
    createdAt: new Date(),
  };
}

/**
 * Generate password reset token
 */
export function createTestPasswordResetToken(
  userId: number,
  expired = false
): TestPasswordResetToken {
  const id = `reset_token_${Date.now()}_${userId}`;
  return {
    id,
    userId,
    expiresAt: expired
      ? new Date(Date.now() - 60 * 60 * 1000)
      : new Date(Date.now() + 60 * 60 * 1000),
    createdAt: new Date(),
  };
}

// Type definitions for test fixtures
export interface TestUser {
  id: number;
  email: string;
  displayName: string;
  passwordHash: string | null;
  avatarUrl: string | null;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  totpSecret: string | null;
  intraId: number | null;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TestSession {
  id: string;
  userId: number;
  expiresAt: Date;
  createdAt: Date;
}

export interface TestChannel {
  id: number;
  name: string | null;
  type: "dm" | "public" | "private";
  createdBy: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TestChannelMember {
  id: number;
  channelId: number;
  userId: number;
  role: "owner" | "admin" | "member";
  lastReadAt: Date | null;
  joinedAt: Date;
}

export interface TestMessage {
  id: number;
  channelId: number;
  senderId: number;
  content: string;
  editedAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
}

export interface TestMessageWithSender extends TestMessage {
  sender: {
    id: number;
    displayName: string;
    avatarUrl: string | null;
  };
}

export interface TestDMSetup {
  user1: TestUser;
  user2: TestUser;
  channel: TestChannel;
  members: TestChannelMember[];
}

export interface TestFriendship {
  id: number;
  userId: number;
  friendId: number;
  status: "pending" | "accepted" | "blocked";
  createdAt: Date;
}

export interface TestEmailToken {
  id: string;
  userId: number;
  expiresAt: Date;
  createdAt: Date;
}

export interface TestPasswordResetToken {
  id: string;
  userId: number;
  expiresAt: Date;
  createdAt: Date;
}
