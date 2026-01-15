import { err, ok, ResultAsync } from "neverthrow";

import type { PointsTransactionType } from "../../db/schema";
import type {
  Achievement,
  AchievementWithStatus,
  DailyRewardResult,
  GamificationError,
  LoginStreak,
  PointsTransaction,
  UserAchievement,
  UserPoints,
} from "./gamification.model";

import { gamificationRepository } from "./gamification.repository";

abstract class GamificationService {
  // Points constants
  private static readonly POINTS_PER_WIN = 10;
  private static readonly POINTS_PER_RANKED_WIN = 15;
  private static readonly DAILY_LOGIN_BASE = 5;
  private static readonly STREAK_MULTIPLIER = 0.5;
  private static readonly MAX_STREAK_BONUS = 25;

  /**
   * Get or create user points.
   */
  static getOrCreateUserPoints(userId: number): ResultAsync<UserPoints, never> {
    return ResultAsync.fromPromise(
      (async () => {
        let points = await gamificationRepository.getUserPoints(userId);

        if (!points) {
          points = await gamificationRepository.createUserPoints(userId);
        }

        return {
          balance: points.balance,
          totalEarned: points.totalEarned,
          totalSpent: points.totalSpent,
        };
      })(),
      (): never => {
        throw new Error("Unexpected error getting user points");
      }
    );
  }

  /**
   * Award points to a user.
   */
  static awardPoints(
    userId: number,
    amount: number,
    type: PointsTransactionType,
    description: string,
    reference?: { id: number; type: string }
  ): ResultAsync<PointsTransaction, GamificationError> {
    return ResultAsync.fromPromise(
      (async () => {
        let points = await gamificationRepository.getUserPoints(userId);

        if (!points) {
          points = await gamificationRepository.createUserPoints(userId);
        }

        // Update balance
        await gamificationRepository.updateUserPoints(userId, {
          balance: points.balance + amount,
          totalEarned:
            amount > 0 ? points.totalEarned + amount : points.totalEarned,
          totalSpent:
            amount < 0
              ? points.totalSpent + Math.abs(amount)
              : points.totalSpent,
        });

        // Record transaction
        const transaction = await gamificationRepository.addPointsTransaction({
          userId,
          amount,
          type,
          description,
          referenceId: reference?.id,
          referenceType: reference?.type,
        });

        return ok({
          id: transaction.id,
          amount: transaction.amount,
          type: transaction.type,
          description: transaction.description,
          referenceId: transaction.referenceId,
          referenceType: transaction.referenceType,
          createdAt: transaction.createdAt,
        });
      })(),
      () => ({ type: "USER_NOT_FOUND" as const })
    ).andThen((result) => result);
  }

  /**
   * Get points transaction history.
   */
  static getPointsHistory(
    userId: number,
    options: { limit?: number; offset?: number; type?: string } = {}
  ): ResultAsync<
    { transactions: PointsTransaction[]; total: number; hasMore: boolean },
    never
  > {
    return ResultAsync.fromPromise(
      (async () => {
        const { limit = 20, offset = 0, type } = options;

        const transactions = await gamificationRepository.getPointsTransactions(
          userId,
          { limit: limit + 1, offset, type }
        );

        const total = await gamificationRepository.getPointsTransactionsCount(
          userId,
          type
        );

        const hasMore = transactions.length > limit;
        const transactionsToReturn = hasMore
          ? transactions.slice(0, limit)
          : transactions;

        return {
          transactions: transactionsToReturn.map((t) => ({
            id: t.id,
            amount: t.amount,
            type: t.type,
            description: t.description,
            referenceId: t.referenceId,
            referenceType: t.referenceType,
            createdAt: t.createdAt,
          })),
          total,
          hasMore,
        };
      })(),
      (): never => {
        throw new Error("Unexpected error getting points history");
      }
    );
  }

