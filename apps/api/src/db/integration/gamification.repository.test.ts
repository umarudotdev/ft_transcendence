/**
 * Integration tests for gamification system (points, achievements, rankings).
 *
 * Run tests: bun test src/db/integration/
 */

import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  test,
} from "bun:test";
import { desc, eq, sql } from "drizzle-orm";

import * as schema from "../schema";
import {
  cleanDatabase,
  createTestDb,
  createTestUser,
  resetSequences,
} from "../test-utils";

describe("Gamification Repository Integration Tests", () => {
  const { db, close } = createTestDb();

  beforeAll(async () => {
    await cleanDatabase(db);
    await resetSequences(db);
  });

  afterEach(async () => {
    await cleanDatabase(db);
    await resetSequences(db);
  });

  afterAll(async () => {
    await close();
  });

  describe("User Points", () => {
    test("creates user points record", async () => {
      const user = await createTestUser(db);

      const [points] = await db
        .insert(schema.userPoints)
        .values({
          userId: user.id,
          balance: 100,
          totalEarned: 100,
          totalSpent: 0,
        })
        .returning();

      expect(points.userId).toBe(user.id);
      expect(points.balance).toBe(100);
    });

    test("enforces unique userId constraint", async () => {
      const user = await createTestUser(db);

      await db.insert(schema.userPoints).values({ userId: user.id });

      await expect(
        db.insert(schema.userPoints).values({ userId: user.id })
      ).rejects.toThrow();
    });

    test("updates balance correctly", async () => {
      const user = await createTestUser(db);

      await db.insert(schema.userPoints).values({
        userId: user.id,
        balance: 100,
        totalEarned: 100,
      });

      const [updated] = await db
        .update(schema.userPoints)
        .set({
          balance: sql`${schema.userPoints.balance} + 50`,
          totalEarned: sql`${schema.userPoints.totalEarned} + 50`,
        })
        .where(eq(schema.userPoints.userId, user.id))
        .returning();

      expect(updated.balance).toBe(150);
      expect(updated.totalEarned).toBe(150);
    });

    test("tracks spending", async () => {
      const user = await createTestUser(db);

      await db.insert(schema.userPoints).values({
        userId: user.id,
        balance: 100,
        totalEarned: 100,
        totalSpent: 0,
      });

      const [updated] = await db
        .update(schema.userPoints)
        .set({
          balance: sql`${schema.userPoints.balance} - 30`,
          totalSpent: sql`${schema.userPoints.totalSpent} + 30`,
        })
        .where(eq(schema.userPoints.userId, user.id))
        .returning();

      expect(updated.balance).toBe(70);
      expect(updated.totalSpent).toBe(30);
    });
  });

  describe("Points Transactions", () => {
    test("records a points transaction", async () => {
      const user = await createTestUser(db);

      const [tx] = await db
        .insert(schema.pointsTransactions)
        .values({
          userId: user.id,
          amount: 50,
          type: "win",
          description: "Won a match",
        })
        .returning();

      expect(tx.amount).toBe(50);
      expect(tx.type).toBe("win");
    });

    test("records transaction with reference", async () => {
      const user = await createTestUser(db);

      const [tx] = await db
        .insert(schema.pointsTransactions)
        .values({
          userId: user.id,
          amount: 100,
          type: "achievement",
          description: "Unlocked First Win achievement",
          referenceId: 1,
          referenceType: "achievement",
        })
        .returning();

      expect(tx.referenceId).toBe(1);
      expect(tx.referenceType).toBe("achievement");
    });

    test("retrieves transaction history", async () => {
      const user = await createTestUser(db);

      await db.insert(schema.pointsTransactions).values([
        {
          userId: user.id,
          amount: 10,
          type: "daily_login",
          description: "Daily login",
        },
        { userId: user.id, amount: 50, type: "win", description: "Match win" },
        {
          userId: user.id,
          amount: -20,
          type: "purchase",
          description: "Bought item",
        },
      ]);

      const transactions = await db.query.pointsTransactions.findMany({
        where: eq(schema.pointsTransactions.userId, user.id),
        orderBy: [desc(schema.pointsTransactions.createdAt)],
      });

      expect(transactions.length).toBe(3);
    });
  });

  describe("Login Streaks", () => {
    test("creates login streak record", async () => {
      const user = await createTestUser(db);

      const [streak] = await db
        .insert(schema.loginStreaks)
        .values({
          userId: user.id,
          currentStreak: 1,
          longestStreak: 1,
          lastLoginDate: new Date(),
        })
        .returning();

      expect(streak.currentStreak).toBe(1);
    });

    test("increments streak", async () => {
      const user = await createTestUser(db);

      await db.insert(schema.loginStreaks).values({
        userId: user.id,
        currentStreak: 5,
        longestStreak: 5,
      });

      const [updated] = await db
        .update(schema.loginStreaks)
        .set({
          currentStreak: sql`${schema.loginStreaks.currentStreak} + 1`,
          longestStreak: sql`GREATEST(${schema.loginStreaks.longestStreak}, ${schema.loginStreaks.currentStreak} + 1)`,
          lastLoginDate: new Date(),
        })
        .where(eq(schema.loginStreaks.userId, user.id))
        .returning();

      expect(updated.currentStreak).toBe(6);
      expect(updated.longestStreak).toBe(6);
    });

    test("resets streak", async () => {
      const user = await createTestUser(db);

      await db.insert(schema.loginStreaks).values({
        userId: user.id,
        currentStreak: 10,
        longestStreak: 15,
      });

      const [updated] = await db
        .update(schema.loginStreaks)
        .set({
          currentStreak: 1,
          lastLoginDate: new Date(),
        })
        .where(eq(schema.loginStreaks.userId, user.id))
        .returning();

      expect(updated.currentStreak).toBe(1);
      expect(updated.longestStreak).toBe(15); // Longest preserved
    });
  });

  describe("Achievements", () => {
    test("creates an achievement definition", async () => {
      const [achievement] = await db
        .insert(schema.achievements)
        .values({
          code: "FIRST_WIN",
          name: "First Victory",
          description: "Win your first match",
          category: "gameplay",
          points: 50,
          targetProgress: 1,
        })
        .returning();

      expect(achievement.code).toBe("FIRST_WIN");
      expect(achievement.points).toBe(50);
    });

    test("creates secret achievement", async () => {
      const [achievement] = await db
        .insert(schema.achievements)
        .values({
          code: "SECRET_MASTER",
          name: "???",
          description: "???",
          category: "milestone",
          isSecret: true,
          points: 500,
        })
        .returning();

      expect(achievement.isSecret).toBe(true);
    });

    test("unlocks achievement for user", async () => {
      const user = await createTestUser(db);
      const [achievement] = await db
        .insert(schema.achievements)
        .values({
          code: "TEST_ACH",
          name: "Test",
          description: "Test achievement",
          category: "gameplay",
        })
        .returning();

      const [unlocked] = await db
        .insert(schema.userAchievements)
        .values({
          userId: user.id,
          achievementId: achievement.id,
        })
        .returning();

      expect(unlocked.userId).toBe(user.id);
      expect(unlocked.achievementId).toBe(achievement.id);
      expect(unlocked.unlockedAt).toBeInstanceOf(Date);
    });

    test("enforces unique user-achievement constraint", async () => {
      const user = await createTestUser(db);
      const [achievement] = await db
        .insert(schema.achievements)
        .values({
          code: "UNIQUE_TEST",
          name: "Unique",
          description: "Test",
          category: "gameplay",
        })
        .returning();

      await db.insert(schema.userAchievements).values({
        userId: user.id,
        achievementId: achievement.id,
      });

      // Should fail on duplicate
      await expect(
        db.insert(schema.userAchievements).values({
          userId: user.id,
          achievementId: achievement.id,
        })
      ).rejects.toThrow();
    });

    test("tracks achievement progress", async () => {
      const user = await createTestUser(db);
      const [achievement] = await db
        .insert(schema.achievements)
        .values({
          code: "WIN_10",
          name: "Decathlon",
          description: "Win 10 matches",
          category: "gameplay",
          targetProgress: 10,
        })
        .returning();

      const [progress] = await db
        .insert(schema.achievementProgress)
        .values({
          userId: user.id,
          achievementId: achievement.id,
          currentProgress: 3,
        })
        .returning();

      expect(progress.currentProgress).toBe(3);

      // Update progress
      const [updated] = await db
        .update(schema.achievementProgress)
        .set({
          currentProgress: sql`${schema.achievementProgress.currentProgress} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(schema.achievementProgress.id, progress.id))
        .returning();

      expect(updated.currentProgress).toBe(4);
    });

    test("retrieves user achievements with details", async () => {
      const user = await createTestUser(db);

      const [ach1] = await db
        .insert(schema.achievements)
        .values({
          code: "ACH1",
          name: "First",
          description: "Desc",
          category: "gameplay",
        })
        .returning();
      const [ach2] = await db
        .insert(schema.achievements)
        .values({
          code: "ACH2",
          name: "Second",
          description: "Desc",
          category: "social",
        })
        .returning();

      await db.insert(schema.userAchievements).values([
        { userId: user.id, achievementId: ach1.id },
        { userId: user.id, achievementId: ach2.id },
      ]);

      const userAchievements = await db.query.userAchievements.findMany({
        where: eq(schema.userAchievements.userId, user.id),
        with: {
          achievement: true,
        },
      });

      expect(userAchievements.length).toBe(2);
      expect(userAchievements[0].achievement.name).toBeDefined();
    });
  });

  describe("Player Ratings", () => {
    test("creates player rating", async () => {
      const user = await createTestUser(db);

      const [rating] = await db
        .insert(schema.playerRatings)
        .values({
          userId: user.id,
          rating: 1200,
          peakRating: 1200,
          tier: "silver",
        })
        .returning();

      expect(rating.rating).toBe(1200);
      expect(rating.tier).toBe("silver");
    });

    test("updates rating after match", async () => {
      const user = await createTestUser(db);

      await db.insert(schema.playerRatings).values({
        userId: user.id,
        rating: 1000,
        peakRating: 1000,
      });

      const newRating = 1025;
      const [updated] = await db
        .update(schema.playerRatings)
        .set({
          rating: newRating,
          peakRating: sql`GREATEST(${schema.playerRatings.peakRating}, ${newRating})`,
          gamesRated: sql`${schema.playerRatings.gamesRated} + 1`,
          lastActivityAt: new Date(),
        })
        .where(eq(schema.playerRatings.userId, user.id))
        .returning();

      expect(updated.rating).toBe(1025);
      expect(updated.peakRating).toBe(1025);
      expect(updated.gamesRated).toBe(1);
    });

    test("retrieves leaderboard", async () => {
      const users = await Promise.all([
        createTestUser(db, { username: "user1" }),
        createTestUser(db, { username: "user2" }),
        createTestUser(db, { username: "user3" }),
      ]);

      await db.insert(schema.playerRatings).values([
        { userId: users[0].id, rating: 1500, peakRating: 1500 },
        { userId: users[1].id, rating: 1200, peakRating: 1300 },
        { userId: users[2].id, rating: 1800, peakRating: 1800 },
      ]);

      const leaderboard = await db.query.playerRatings.findMany({
        orderBy: [desc(schema.playerRatings.rating)],
        limit: 10,
        with: {
          user: { columns: { id: true, displayName: true, username: true } },
        },
      });

      expect(leaderboard[0].rating).toBe(1800);
      expect(leaderboard[1].rating).toBe(1500);
      expect(leaderboard[2].rating).toBe(1200);
    });
  });

  describe("Seasons", () => {
    test("creates a season", async () => {
      const [season] = await db
        .insert(schema.seasons)
        .values({
          name: "Season 1",
          startDate: new Date("2025-01-01"),
          endDate: new Date("2025-03-31"),
          isActive: true,
        })
        .returning();

      expect(season.name).toBe("Season 1");
      expect(season.isActive).toBe(true);
    });

    test("records season ranking", async () => {
      const user = await createTestUser(db);
      const [season] = await db
        .insert(schema.seasons)
        .values({
          name: "Test Season",
          startDate: new Date(),
          endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        })
        .returning();

      const [ranking] = await db
        .insert(schema.seasonRankings)
        .values({
          userId: user.id,
          seasonId: season.id,
          finalRating: 1500,
          finalRank: 1,
          tier: "gold",
          gamesPlayed: 50,
        })
        .returning();

      expect(ranking.finalRank).toBe(1);
      expect(ranking.tier).toBe("gold");
    });
  });
});
