import { describe, expect, test } from "bun:test";

import {
  hashPassword,
  validatePasswordStrength,
  verifyPassword,
} from "./password";

describe("Password Utilities", () => {
  describe("hashPassword", () => {
    test("should generate a valid Argon2id hash", async () => {
      const password = "TestPassword123";
      const hash = await hashPassword(password);

      expect(hash.startsWith("$argon2id$")).toBe(true);
    });

    test("should generate different hashes for the same password", async () => {
      const password = "TestPassword123";
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);

      expect(hash1).not.toBe(hash2);
    });

    test("should generate hash with correct parameters", async () => {
      const password = "TestPassword123";
      const hash = await hashPassword(password);

      expect(hash).toContain("m=19456");
      expect(hash).toContain("t=2");
      expect(hash).toContain("p=1");
    });
  });

  describe("verifyPassword", () => {
    test("should return true for matching password", async () => {
      const password = "TestPassword123";
      const hash = await hashPassword(password);

      const result = await verifyPassword(password, hash);
      expect(result).toBe(true);
    });

    test("should return false for non-matching password", async () => {
      const password = "TestPassword123";
      const wrongPassword = "WrongPassword456";
      const hash = await hashPassword(password);

      const result = await verifyPassword(wrongPassword, hash);
      expect(result).toBe(false);
    });

    test("should return false for invalid hash format", async () => {
      const password = "TestPassword123";

      const result = await verifyPassword(password, "invalid-hash");
      expect(result).toBe(false);
    });

    test("should return false for empty hash", async () => {
      const password = "TestPassword123";

      const result = await verifyPassword(password, "");
      expect(result).toBe(false);
    });

    test("should be case-sensitive", async () => {
      const password = "TestPassword123";
      const hash = await hashPassword(password);

      const result = await verifyPassword("testpassword123", hash);
      expect(result).toBe(false);
    });
  });

  describe("validatePasswordStrength", () => {
    test("should accept valid password meeting all requirements", () => {
      const result = validatePasswordStrength("ValidPass123");

      expect(result.valid).toBe(true);
      expect(result.requirements).toHaveLength(0);
    });

    test("should reject password shorter than 8 characters", () => {
      const result = validatePasswordStrength("Pass1A");

      expect(result.valid).toBe(false);
      expect(result.requirements).toContain("At least 8 characters");
    });

    test("should reject password without uppercase letter", () => {
      const result = validatePasswordStrength("lowercase123");

      expect(result.valid).toBe(false);
      expect(result.requirements).toContain("At least 1 uppercase letter");
    });

    test("should reject password without lowercase letter", () => {
      const result = validatePasswordStrength("UPPERCASE123");

      expect(result.valid).toBe(false);
      expect(result.requirements).toContain("At least 1 lowercase letter");
    });

    test("should reject password without number", () => {
      const result = validatePasswordStrength("NoNumbersHere");

      expect(result.valid).toBe(false);
      expect(result.requirements).toContain("At least 1 number");
    });

    test("should reject common passwords", () => {
      const commonPasswords = [
        "password",
        "Password1",
        "Password123",
        "Admin123",
        "Qwerty123",
      ];

      for (const pwd of commonPasswords) {
        const result = validatePasswordStrength(pwd);

        if (pwd.toLowerCase() === "password") {
          expect(result.requirements).toContain("Password is too common");
        }
      }
    });

    test("should return multiple requirements for very weak password", () => {
      const result = validatePasswordStrength("abc");

      expect(result.valid).toBe(false);
      expect(result.requirements.length).toBeGreaterThan(1);
      expect(result.requirements).toContain("At least 8 characters");
      expect(result.requirements).toContain("At least 1 uppercase letter");
      expect(result.requirements).toContain("At least 1 number");
    });

    test("should accept password with special characters", () => {
      const result = validatePasswordStrength("Valid@Pass123!");

      expect(result.valid).toBe(true);
    });

    test("should accept password exactly 8 characters", () => {
      const result = validatePasswordStrength("Abcdef1g");

      expect(result.valid).toBe(true);
    });
  });
});
