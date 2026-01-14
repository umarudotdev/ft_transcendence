import { describe, expect, test } from "bun:test";

import { generateSecureToken, secureCompare } from "./crypto";

describe("Crypto Utilities", () => {
  describe("generateSecureToken", () => {
    test("should generate token with default length", () => {
      const token = generateSecureToken();

      expect(token.length).toBeGreaterThan(0);

      expect(token.length).toBe(43);
    });

    test("should generate token with custom length", () => {
      const token = generateSecureToken(16);

      expect(token.length).toBe(22);
    });

    test("should generate different tokens each time", () => {
      const token1 = generateSecureToken();
      const token2 = generateSecureToken();
      const token3 = generateSecureToken();

      expect(token1).not.toBe(token2);
      expect(token2).not.toBe(token3);
      expect(token1).not.toBe(token3);
    });

    test("should generate URL-safe tokens", () => {
      for (let i = 0; i < 100; i++) {
        const token = generateSecureToken();

        expect(token).not.toContain("+");
        expect(token).not.toContain("/");
        expect(token).not.toContain("=");

        expect(/^[A-Za-z0-9_-]+$/.test(token)).toBe(true);
      }
    });

    test("should generate tokens of consistent length for same input", () => {
      const tokens = Array.from({ length: 10 }, () => generateSecureToken(32));
      const lengths = new Set(tokens.map((t) => t.length));

      expect(lengths.size).toBe(1);
    });
  });

  describe("secureCompare", () => {
    test("should return true for equal strings", () => {
      const a = "test-token-12345";
      const b = "test-token-12345";

      expect(secureCompare(a, b)).toBe(true);
    });

    test("should return false for different strings of same length", () => {
      const a = "test-token-12345";
      const b = "test-token-12346";

      expect(secureCompare(a, b)).toBe(false);
    });

    test("should return false for strings of different lengths", () => {
      const a = "short";
      const b = "much-longer-string";

      expect(secureCompare(a, b)).toBe(false);
    });

    test("should return true for empty strings", () => {
      expect(secureCompare("", "")).toBe(true);
    });

    test("should return false when one string is empty", () => {
      expect(secureCompare("abc", "")).toBe(false);
      expect(secureCompare("", "abc")).toBe(false);
    });

    test("should handle special characters", () => {
      const a = "token!@#$%^&*()_+";
      const b = "token!@#$%^&*()_+";

      expect(secureCompare(a, b)).toBe(true);
    });

    test("should handle unicode characters", () => {
      const a = "token-émojis-😀-日本語";
      const b = "token-émojis-😀-日本語";

      expect(secureCompare(a, b)).toBe(true);
    });

    test("should be case-sensitive", () => {
      expect(secureCompare("ABC", "abc")).toBe(false);
      expect(secureCompare("Test", "test")).toBe(false);
    });

    test("should handle very long strings", () => {
      const longString = "a".repeat(10000);
      const sameLongString = "a".repeat(10000);
      const differentLongString = "a".repeat(9999) + "b";

      expect(secureCompare(longString, sameLongString)).toBe(true);
      expect(secureCompare(longString, differentLongString)).toBe(false);
    });
  });
});
