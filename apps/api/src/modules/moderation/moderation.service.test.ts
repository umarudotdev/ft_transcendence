import { describe, expect, test } from "bun:test";

/**
 * Tests for moderation service calculation logic.
 *
 * The ModerationService uses these rules for sanction expiration:
 * - If type !== "ban" AND duration is provided: expiresAt = NOW + duration hours
 * - If type === "ban": expiresAt is always null (permanent ban)
 * - If type !== "ban" AND no duration: expiresAt is undefined
 *
 * These tests verify the expiration calculation logic.
 */
describe("Moderation Sanction Expiration Logic", () => {
  /**
   * Calculate expiration date as the service does.
   */
  function calculateExpiresAt(
    type: "warning" | "timeout" | "ban",
    durationHours?: number,
    baseTime = new Date()
  ): Date | undefined {
    // Ban sanctions never expire
    if (type === "ban") {
      return undefined;
    }

    // No duration means no expiration
    if (!durationHours) {
      return undefined;
    }

    // Calculate expiration
    const expiresAt = new Date(baseTime);
    expiresAt.setHours(expiresAt.getHours() + durationHours);
    return expiresAt;
  }

  describe("ban sanctions", () => {
    test("ban with duration still has no expiration", () => {
      expect(calculateExpiresAt("ban", 24)).toBeUndefined();
    });

    test("ban without duration has no expiration", () => {
      expect(calculateExpiresAt("ban")).toBeUndefined();
    });

    test("ban with very long duration still has no expiration", () => {
      expect(calculateExpiresAt("ban", 8760)).toBeUndefined(); // 1 year
    });
  });

  describe("timeout sanctions", () => {
    test("timeout with 1 hour duration expires in 1 hour", () => {
      const now = new Date("2025-01-15T12:00:00Z");
      const expires = calculateExpiresAt("timeout", 1, now);
      expect(expires?.toISOString()).toBe("2025-01-15T13:00:00.000Z");
    });

    test("timeout with 24 hours duration expires in 24 hours", () => {
      const now = new Date("2025-01-15T12:00:00Z");
      const expires = calculateExpiresAt("timeout", 24, now);
      expect(expires?.toISOString()).toBe("2025-01-16T12:00:00.000Z");
    });

    test("timeout with 168 hours (1 week) duration", () => {
      const now = new Date("2025-01-15T12:00:00Z");
      const expires = calculateExpiresAt("timeout", 168, now);
      expect(expires?.toISOString()).toBe("2025-01-22T12:00:00.000Z");
    });

    test("timeout without duration has no expiration", () => {
      expect(calculateExpiresAt("timeout")).toBeUndefined();
    });
  });

  describe("warning sanctions", () => {
    test("warning with duration has expiration", () => {
      const now = new Date("2025-01-15T12:00:00Z");
      const expires = calculateExpiresAt("warning", 720, now); // 30 days
      expect(expires?.toISOString()).toBe("2025-02-14T12:00:00.000Z");
    });

    test("warning without duration has no expiration", () => {
      expect(calculateExpiresAt("warning")).toBeUndefined();
    });
  });

  describe("sanction status determination", () => {
    /**
     * Check if a sanction is currently active.
     */
    function isSanctionActive(
      isActive: boolean,
      expiresAt: Date | null,
      now = new Date()
    ): boolean {
      if (!isActive) return false;
      if (expiresAt === null) return true; // Permanent
      return expiresAt > now;
    }

    test("active sanction with no expiration is active", () => {
      expect(isSanctionActive(true, null)).toBe(true);
    });

    test("inactive sanction is not active regardless of expiration", () => {
      expect(isSanctionActive(false, null)).toBe(false);
      expect(isSanctionActive(false, new Date("2099-01-01"))).toBe(false);
    });

    test("active sanction with future expiration is active", () => {
      const future = new Date();
      future.setHours(future.getHours() + 1);
      expect(isSanctionActive(true, future)).toBe(true);
    });

    test("active sanction with past expiration is not active", () => {
      const past = new Date();
      past.setHours(past.getHours() - 1);
      expect(isSanctionActive(true, past)).toBe(false);
    });

    test("sanction expiring exactly now is not active", () => {
      const now = new Date();
      expect(isSanctionActive(true, now, now)).toBe(false);
    });
  });

  describe("sanction status aggregation", () => {
    /**
     * Determine overall sanction status from multiple sanctions.
     */
    function getSanctionStatus(
      sanctions: Array<{
        type: string;
        isActive: boolean;
        expiresAt: Date | null;
      }>,
      now = new Date()
    ): {
      isBanned: boolean;
      isTimedOut: boolean;
      activeUntil: Date | null;
      activeSanctions: number;
    } {
      const activeSanctions = sanctions.filter((s) => {
        if (!s.isActive) return false;
        if (s.expiresAt === null) return true;
        return s.expiresAt > now;
      });

      const isBanned = activeSanctions.some((s) => s.type === "ban");
      const timeouts = activeSanctions.filter((s) => s.type === "timeout");
      const isTimedOut = timeouts.length > 0;

      // Find the latest timeout expiration
      let activeUntil: Date | null = null;
      if (isTimedOut) {
        for (const timeout of timeouts) {
          if (timeout.expiresAt === null) {
            activeUntil = null;
            break;
          }
          if (activeUntil === null || timeout.expiresAt > activeUntil) {
            activeUntil = timeout.expiresAt;
          }
        }
      }

      return {
        isBanned,
        isTimedOut,
        activeUntil,
        activeSanctions: activeSanctions.length,
      };
    }

    test("no sanctions means clean status", () => {
      const status = getSanctionStatus([]);
      expect(status.isBanned).toBe(false);
      expect(status.isTimedOut).toBe(false);
      expect(status.activeUntil).toBeNull();
      expect(status.activeSanctions).toBe(0);
    });

    test("active ban sets isBanned to true", () => {
      const status = getSanctionStatus([
        { type: "ban", isActive: true, expiresAt: null },
      ]);
      expect(status.isBanned).toBe(true);
      expect(status.activeSanctions).toBe(1);
    });

    test("revoked ban does not set isBanned", () => {
      const status = getSanctionStatus([
        { type: "ban", isActive: false, expiresAt: null },
      ]);
      expect(status.isBanned).toBe(false);
      expect(status.activeSanctions).toBe(0);
    });

    test("active timeout sets isTimedOut and activeUntil", () => {
      const future = new Date("2025-01-20T12:00:00Z");
      const status = getSanctionStatus(
        [{ type: "timeout", isActive: true, expiresAt: future }],
        new Date("2025-01-15T12:00:00Z")
      );
      expect(status.isTimedOut).toBe(true);
      expect(status.activeUntil?.toISOString()).toBe(future.toISOString());
    });

    test("expired timeout does not set isTimedOut", () => {
      const past = new Date("2025-01-10T12:00:00Z");
      const status = getSanctionStatus(
        [{ type: "timeout", isActive: true, expiresAt: past }],
        new Date("2025-01-15T12:00:00Z")
      );
      expect(status.isTimedOut).toBe(false);
      expect(status.activeSanctions).toBe(0);
    });

    test("multiple timeouts uses latest expiration", () => {
      const earlier = new Date("2025-01-18T12:00:00Z");
      const later = new Date("2025-01-20T12:00:00Z");
      const status = getSanctionStatus(
        [
          { type: "timeout", isActive: true, expiresAt: earlier },
          { type: "timeout", isActive: true, expiresAt: later },
        ],
        new Date("2025-01-15T12:00:00Z")
      );
      expect(status.isTimedOut).toBe(true);
      expect(status.activeUntil?.toISOString()).toBe(later.toISOString());
      expect(status.activeSanctions).toBe(2);
    });

    test("warning does not affect isBanned or isTimedOut", () => {
      const status = getSanctionStatus([
        { type: "warning", isActive: true, expiresAt: null },
      ]);
      expect(status.isBanned).toBe(false);
      expect(status.isTimedOut).toBe(false);
      expect(status.activeSanctions).toBe(1);
    });
  });
});
