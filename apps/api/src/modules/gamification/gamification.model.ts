import { t } from "elysia";

import { badRequest, conflict, notFound } from "../../common/errors";

export const GamificationModel = {
  historyQuery: t.Object({
    limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100, default: 20 })),
    offset: t.Optional(t.Numeric({ minimum: 0, default: 0 })),
    type: t.Optional(t.String()),
  }),

  userIdParam: t.Object({
    id: t.Numeric(),
  }),

  achievementIdParam: t.Object({
    achievementId: t.Numeric(),
  }),

  userPoints: t.Object({
    balance: t.Number(),
    totalEarned: t.Number(),
    totalSpent: t.Number(),
  }),

  pointsTransaction: t.Object({
    id: t.Number(),
    amount: t.Number(),
    type: t.String(),
    description: t.String(),
    referenceId: t.Nullable(t.Number()),
    referenceType: t.Nullable(t.String()),
    createdAt: t.Date(),
  }),

  loginStreak: t.Object({
    currentStreak: t.Number(),
    longestStreak: t.Number(),
    lastLoginDate: t.Nullable(t.Date()),
    canClaimReward: t.Boolean(),
  }),

  dailyRewardResult: t.Object({
    points: t.Number(),
    streak: t.Number(),
    bonus: t.Number(),
    message: t.String(),
  }),

  achievement: t.Object({
    id: t.Number(),
    code: t.String(),
    name: t.String(),
    description: t.String(),
    icon: t.Nullable(t.String()),
    points: t.Number(),
    category: t.String(),
    targetProgress: t.Number(),
    isSecret: t.Boolean(),
  }),

  achievementWithStatus: t.Object({
    id: t.Number(),
    code: t.String(),
    name: t.String(),
    description: t.String(),
    icon: t.Nullable(t.String()),
    points: t.Number(),
    category: t.String(),
    targetProgress: t.Number(),
    isSecret: t.Boolean(),
    unlocked: t.Boolean(),
    unlockedAt: t.Nullable(t.Date()),
    currentProgress: t.Number(),
  }),

  userAchievement: t.Object({
    id: t.Number(),
    achievementId: t.Number(),
    code: t.String(),
    name: t.String(),
    description: t.String(),
    icon: t.Nullable(t.String()),
    points: t.Number(),
    category: t.String(),
    unlockedAt: t.Date(),
  }),

  gamificationError: t.Union([
    t.Object({ type: t.Literal("USER_NOT_FOUND") }),
    t.Object({ type: t.Literal("ACHIEVEMENT_NOT_FOUND") }),
    t.Object({ type: t.Literal("ALREADY_CLAIMED_TODAY") }),
    t.Object({ type: t.Literal("ACHIEVEMENT_ALREADY_UNLOCKED") }),
    t.Object({ type: t.Literal("INSUFFICIENT_POINTS") }),
  ]),
};

export type HistoryQuery = (typeof GamificationModel.historyQuery)["static"];
export type UserIdParam = (typeof GamificationModel.userIdParam)["static"];
export type AchievementIdParam =
  (typeof GamificationModel.achievementIdParam)["static"];

export type UserPoints = (typeof GamificationModel.userPoints)["static"];
export type PointsTransaction =
  (typeof GamificationModel.pointsTransaction)["static"];
export type LoginStreak = (typeof GamificationModel.loginStreak)["static"];
export type DailyRewardResult =
  (typeof GamificationModel.dailyRewardResult)["static"];
export type Achievement = (typeof GamificationModel.achievement)["static"];
export type AchievementWithStatus =
  (typeof GamificationModel.achievementWithStatus)["static"];
export type UserAchievement =
  (typeof GamificationModel.userAchievement)["static"];

export type GamificationError =
  (typeof GamificationModel.gamificationError)["static"];

/**
 * Maps gamification errors to RFC 9457 Problem Details.
 */
export function mapGamificationError(
  error: GamificationError,
  instance: string
) {
  switch (error.type) {
    case "USER_NOT_FOUND":
      return notFound("User not found", { instance });
    case "ACHIEVEMENT_NOT_FOUND":
      return notFound("Achievement not found", { instance });
    case "ALREADY_CLAIMED_TODAY":
      return conflict("Daily reward already claimed today", { instance });
    case "ACHIEVEMENT_ALREADY_UNLOCKED":
      return conflict("Achievement already unlocked", { instance });
    case "INSUFFICIENT_POINTS":
      return badRequest("Insufficient points", { instance });
  }
}