  /**
   * Get login streak info.
   */
  static getLoginStreak(userId: number): ResultAsync<LoginStreak, never> {
    return ResultAsync.fromPromise(
      (async () => {
        let streak = await gamificationRepository.getLoginStreak(userId);

        if (!streak) {
          streak = await gamificationRepository.createLoginStreak(userId);
        }

        const now = new Date();
        const today = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate()
        );

        let canClaimReward = true;

        if (streak.lastClaimedAt) {
          const lastClaimed = new Date(streak.lastClaimedAt);
          const lastClaimedDay = new Date(
            lastClaimed.getFullYear(),
            lastClaimed.getMonth(),
            lastClaimed.getDate()
          );

          // Already claimed today
          if (lastClaimedDay.getTime() === today.getTime()) {
            canClaimReward = false;
          }
        }

        return {
          currentStreak: streak.currentStreak,
          longestStreak: streak.longestStreak,
          lastLoginDate: streak.lastLoginDate,
          canClaimReward,
        };
      })(),
      (): never => {
        throw new Error("Unexpected error getting login streak");
      }
    );
  }

  /**
   * Claim daily login reward.
   */
  static claimDailyReward(
    userId: number
  ): ResultAsync<DailyRewardResult, GamificationError> {
    return ResultAsync.fromPromise(
      (async () => {
        let streak = await gamificationRepository.getLoginStreak(userId);

        if (!streak) {
          streak = await gamificationRepository.createLoginStreak(userId);
        }

        const now = new Date();
        const today = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate()
        );

        // Check if already claimed today
        if (streak.lastClaimedAt) {
          const lastClaimed = new Date(streak.lastClaimedAt);
          const lastClaimedDay = new Date(
            lastClaimed.getFullYear(),
            lastClaimed.getMonth(),
            lastClaimed.getDate()
          );

          if (lastClaimedDay.getTime() === today.getTime()) {
            return err({ type: "ALREADY_CLAIMED_TODAY" as const });
          }
        }

        // Calculate new streak
        let newStreak = 1;

        if (streak.lastLoginDate) {
          const lastLogin = new Date(streak.lastLoginDate);
          const yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 1);

          const lastLoginDay = new Date(
            lastLogin.getFullYear(),
            lastLogin.getMonth(),
            lastLogin.getDate()
          );

          // Consecutive day
          if (lastLoginDay.getTime() === yesterday.getTime()) {
            newStreak = streak.currentStreak + 1;
          }
          // Same day (shouldn't happen due to check above, but safety)
          else if (lastLoginDay.getTime() === today.getTime()) {
            newStreak = streak.currentStreak;
          }
          // Streak broken
          else {
            newStreak = 1;
          }
        }

        // Calculate bonus
        const bonus = Math.min(
          Math.floor(newStreak * GamificationService.STREAK_MULTIPLIER),
          GamificationService.MAX_STREAK_BONUS
        );

        const totalPoints = GamificationService.DAILY_LOGIN_BASE + bonus;

        // Update streak
        await gamificationRepository.updateLoginStreak(userId, {
          currentStreak: newStreak,
          longestStreak: Math.max(streak.longestStreak, newStreak),
          lastLoginDate: now,
          lastClaimedAt: now,
        });

        // Award points
        await GamificationService.awardPoints(
          userId,
          totalPoints,
          "daily_login",
          `Daily login reward (day ${newStreak})`
        );

        if (bonus > 0) {
          await GamificationService.awardPoints(
            userId,
            0, // Already included in total, just log separately for clarity
            "streak_bonus",
            `${newStreak}-day streak bonus`
          );
        }

        return ok({
          points: totalPoints,
          streak: newStreak,
          bonus,
          message: `Day ${newStreak} reward claimed! +${totalPoints} points`,
        });
      })(),
      () => ({ type: "USER_NOT_FOUND" as const })
    ).andThen((result) => result);
  }

  /**
   * Award points for winning a match.
   */
  static awardMatchWinPoints(
    userId: number,
    matchId: number,
    isRanked: boolean
  ): ResultAsync<PointsTransaction, GamificationError> {
    const points = isRanked
      ? GamificationService.POINTS_PER_RANKED_WIN
      : GamificationService.POINTS_PER_WIN;

    const description = isRanked ? "Ranked match victory" : "Match victory";

    return GamificationService.awardPoints(userId, points, "win", description, {
      id: matchId,
      type: "match",
    });
  }

  /**
   * Get all achievements with user's progress/unlock status.
   */
  static getAchievementsWithStatus(
    userId: number,
    includeSecret = false
  ): ResultAsync<AchievementWithStatus[], never> {
    return ResultAsync.fromPromise(
      (async () => {
        const allAchievements =
          await gamificationRepository.getAllAchievements(includeSecret);
        const userAchievements =
          await gamificationRepository.getUserAchievements(userId);
        const progressList =
          await gamificationRepository.getAllAchievementProgressForUser(userId);

        const unlockedMap = new Map<number, Date>();
        for (const ua of userAchievements) {
          unlockedMap.set(ua.achievementId, ua.unlockedAt);
        }

        const progressMap = new Map<number, number>();
        for (const p of progressList) {
          progressMap.set(p.achievementId, p.currentProgress);
        }

        return allAchievements.map((a) => ({
          id: a.id,
          code: a.code,
          name: a.name,
          description: a.description,
          icon: a.icon,
          points: a.points,
          category: a.category,
          targetProgress: a.targetProgress,
          isSecret: a.isSecret,
          unlocked: unlockedMap.has(a.id),
          unlockedAt: unlockedMap.get(a.id) ?? null,
          currentProgress: progressMap.get(a.id) ?? 0,
        }));
      })(),
      (): never => {
        throw new Error("Unexpected error getting achievements");
      }
    );
  }

  /**
   * Get user's unlocked achievements.
   */
  static getUserAchievements(
    userId: number
  ): ResultAsync<UserAchievement[], never> {
    return ResultAsync.fromPromise(
      (async () => {
        const achievements =
          await gamificationRepository.getUserAchievements(userId);

        return achievements.map((a) => ({
          id: a.id,
          achievementId: a.achievementId,
          code: a.code,
          name: a.name,
          description: a.description,
          icon: a.icon,
          points: a.points,
          category: a.category,
          unlockedAt: a.unlockedAt,
        }));
      })(),
      (): never => {
        throw new Error("Unexpected error getting user achievements");
      }
    );
  }

  /**
   * Check and unlock achievements based on context.
   * Returns newly unlocked achievements.
   */
  static checkAndUnlockAchievements(
    userId: number,
    context: {
      type: "match_complete" | "login" | "friend_added" | "rank_changed";
      matchResult?: {
        won: boolean;
        isAiGame: boolean;
        aiDifficulty?: string;
      };
      currentStreak?: number;
      newTier?: string;
      friendCount?: number;
      totalWins?: number;
      totalGames?: number;
    }
  ): ResultAsync<Achievement[], never> {
    return ResultAsync.fromPromise(
      (async () => {
        const unlockedAchievements: Achievement[] = [];

        // Get all achievements to check
        const allAchievements =
          await gamificationRepository.getAllAchievements(true);

        for (const achievement of allAchievements) {
          // Skip if already unlocked
          const hasIt = await gamificationRepository.hasAchievement(
            userId,
            achievement.id
          );
          if (hasIt) continue;

          let shouldUnlock = false;

          // Check based on achievement code
          switch (achievement.code) {
            case "first_win":
              if (
                context.type === "match_complete" &&
                context.matchResult?.won
              ) {
                shouldUnlock = true;
              }
              break;

            case "beat_ai_hard":
              if (
                context.type === "match_complete" &&
                context.matchResult?.won &&
                context.matchResult?.isAiGame &&
                context.matchResult?.aiDifficulty === "hard"
              ) {
                shouldUnlock = true;
              }
              break;

            case "reach_gold":
              if (
                context.type === "rank_changed" &&
                (context.newTier === "gold" || context.newTier === "platinum")
              ) {
                shouldUnlock = true;
              }
              break;

            case "reach_platinum":
              if (
                context.type === "rank_changed" &&
                context.newTier === "platinum"
              ) {
                shouldUnlock = true;
              }
              break;

            case "streak_7":
              if (
                context.type === "login" &&
                (context.currentStreak ?? 0) >= 7
              ) {
                shouldUnlock = true;
              }
              break;

            case "streak_30":
              if (
                context.type === "login" &&
                (context.currentStreak ?? 0) >= 30
              ) {
                shouldUnlock = true;
              }
              break;

            // Progressive achievements - update progress
            case "wins_10":
            case "wins_50":
            case "wins_100":
              if (
                context.type === "match_complete" &&
                context.matchResult?.won
              ) {
                const target =
                  achievement.code === "wins_10"
                    ? 10
                    : achievement.code === "wins_50"
                      ? 50
                      : 100;
                const wins = context.totalWins ?? 0;

                await gamificationRepository.upsertAchievementProgress(
                  userId,
                  achievement.id,
                  wins
                );

                if (wins >= target) {
                  shouldUnlock = true;
                }
              }
              break;

            case "games_100":
              if (context.type === "match_complete") {
                const games = context.totalGames ?? 0;

                await gamificationRepository.upsertAchievementProgress(
                  userId,
                  achievement.id,
                  games
                );

                if (games >= 100) {
                  shouldUnlock = true;
                }
              }
              break;
          }

          if (shouldUnlock) {
            await gamificationRepository.unlockAchievement(
              userId,
              achievement.id
            );

            // Award points for achievement
            await GamificationService.awardPoints(
              userId,
              achievement.points,
              "achievement",
              `Achievement unlocked: ${achievement.name}`,
              { id: achievement.id, type: "achievement" }
            );

            unlockedAchievements.push({
              id: achievement.id,
              code: achievement.code,
              name: achievement.name,
              description: achievement.description,
              icon: achievement.icon,
              points: achievement.points,
              category: achievement.category,
              targetProgress: achievement.targetProgress,
              isSecret: achievement.isSecret,
            });
          }
        }

        return unlockedAchievements;
      })(),
      (): never => {
        throw new Error("Unexpected error checking achievements");
      }
    );
  }

  /**
   * Get all achievement definitions.
   */
  static getAllAchievements(
    includeSecret = false
  ): ResultAsync<Achievement[], never> {
    return ResultAsync.fromPromise(
      (async () => {
        const achievements =
          await gamificationRepository.getAllAchievements(includeSecret);

        return achievements.map((a) => ({
          id: a.id,
          code: a.code,
          name: a.name,
          description: a.description,
          icon: a.icon,
          points: a.points,
          category: a.category,
          targetProgress: a.targetProgress,
          isSecret: a.isSecret,
        }));
      })(),
      (): never => {
        throw new Error("Unexpected error getting achievements");
      }
    );
  }
}

export { GamificationService };
