import { describe, expect, test } from "bun:test";

import { RankingsService } from "./rankings.service";

describe("RankingsService", () => {
  describe("getTierFromRating", () => {
    test("returns bronze for ratings below 800", () => {
      expect(RankingsService.getTierFromRating(0)).toBe("bronze");
      expect(RankingsService.getTierFromRating(500)).toBe("bronze");
      expect(RankingsService.getTierFromRating(799)).toBe("bronze");
    });

    test("returns silver for ratings 800-1199", () => {
      expect(RankingsService.getTierFromRating(800)).toBe("silver");
      expect(RankingsService.getTierFromRating(1000)).toBe("silver");
      expect(RankingsService.getTierFromRating(1199)).toBe("silver");
    });

    test("returns gold for ratings 1200-1599", () => {
      expect(RankingsService.getTierFromRating(1200)).toBe("gold");
      expect(RankingsService.getTierFromRating(1400)).toBe("gold");
      expect(RankingsService.getTierFromRating(1599)).toBe("gold");
    });

    test("returns platinum for ratings 1600+", () => {
      expect(RankingsService.getTierFromRating(1600)).toBe("platinum");
      expect(RankingsService.getTierFromRating(2000)).toBe("platinum");
      expect(RankingsService.getTierFromRating(3000)).toBe("platinum");
    });

    test("handles exact tier boundary values correctly", () => {
      // Just below boundary
      expect(RankingsService.getTierFromRating(799)).toBe("bronze");
      expect(RankingsService.getTierFromRating(1199)).toBe("silver");
      expect(RankingsService.getTierFromRating(1599)).toBe("gold");

      // Exactly at boundary
      expect(RankingsService.getTierFromRating(800)).toBe("silver");
      expect(RankingsService.getTierFromRating(1200)).toBe("gold");
      expect(RankingsService.getTierFromRating(1600)).toBe("platinum");
    });
  });

  describe("calculateEloChange", () => {
    describe("equal ratings", () => {
      test("winner gains +16 points against equal opponent", () => {
        const change = RankingsService.calculateEloChange(1000, 1000, true);
        expect(change).toBe(16);
      });

      test("loser loses -16 points against equal opponent", () => {
        const change = RankingsService.calculateEloChange(1000, 1000, false);
        expect(change).toBe(-16);
      });
    });

    describe("higher-rated player wins (expected outcome)", () => {
      test("gains fewer points when expected to win", () => {
        // 1400 vs 1000: higher rated player expected to win
        const change = RankingsService.calculateEloChange(1400, 1000, true);
        // Expected score ~0.91, actual 1, so small gain
        expect(change).toBeGreaterThan(0);
        expect(change).toBeLessThan(16);
      });

      test("lower-rated player loses fewer points when expected to lose", () => {
        const change = RankingsService.calculateEloChange(1000, 1400, false);
        // Expected score ~0.09, actual 0, so small loss
        expect(change).toBeLessThan(0);
        expect(change).toBeGreaterThan(-16);
      });
    });

    describe("upset victories", () => {
      test("lower-rated player gains more points for upset win", () => {
        // 1000 vs 1400: lower rated player wins (upset)
        const change = RankingsService.calculateEloChange(1000, 1400, true);
        // Expected score ~0.09, actual 1, so large gain
        expect(change).toBeGreaterThan(16);
        expect(change).toBeLessThan(32);
      });

      test("higher-rated player loses more points for upset loss", () => {
        const change = RankingsService.calculateEloChange(1400, 1000, false);
        // Expected score ~0.91, actual 0, so large loss
        expect(change).toBeLessThan(-16);
        expect(change).toBeGreaterThan(-32);
      });
    });

    describe("extreme rating differences", () => {
      test("near-certain favorite gains minimal or zero points for win", () => {
        const change = RankingsService.calculateEloChange(2000, 1000, true);
        // Expected score ~0.997, actual 1, minimal gain (rounds to 0 or 1)
        expect(change).toBeGreaterThanOrEqual(0);
        expect(change).toBeLessThan(5);
      });

      test("massive underdog gains near-maximum points for upset", () => {
        const change = RankingsService.calculateEloChange(1000, 2000, true);
        // Expected score ~0.003, actual 1, massive gain
        expect(change).toBeGreaterThan(28);
        expect(change).toBeLessThanOrEqual(32);
      });
    });

    describe("rating changes are symmetric", () => {
      test("winner's gain equals loser's loss for equal ratings", () => {
        const winnerChange = RankingsService.calculateEloChange(
          1000,
          1000,
          true
        );
        const loserChange = RankingsService.calculateEloChange(
          1000,
          1000,
          false
        );
        expect(winnerChange).toBe(-loserChange);
      });

      test("total rating change sums to zero in a match", () => {
        const player1Change = RankingsService.calculateEloChange(
          1200,
          1000,
          true
        );
        const player2Change = RankingsService.calculateEloChange(
          1000,
          1200,
          false
        );
        expect(player1Change + player2Change).toBe(0);
      });
    });

    describe("K-factor validation", () => {
      test("maximum possible gain is K_FACTOR (32)", () => {
        // Most extreme case: massive underdog beats massive favorite
        const change = RankingsService.calculateEloChange(0, 3000, true);
        expect(change).toBeLessThanOrEqual(32);
      });

      test("maximum possible loss is K_FACTOR (32)", () => {
        // Most extreme case: massive favorite loses to massive underdog
        const change = RankingsService.calculateEloChange(3000, 0, false);
        expect(change).toBeGreaterThanOrEqual(-32);
      });
    });
  });
});
