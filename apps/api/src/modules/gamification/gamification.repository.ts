import { and, count, desc, eq } from "drizzle-orm";

import { db } from "../../db";
import {
  type PointsTransactionType,
  achievementProgress,
  achievements,
  loginStreaks,
  pointsTransactions,
  userAchievements,
  userPoints,
} from "../../db/schema";

export const gamificationRepository = {
  // =========================================================================
  // User Points
  // =========================================================================

  async getUserPoints(userId: number) {
    return db.query.userPoints.findFirst({
      where: eq(userPoints.userId, userId),
    });
  },

  async createUserPoints(userId: number) {
    const [points] = await db
      .insert(userPoints)
      .values({
        userId,
        balance: 0,
        totalEarned: 0,
        totalSpent: 0,
      })
      .returning();

    return points;
  },

  async updateUserPoints(
    userId: number,
    data: {
      balance?: number;
      totalEarned?: number;
      totalSpent?: number;
    }
  ) {
    const [updated] = await db
      .update(userPoints)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(userPoints.userId, userId))
      .returning();

    return updated;
  },

  async addPointsTransaction(data: {
    userId: number;
    amount: number;
    type: PointsTransactionType;
    description: string;
    referenceId?: number;
    referenceType?: string;
  }) {
    const [transaction] = await db
      .insert(pointsTransactions)
      .values(data)
      .returning();

    return transaction;
  },

  async getPointsTransactions(
    userId: number,
    options: { limit?: number; offset?: number; type?: string } = {}
  ) {
    const { limit = 20, offset = 0, type } = options;

    const conditions = [eq(pointsTransactions.userId, userId)];
    if (type) {
      conditions.push(eq(pointsTransactions.type, type));
    }

    return db.query.pointsTransactions.findMany({
      where: and(...conditions),
      orderBy: [desc(pointsTransactions.createdAt)],
      limit,
      offset,
    });
  },

  async getPointsTransactionsCount(userId: number, type?: string) {
    const conditions = [eq(pointsTransactions.userId, userId)];
    if (type) {
      conditions.push(eq(pointsTransactions.type, type));
    }

    const [result] = await db
      .select({ count: count() })
      .from(pointsTransactions)
      .where(and(...conditions));

    return result?.count ?? 0;
  },

  // =========================================================================
  // Login Streaks
  // =========================================================================

  async getLoginStreak(userId: number) {
    return db.query.loginStreaks.findFirst({
      where: eq(loginStreaks.userId, userId),
    });
  },

  async createLoginStreak(userId: number) {
    const [streak] = await db
      .insert(loginStreaks)
      .values({
        userId,
        currentStreak: 0,
        longestStreak: 0,
      })
      .returning();

    return streak;
  },

  async updateLoginStreak(
    userId: number,
    data: {
      currentStreak?: number;
      longestStreak?: number;
      lastLoginDate?: Date;
      lastClaimedAt?: Date;
    }
  ) {
    const [updated] = await db
      .update(loginStreaks)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(loginStreaks.userId, userId))
      .returning();

    return updated;
  },

  // =========================================================================
  // Achievements
  // =========================================================================

  async getAllAchievements(includeSecret = false) {
    if (includeSecret) {
      return db.query.achievements.findMany();
    }

    return db.query.achievements.findMany({
      where: eq(achievements.isSecret, false),
    });
  },

  async getAchievementById(achievementId: number) {
    return db.query.achievements.findFirst({
      where: eq(achievements.id, achievementId),
    });
  },

  async getAchievementByCode(code: string) {
    return db.query.achievements.findFirst({
      where: eq(achievements.code, code),
    });
  },

  async getUserAchievements(userId: number) {
    return db
      .select({
        id: userAchievements.id,
        achievementId: userAchievements.achievementId,
        unlockedAt: userAchievements.unlockedAt,
        code: achievements.code,
        name: achievements.name,
        description: achievements.description,
        icon: achievements.icon,
        points: achievements.points,
        category: achievements.category,
      })
      .from(userAchievements)
      .innerJoin(
        achievements,
        eq(userAchievements.achievementId, achievements.id)
      )
      .where(eq(userAchievements.userId, userId))
      .orderBy(desc(userAchievements.unlockedAt));
  },

  async hasAchievement(userId: number, achievementId: number) {
    const result = await db.query.userAchievements.findFirst({
      where: and(
        eq(userAchievements.userId, userId),
        eq(userAchievements.achievementId, achievementId)
      ),
    });

    return !!result;
  },

  async unlockAchievement(userId: number, achievementId: number) {
    const [unlocked] = await db
      .insert(userAchievements)
      .values({
        userId,
        achievementId,
      })
      .returning();

    return unlocked;
  },

  async getAchievementProgress(userId: number, achievementId: number) {
    return db.query.achievementProgress.findFirst({
      where: and(
        eq(achievementProgress.userId, userId),
        eq(achievementProgress.achievementId, achievementId)
      ),
    });
  },

  async upsertAchievementProgress(
    userId: number,
    achievementId: number,
    currentProgress: number
  ) {
    const existing = await this.getAchievementProgress(userId, achievementId);

    if (existing) {
      const [updated] = await db
        .update(achievementProgress)
        .set({
          currentProgress,
          updatedAt: new Date(),
        })
        .where(eq(achievementProgress.id, existing.id))
        .returning();

      return updated;
    }

    const [created] = await db
      .insert(achievementProgress)
      .values({
        userId,
        achievementId,
        currentProgress,
      })
      .returning();

    return created;
  },

  async getAllAchievementProgressForUser(userId: number) {
    return db.query.achievementProgress.findMany({
      where: eq(achievementProgress.userId, userId),
    });
  },

  async createAchievement(data: {
    code: string;
    name: string;
    description: string;
    icon?: string;
    points: number;
    category: string;
    targetProgress?: number;
    isSecret?: boolean;
  }) {
    const [achievement] = await db
      .insert(achievements)
      .values({
        code: data.code,
        name: data.name,
        description: data.description,
        icon: data.icon,
        points: data.points,
        category: data.category,
        targetProgress: data.targetProgress ?? 1,
        isSecret: data.isSecret ?? false,
      })
      .returning();

    return achievement;
  },

  async getUserAchievementCount(userId: number) {
    const [result] = await db
      .select({ count: count() })
      .from(userAchievements)
      .where(eq(userAchievements.userId, userId));

    return result?.count ?? 0;
  },
};
