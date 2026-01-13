import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

// =============================================================================
// USERS TABLE
// =============================================================================
export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),

    // Primary identifier for email/password auth
    email: text("email").unique().notNull(),

    // Argon2id hash - nullable for OAuth-only users
    passwordHash: text("password_hash"),

    // Has the user verified their email address?
    emailVerified: boolean("email_verified").default(false).notNull(),

    // User-visible name
    displayName: text("display_name").notNull(),

    // Profile picture URL
    avatarUrl: text("avatar_url"),

    // 42 Intra user ID - for OAuth linking
    // Unique because one 42 account = one ft_transcendence account
    intraId: integer("intra_id").unique(),

    // Encrypted TOTP secret for 2FA
    // Stored encrypted, not plain text!
    totpSecret: text("totp_secret"),

    // Is 2FA currently enabled?
    twoFactorEnabled: boolean("two_factor_enabled").default(false).notNull(),

    // Account lockout for brute force protection
    failedLoginAttempts: integer("failed_login_attempts").default(0).notNull(),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // Index for OAuth lookups
    index("users_intra_id_idx").on(table.intraId),
    // Index for email lookups (login)
    index("users_email_idx").on(table.email),
  ]
);

// =============================================================================
// SESSIONS TABLE
// =============================================================================
export const sessions = pgTable(
  "sessions",
  {
    // Cryptographically random ID (not auto-increment!)
    id: text("id").primaryKey(),

    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    // When this session becomes invalid
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // Index for user's sessions (logout all)
    index("sessions_user_id_idx").on(table.userId),
    // Index for cleanup job
    index("sessions_expires_at_idx").on(table.expiresAt),
  ]
);

// =============================================================================
// EMAIL VERIFICATION TOKENS
// =============================================================================
export const emailVerificationTokens = pgTable(
  "email_verification_tokens",
  {
    // Random token sent in verification email
    id: text("id").primaryKey(),

    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    // 24 hours from creation
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("email_verification_tokens_user_id_idx").on(table.userId)]
);

// =============================================================================
// PASSWORD RESET TOKENS
// =============================================================================
export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    // Random token sent in reset email
    id: text("id").primaryKey(),

    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    // 1 hour from creation (shorter for security)
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("password_reset_tokens_user_id_idx").on(table.userId)]
);

// =============================================================================
// RELATIONS
// =============================================================================
export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  emailVerificationTokens: many(emailVerificationTokens),
  passwordResetTokens: many(passwordResetTokens),
  // Match history as player1
  player1Matches: many(matches, { relationName: "player1Matches" }),
  // Match history as player2
  player2Matches: many(matches, { relationName: "player2Matches" }),
  // Matches won
  wonMatches: many(matches, { relationName: "wonMatches" }),
  // Friends initiated by this user
  friendships: many(friends, { relationName: "friendships" }),
  // Friend requests received
  friendOf: many(friends, { relationName: "friendOf" }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const emailVerificationTokensRelations = relations(
  emailVerificationTokens,
  ({ one }) => ({
    user: one(users, {
      fields: [emailVerificationTokens.userId],
      references: [users.id],
    }),
  })
);

export const passwordResetTokensRelations = relations(
  passwordResetTokens,
  ({ one }) => ({
    user: one(users, {
      fields: [passwordResetTokens.userId],
      references: [users.id],
    }),
  })
);

// =============================================================================
// TYPE EXPORTS
// =============================================================================
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type EmailVerificationToken =
  typeof emailVerificationTokens.$inferSelect;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;

// =============================================================================
// MATCHES TABLE (Game History)
// =============================================================================
export const matches = pgTable(
  "matches",
  {
    id: serial("id").primaryKey(),

    // Players - player2 is nullable for AI games
    player1Id: integer("player1_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    player2Id: integer("player2_id").references(() => users.id, {
      onDelete: "set null",
    }),

    // Scores
    player1Score: integer("player1_score").notNull(),
    player2Score: integer("player2_score").notNull(),

    // Winner - nullable for draws
    winnerId: integer("winner_id").references(() => users.id, {
      onDelete: "set null",
    }),

    // Game metadata
    gameType: text("game_type").notNull().default("pong"),
    isAiGame: boolean("is_ai_game").default(false).notNull(),
    metadata: text("metadata"), // JSON string for game-specific data

    // Duration in seconds
    duration: integer("duration").notNull(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("matches_player1_id_idx").on(table.player1Id),
    index("matches_player2_id_idx").on(table.player2Id),
    index("matches_winner_id_idx").on(table.winnerId),
    index("matches_game_type_idx").on(table.gameType),
    index("matches_created_at_idx").on(table.createdAt),
  ]
);

// =============================================================================
// FRIENDS TABLE
// =============================================================================
export const friendshipStatusEnum = ["pending", "accepted", "blocked"] as const;
export type FriendshipStatus = (typeof friendshipStatusEnum)[number];

export const friends = pgTable(
  "friends",
  {
    id: serial("id").primaryKey(),

    // The user who initiated the friendship
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    // The friend
    friendId: integer("friend_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    // Status of the friendship
    status: text("status").notNull().default("pending"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("friends_user_id_idx").on(table.userId),
    index("friends_friend_id_idx").on(table.friendId),
    index("friends_status_idx").on(table.status),
  ]
);

// =============================================================================
// MATCHES RELATIONS
// =============================================================================
export const matchesRelations = relations(matches, ({ one }) => ({
  player1: one(users, {
    fields: [matches.player1Id],
    references: [users.id],
    relationName: "player1Matches",
  }),
  player2: one(users, {
    fields: [matches.player2Id],
    references: [users.id],
    relationName: "player2Matches",
  }),
  winner: one(users, {
    fields: [matches.winnerId],
    references: [users.id],
    relationName: "wonMatches",
  }),
}));

// =============================================================================
// FRIENDS RELATIONS
// =============================================================================
export const friendsRelations = relations(friends, ({ one }) => ({
  user: one(users, {
    fields: [friends.userId],
    references: [users.id],
    relationName: "friendships",
  }),
  friend: one(users, {
    fields: [friends.friendId],
    references: [users.id],
    relationName: "friendOf",
  }),
}));

// =============================================================================
// NEW TYPE EXPORTS
// =============================================================================
export type Match = typeof matches.$inferSelect;
export type NewMatch = typeof matches.$inferInsert;
export type Friend = typeof friends.$inferSelect;
export type NewFriend = typeof friends.$inferInsert;
