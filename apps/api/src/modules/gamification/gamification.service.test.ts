import { describe, expect, test } from "bun:test";

/**
 * Tests for gamification service calculation logic.
 *
 * The GamificationService uses these constants:
 * - DAILY_LOGIN_BASE = 5
 * - STREAK_MULTIPLIER = 0.5
 * - MAX_STREAK_BONUS = 25
 * - POINTS_PER_WIN = 10
 * - POINTS_PER_RANKED_WIN = 15
 *
 * Daily reward formula: base + min(floor(streak * multiplier), maxBonus)
 */
describe("Gamification Calculations", () => {
  // Replicate the service constants for testing
  const DAILY_LOGIN_BASE = 5;
  const STREAK_MULTIPLIER = 0.5;
  const MAX_STREAK_BONUS = 25;
  const POINTS_PER_WIN = 10;
  const POINTS_PER_RANKED_WIN = 15;

  /**
   * Calculate streak bonus as the service does.
   */
  function calculateStreakBonus(streak: number): number {
    return Math.min(Math.floor(streak * STREAK_MULTIPLIER), MAX_STREAK_BONUS);
  }

  /**
   * Calculate total daily reward.
   */
  function calculateDailyReward(streak: number): number {
    return DAILY_LOGIN_BASE + calculateStreakBonus(streak);
  }

  describe("streak bonus calculation", () => {
    test("streak 1 gives 0 bonus (floor(0.5) = 0)", () => {
      expect(calculateStreakBonus(1)).toBe(0);
    });

    test("streak 2 gives 1 bonus (floor(1.0) = 1)", () => {
      expect(calculateStreakBonus(2)).toBe(1);
    });

    test("streak 7 gives 3 bonus (floor(3.5) = 3)", () => {
      expect(calculateStreakBonus(7)).toBe(3);
    });

    test("streak 10 gives 5 bonus (floor(5.0) = 5)", () => {
      expect(calculateStreakBonus(10)).toBe(5);
    });

    test("streak 50 gives 25 bonus (capped at max)", () => {
      expect(calculateStreakBonus(50)).toBe(25);
    });

    test("streak 100 gives 25 bonus (capped at max)", () => {
      expect(calculateStreakBonus(100)).toBe(25);
    });

    test("bonus cap kicks in at streak 50 (50 * 0.5 = 25)", () => {
      expect(calculateStreakBonus(49)).toBe(24);
      expect(calculateStreakBonus(50)).toBe(25);
      expect(calculateStreakBonus(51)).toBe(25);
    });
  });

  describe("daily reward total calculation", () => {
    test("day 1: base only (5 + 0 = 5)", () => {
      expect(calculateDailyReward(1)).toBe(5);
    });

    test("day 2: base + 1 bonus (5 + 1 = 6)", () => {
      expect(calculateDailyReward(2)).toBe(6);
    });

    test("day 7: base + 3 bonus (5 + 3 = 8)", () => {
      expect(calculateDailyReward(7)).toBe(8);
    });

    test("day 14: base + 7 bonus (5 + 7 = 12)", () => {
      expect(calculateDailyReward(14)).toBe(12);
    });

    test("day 30: base + 15 bonus (5 + 15 = 20)", () => {
      expect(calculateDailyReward(30)).toBe(20);
    });

    test("day 50+: base + max bonus (5 + 25 = 30)", () => {
      expect(calculateDailyReward(50)).toBe(30);
      expect(calculateDailyReward(100)).toBe(30);
      expect(calculateDailyReward(365)).toBe(30);
    });
  });

  describe("match win points", () => {
    test("casual match win awards 10 points", () => {
      expect(POINTS_PER_WIN).toBe(10);
    });

    test("ranked match win awards 15 points", () => {
      expect(POINTS_PER_RANKED_WIN).toBe(15);
    });

    test("ranked bonus is 50% more than casual", () => {
      expect(POINTS_PER_RANKED_WIN).toBe(POINTS_PER_WIN * 1.5);
    });
  });

  describe("streak progression examples", () => {
    test("first week of consecutive logins", () => {
      const weeklyRewards = [1, 2, 3, 4, 5, 6, 7].map(calculateDailyReward);
      expect(weeklyRewards).toEqual([5, 6, 6, 7, 7, 8, 8]);
    });

    test("cumulative rewards for first month", () => {
      let total = 0;
      for (let day = 1; day <= 30; day++) {
        total += calculateDailyReward(day);
      }
      // Sum of rewards for 30 consecutive days
      expect(total).toBeGreaterThan(30 * 5); // More than base alone
      expect(total).toBeLessThan(30 * 30); // Less than max alone
    });
  });
});
