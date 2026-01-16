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
export const usersRelations = relations(users, ({ many, one }) => ({
  sessions: many(sessions),
  emailVerificationTokens: many(emailVerificationTokens),
  passwordResetTokens: many(passwordResetTokens),

  player1Matches: many(matches, { relationName: "player1Matches" }),

  player2Matches: many(matches, { relationName: "player2Matches" }),

  wonMatches: many(matches, { relationName: "wonMatches" }),

  friendships: many(friends, { relationName: "friendships" }),

  friendOf: many(friends, { relationName: "friendOf" }),

  // Ranking relations
  playerRating: one(playerRatings),
  ratingHistory: many(ratingHistory),
  seasonRankings: many(seasonRankings),

  // Gamification relations
  points: one(userPoints),
  pointsTransactions: many(pointsTransactions),
  loginStreak: one(loginStreaks),
  achievements: many(userAchievements),
  achievementProgress: many(achievementProgress),

  // Notification relations
  notifications: many(notifications),
  notificationPreferences: one(notificationPreferences),

  // Moderation relations
  role: one(userRoles),
  reportsFiled: many(reports, { relationName: "reporterReports" }),
  reportsReceived: many(reports, { relationName: "reportedUserReports" }),
  reportsResolved: many(reports, { relationName: "resolverReports" }),
  sanctions: many(sanctions, { relationName: "userSanctions" }),
  sanctionsIssued: many(sanctions, { relationName: "issuedSanctions" }),
  sanctionsRevoked: many(sanctions, { relationName: "revokedSanctions" }),
  auditLogsPerformed: many(moderationAuditLog, {
    relationName: "actorAuditLogs",
  }),
  auditLogsReceived: many(moderationAuditLog, {
    relationName: "targetUserAuditLogs",
  }),

  // Chat relations
  channelMemberships: many(channelMembers),
  sentMessages: many(messages),
  createdChannels: many(channels),
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

// =============================================================================
// RANKING SYSTEM
// =============================================================================

export const seasons = pgTable("seasons", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  startDate: timestamp("start_date", { withTimezone: true }).notNull(),
  endDate: timestamp("end_date", { withTimezone: true }).notNull(),
  isActive: boolean("is_active").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const playerTierEnum = ["bronze", "silver", "gold", "platinum"] as const;
export type PlayerTier = (typeof playerTierEnum)[number];

export const playerRatings = pgTable(
  "player_ratings",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" })
      .unique(),
    rating: integer("rating").notNull().default(1000),
    peakRating: integer("peak_rating").notNull().default(1000),
    gamesRated: integer("games_rated").notNull().default(0),
    tier: text("tier").notNull().default("bronze"),
    seasonId: integer("season_id").references(() => seasons.id),
    lastActivityAt: timestamp("last_activity_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("player_ratings_user_id_idx").on(table.userId),
    index("player_ratings_rating_idx").on(table.rating),
    index("player_ratings_tier_idx").on(table.tier),
    index("player_ratings_last_activity_idx").on(table.lastActivityAt),
  ]
);

export const ratingHistory = pgTable(
  "rating_history",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    matchId: integer("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    ratingBefore: integer("rating_before").notNull(),
    ratingAfter: integer("rating_after").notNull(),
    ratingChange: integer("rating_change").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("rating_history_user_id_idx").on(table.userId),
    index("rating_history_match_id_idx").on(table.matchId),
    index("rating_history_created_at_idx").on(table.createdAt),
  ]
);

export const seasonRankings = pgTable(
  "season_rankings",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    seasonId: integer("season_id")
      .notNull()
      .references(() => seasons.id, { onDelete: "cascade" }),
    finalRating: integer("final_rating").notNull(),
    finalRank: integer("final_rank").notNull(),
    tier: text("tier").notNull(),
    gamesPlayed: integer("games_played").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("season_rankings_user_id_idx").on(table.userId),
    index("season_rankings_season_id_idx").on(table.seasonId),
  ]
);

// Ranking relations
export const seasonsRelations = relations(seasons, ({ many }) => ({
  playerRatings: many(playerRatings),
  seasonRankings: many(seasonRankings),
}));

export const playerRatingsRelations = relations(playerRatings, ({ one }) => ({
  user: one(users, {
    fields: [playerRatings.userId],
    references: [users.id],
  }),
  season: one(seasons, {
    fields: [playerRatings.seasonId],
    references: [seasons.id],
  }),
}));

export const ratingHistoryRelations = relations(ratingHistory, ({ one }) => ({
  user: one(users, {
    fields: [ratingHistory.userId],
    references: [users.id],
  }),
  match: one(matches, {
    fields: [ratingHistory.matchId],
    references: [matches.id],
  }),
}));

export const seasonRankingsRelations = relations(seasonRankings, ({ one }) => ({
  user: one(users, {
    fields: [seasonRankings.userId],
    references: [users.id],
  }),
  season: one(seasons, {
    fields: [seasonRankings.seasonId],
    references: [seasons.id],
  }),
}));

export type Season = typeof seasons.$inferSelect;
export type NewSeason = typeof seasons.$inferInsert;
export type PlayerRating = typeof playerRatings.$inferSelect;
export type NewPlayerRating = typeof playerRatings.$inferInsert;
export type RatingHistory = typeof ratingHistory.$inferSelect;
export type NewRatingHistory = typeof ratingHistory.$inferInsert;
export type SeasonRanking = typeof seasonRankings.$inferSelect;
export type NewSeasonRanking = typeof seasonRankings.$inferInsert;

// =============================================================================
// GAMIFICATION SYSTEM
// =============================================================================

export const userPoints = pgTable(
  "user_points",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" })
      .unique(),
    balance: integer("balance").notNull().default(0),
    totalEarned: integer("total_earned").notNull().default(0),
    totalSpent: integer("total_spent").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("user_points_user_id_idx").on(table.userId)]
);

export const pointsTransactionTypeEnum = [
  "win",
  "daily_login",
  "streak_bonus",
  "achievement",
  "purchase",
  "admin_adjustment",
] as const;
export type PointsTransactionType = (typeof pointsTransactionTypeEnum)[number];

export const pointsTransactions = pgTable(
  "points_transactions",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    amount: integer("amount").notNull(),
    type: text("type").notNull(),
    description: text("description").notNull(),
    referenceId: integer("reference_id"),
    referenceType: text("reference_type"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("points_transactions_user_id_idx").on(table.userId),
    index("points_transactions_type_idx").on(table.type),
    index("points_transactions_created_at_idx").on(table.createdAt),
  ]
);

export const loginStreaks = pgTable(
  "login_streaks",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" })
      .unique(),
    currentStreak: integer("current_streak").notNull().default(0),
    longestStreak: integer("longest_streak").notNull().default(0),
    lastLoginDate: timestamp("last_login_date", { withTimezone: true }),
    lastClaimedAt: timestamp("last_claimed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("login_streaks_user_id_idx").on(table.userId)]
);

export const achievementCategoryEnum = [
  "gameplay",
  "social",
  "milestone",
] as const;
export type AchievementCategory = (typeof achievementCategoryEnum)[number];

export const achievements = pgTable("achievements", {
  id: serial("id").primaryKey(),
  code: text("code").unique().notNull(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  icon: text("icon"),
  points: integer("points").notNull().default(0),
  category: text("category").notNull(),
  targetProgress: integer("target_progress").default(1).notNull(),
  isSecret: boolean("is_secret").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const userAchievements = pgTable(
  "user_achievements",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    achievementId: integer("achievement_id")
      .notNull()
      .references(() => achievements.id, { onDelete: "cascade" }),
    unlockedAt: timestamp("unlocked_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("user_achievements_user_id_idx").on(table.userId),
    index("user_achievements_achievement_id_idx").on(table.achievementId),
  ]
);

export const achievementProgress = pgTable(
  "achievement_progress",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    achievementId: integer("achievement_id")
      .notNull()
      .references(() => achievements.id, { onDelete: "cascade" }),
    currentProgress: integer("current_progress").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("achievement_progress_user_id_idx").on(table.userId),
    index("achievement_progress_achievement_id_idx").on(table.achievementId),
  ]
);

// Gamification relations
export const userPointsRelations = relations(userPoints, ({ one }) => ({
  user: one(users, {
    fields: [userPoints.userId],
    references: [users.id],
  }),
}));

export const pointsTransactionsRelations = relations(
  pointsTransactions,
  ({ one }) => ({
    user: one(users, {
      fields: [pointsTransactions.userId],
      references: [users.id],
    }),
  })
);

export const loginStreaksRelations = relations(loginStreaks, ({ one }) => ({
  user: one(users, {
    fields: [loginStreaks.userId],
    references: [users.id],
  }),
}));

export const achievementsRelations = relations(achievements, ({ many }) => ({
  userAchievements: many(userAchievements),
  achievementProgress: many(achievementProgress),
}));

export const userAchievementsRelations = relations(
  userAchievements,
  ({ one }) => ({
    user: one(users, {
      fields: [userAchievements.userId],
      references: [users.id],
    }),
    achievement: one(achievements, {
      fields: [userAchievements.achievementId],
      references: [achievements.id],
    }),
  })
);

export const achievementProgressRelations = relations(
  achievementProgress,
  ({ one }) => ({
    user: one(users, {
      fields: [achievementProgress.userId],
      references: [users.id],
    }),
    achievement: one(achievements, {
      fields: [achievementProgress.achievementId],
      references: [achievements.id],
    }),
  })
);

export type UserPoints = typeof userPoints.$inferSelect;
export type NewUserPoints = typeof userPoints.$inferInsert;
export type PointsTransaction = typeof pointsTransactions.$inferSelect;
export type NewPointsTransaction = typeof pointsTransactions.$inferInsert;
export type LoginStreak = typeof loginStreaks.$inferSelect;
export type NewLoginStreak = typeof loginStreaks.$inferInsert;
export type Achievement = typeof achievements.$inferSelect;
export type NewAchievement = typeof achievements.$inferInsert;
export type UserAchievement = typeof userAchievements.$inferSelect;
export type NewUserAchievement = typeof userAchievements.$inferInsert;
export type AchievementProgress = typeof achievementProgress.$inferSelect;
export type NewAchievementProgress = typeof achievementProgress.$inferInsert;

// =============================================================================
// NOTIFICATIONS SYSTEM
// =============================================================================

export const notificationTypeEnum = [
  "match_invite",
  "friend_request",
  "achievement",
  "rank_change",
  "system",
  "chat_message",
] as const;
export type NotificationType = (typeof notificationTypeEnum)[number];

export const notifications = pgTable(
  "notifications",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    message: text("message").notNull(),
    data: text("data"),
    isRead: boolean("is_read").default(false).notNull(),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("notifications_user_id_idx").on(table.userId),
    index("notifications_type_idx").on(table.type),
    index("notifications_is_read_idx").on(table.isRead),
    index("notifications_created_at_idx").on(table.createdAt),
  ]
);

export const notificationPreferences = pgTable(
  "notification_preferences",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" })
      .unique(),
    matchInvites: boolean("match_invites").default(true).notNull(),
    friendRequests: boolean("friend_requests").default(true).notNull(),
    achievements: boolean("achievements").default(true).notNull(),
    rankChanges: boolean("rank_changes").default(true).notNull(),
    systemMessages: boolean("system_messages").default(true).notNull(),
    chatMessages: boolean("chat_messages").default(true).notNull(),
    emailNotifications: boolean("email_notifications").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("notification_preferences_user_id_idx").on(table.userId)]
);

// Notification relations
export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));

export const notificationPreferencesRelations = relations(
  notificationPreferences,
  ({ one }) => ({
    user: one(users, {
      fields: [notificationPreferences.userId],
      references: [users.id],
    }),
  })
);

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
export type NotificationPreference =
  typeof notificationPreferences.$inferSelect;
export type NewNotificationPreference =
  typeof notificationPreferences.$inferInsert;

// =============================================================================
// MODERATION SYSTEM
// =============================================================================

export const userRoleEnum = ["user", "moderator", "admin"] as const;
export type UserRole = (typeof userRoleEnum)[number];

export const userRoles = pgTable(
  "user_roles",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" })
      .unique(),
    role: text("role").notNull().default("user"),
    assignedBy: integer("assigned_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("user_roles_user_id_idx").on(table.userId),
    index("user_roles_role_idx").on(table.role),
  ]
);

export const reportReasonEnum = [
  "afk",
  "cheating",
  "harassment",
  "inappropriate_name",
  "other",
] as const;
export type ReportReason = (typeof reportReasonEnum)[number];

export const reportStatusEnum = [
  "pending",
  "reviewed",
  "resolved",
  "dismissed",
] as const;
export type ReportStatus = (typeof reportStatusEnum)[number];

export const reports = pgTable(
  "reports",
  {
    id: serial("id").primaryKey(),
    reporterId: integer("reporter_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    reportedUserId: integer("reported_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    matchId: integer("match_id").references(() => matches.id, {
      onDelete: "set null",
    }),
    reason: text("reason").notNull(),
    description: text("description"),
    status: text("status").notNull().default("pending"),
    resolvedBy: integer("resolved_by").references(() => users.id),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolution: text("resolution"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("reports_reporter_id_idx").on(table.reporterId),
    index("reports_reported_user_id_idx").on(table.reportedUserId),
    index("reports_status_idx").on(table.status),
    index("reports_created_at_idx").on(table.createdAt),
  ]
);

export const sanctionTypeEnum = ["warning", "timeout", "ban"] as const;
export type SanctionType = (typeof sanctionTypeEnum)[number];

export const sanctions = pgTable(
  "sanctions",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    reason: text("reason").notNull(),
    reportId: integer("report_id").references(() => reports.id, {
      onDelete: "set null",
    }),
    issuedBy: integer("issued_by")
      .notNull()
      .references(() => users.id),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    isActive: boolean("is_active").default(true).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokedBy: integer("revoked_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("sanctions_user_id_idx").on(table.userId),
    index("sanctions_type_idx").on(table.type),
    index("sanctions_is_active_idx").on(table.isActive),
    index("sanctions_expires_at_idx").on(table.expiresAt),
  ]
);

export const moderationAuditLog = pgTable(
  "moderation_audit_log",
  {
    id: serial("id").primaryKey(),
    actorId: integer("actor_id")
      .notNull()
      .references(() => users.id),
    action: text("action").notNull(),
    targetUserId: integer("target_user_id").references(() => users.id),
    targetId: integer("target_id"),
    targetType: text("target_type"),
    details: text("details"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("moderation_audit_log_actor_id_idx").on(table.actorId),
    index("moderation_audit_log_target_user_id_idx").on(table.targetUserId),
    index("moderation_audit_log_action_idx").on(table.action),
    index("moderation_audit_log_created_at_idx").on(table.createdAt),
  ]
);

// Moderation relations
export const userRolesRelations = relations(userRoles, ({ one }) => ({
  user: one(users, {
    fields: [userRoles.userId],
    references: [users.id],
  }),
  assignedByUser: one(users, {
    fields: [userRoles.assignedBy],
    references: [users.id],
  }),
}));

export const reportsRelations = relations(reports, ({ one }) => ({
  reporter: one(users, {
    fields: [reports.reporterId],
    references: [users.id],
    relationName: "reporterReports",
  }),
  reportedUser: one(users, {
    fields: [reports.reportedUserId],
    references: [users.id],
    relationName: "reportedUserReports",
  }),
  match: one(matches, {
    fields: [reports.matchId],
    references: [matches.id],
  }),
  resolver: one(users, {
    fields: [reports.resolvedBy],
    references: [users.id],
    relationName: "resolverReports",
  }),
}));

export const sanctionsRelations = relations(sanctions, ({ one }) => ({
  user: one(users, {
    fields: [sanctions.userId],
    references: [users.id],
    relationName: "userSanctions",
  }),
  report: one(reports, {
    fields: [sanctions.reportId],
    references: [reports.id],
  }),
  issuer: one(users, {
    fields: [sanctions.issuedBy],
    references: [users.id],
    relationName: "issuedSanctions",
  }),
  revoker: one(users, {
    fields: [sanctions.revokedBy],
    references: [users.id],
    relationName: "revokedSanctions",
  }),
}));

export const moderationAuditLogRelations = relations(
  moderationAuditLog,
  ({ one }) => ({
    actor: one(users, {
      fields: [moderationAuditLog.actorId],
      references: [users.id],
      relationName: "actorAuditLogs",
    }),
    targetUser: one(users, {
      fields: [moderationAuditLog.targetUserId],
      references: [users.id],
      relationName: "targetUserAuditLogs",
    }),
  })
);

export type UserRoleRecord = typeof userRoles.$inferSelect;
export type NewUserRoleRecord = typeof userRoles.$inferInsert;
export type Report = typeof reports.$inferSelect;
export type NewReport = typeof reports.$inferInsert;
export type Sanction = typeof sanctions.$inferSelect;
export type NewSanction = typeof sanctions.$inferInsert;
export type ModerationAuditLogEntry = typeof moderationAuditLog.$inferSelect;
export type NewModerationAuditLogEntry = typeof moderationAuditLog.$inferInsert;

// =============================================================================
// CHAT SYSTEM
// =============================================================================

export const channelTypeEnum = ["dm", "public", "private"] as const;
export type ChannelType = (typeof channelTypeEnum)[number];

export const channelRoleEnum = ["owner", "admin", "member"] as const;
export type ChannelRole = (typeof channelRoleEnum)[number];

export const channels = pgTable(
  "channels",
  {
    id: serial("id").primaryKey(),
    name: text("name"),
    type: text("type").notNull().default("dm"),
    createdBy: integer("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("channels_type_idx").on(table.type),
    index("channels_created_by_idx").on(table.createdBy),
  ]
);

export const channelMembers = pgTable(
  "channel_members",
  {
    id: serial("id").primaryKey(),
    channelId: integer("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("member"),
    lastReadAt: timestamp("last_read_at", { withTimezone: true }),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("channel_members_channel_id_idx").on(table.channelId),
    index("channel_members_user_id_idx").on(table.userId),
    index("channel_members_unique_idx").on(table.channelId, table.userId),
  ]
);

export const messages = pgTable(
  "messages",
  {
    id: serial("id").primaryKey(),
    channelId: integer("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    senderId: integer("sender_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    editedAt: timestamp("edited_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("messages_channel_id_idx").on(table.channelId),
    index("messages_sender_id_idx").on(table.senderId),
    index("messages_channel_created_at_idx").on(
      table.channelId,
      table.createdAt
    ),
  ]
);

// Chat relations
export const channelsRelations = relations(channels, ({ one, many }) => ({
  creator: one(users, {
    fields: [channels.createdBy],
    references: [users.id],
  }),
  members: many(channelMembers),
  messages: many(messages),
}));

export const channelMembersRelations = relations(channelMembers, ({ one }) => ({
  channel: one(channels, {
    fields: [channelMembers.channelId],
    references: [channels.id],
  }),
  user: one(users, {
    fields: [channelMembers.userId],
    references: [users.id],
  }),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  channel: one(channels, {
    fields: [messages.channelId],
    references: [channels.id],
  }),
  sender: one(users, {
    fields: [messages.senderId],
    references: [users.id],
  }),
}));

export type Channel = typeof channels.$inferSelect;
export type NewChannel = typeof channels.$inferInsert;
export type ChannelMember = typeof channelMembers.$inferSelect;
export type NewChannelMember = typeof channelMembers.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
