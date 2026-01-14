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
  (table) => [
    index("users_intra_id_idx").on(table.intraId),

    index("users_email_idx").on(table.email),
  ]
);
export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),

    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("sessions_user_id_idx").on(table.userId),

    index("sessions_expires_at_idx").on(table.expiresAt),
  ]
);
export const emailVerificationTokens = pgTable(
  "email_verification_tokens",
  {
    id: text("id").primaryKey(),

    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("email_verification_tokens_user_id_idx").on(table.userId)]
);
export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    id: text("id").primaryKey(),

    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("password_reset_tokens_user_id_idx").on(table.userId)]
);
export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  emailVerificationTokens: many(emailVerificationTokens),
  passwordResetTokens: many(passwordResetTokens),

  player1Matches: many(matches, { relationName: "player1Matches" }),

  player2Matches: many(matches, { relationName: "player2Matches" }),

  wonMatches: many(matches, { relationName: "wonMatches" }),

  friendships: many(friends, { relationName: "friendships" }),

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
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type EmailVerificationToken =
  typeof emailVerificationTokens.$inferSelect;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export const matches = pgTable(
  "matches",
  {
    id: serial("id").primaryKey(),

    player1Id: integer("player1_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    player2Id: integer("player2_id").references(() => users.id, {
      onDelete: "set null",
    }),

    player1Score: integer("player1_score").notNull(),
    player2Score: integer("player2_score").notNull(),

    winnerId: integer("winner_id").references(() => users.id, {
      onDelete: "set null",
    }),

    gameType: text("game_type").notNull().default("pong"),
    isAiGame: boolean("is_ai_game").default(false).notNull(),
    metadata: text("metadata"),

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
export const friendshipStatusEnum = ["pending", "accepted", "blocked"] as const;
export type FriendshipStatus = (typeof friendshipStatusEnum)[number];

export const friends = pgTable(
  "friends",
  {
    id: serial("id").primaryKey(),

    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    friendId: integer("friend_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

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
export type Match = typeof matches.$inferSelect;
export type NewMatch = typeof matches.$inferInsert;
export type Friend = typeof friends.$inferSelect;
export type NewFriend = typeof friends.$inferInsert;
