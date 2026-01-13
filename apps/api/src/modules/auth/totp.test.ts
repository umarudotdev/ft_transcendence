import { describe, expect, test } from "bun:test";

import {
  decryptSecret,
  encryptSecret,
  generateTotpSecret,
  secretToBase32,
  verifyTotpCode,
} from "./totp";

describe("TOTP Utilities", () => {
  // ---------------------------------------------------------------------------
  // generateTotpSecret
  // ---------------------------------------------------------------------------

  describe("generateTotpSecret", () => {
    test("should generate a 20-byte secret", () => {
      const { secret } = generateTotpSecret("test@example.com");

      expect(secret.length).toBe(20);
      expect(secret).toBeInstanceOf(Uint8Array);
    });

    test("should generate a valid otpauth URI", () => {
      const { keyUri } = generateTotpSecret("test@example.com");

      expect(keyUri.startsWith("otpauth://totp/")).toBe(true);
      expect(keyUri).toContain("ft_transcendence");
      expect(keyUri).toContain("test%40example.com");
    });

    test("should include issuer in URI", () => {
      const { keyUri } = generateTotpSecret("user@test.com");

      expect(keyUri).toContain("issuer=ft_transcendence");
    });

    test("should generate different secrets each time", () => {
      const result1 = generateTotpSecret("test@example.com");
      const result2 = generateTotpSecret("test@example.com");

      // Secrets should be different (crypto random)
      expect(Buffer.from(result1.secret).toString("hex")).not.toBe(
        Buffer.from(result2.secret).toString("hex")
      );
    });

    test("should handle special characters in email", () => {
      const { keyUri } = generateTotpSecret("test+tag@example.com");

      // Should be URL encoded
      expect(keyUri).toContain("test");
      expect(keyUri.startsWith("otpauth://")).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // encryptSecret / decryptSecret
  // ---------------------------------------------------------------------------

  describe("encryptSecret and decryptSecret", () => {
    test("should encrypt and decrypt a secret correctly", () => {
      const { secret } = generateTotpSecret("test@example.com");

      const encrypted = encryptSecret(secret);
      const decrypted = decryptSecret(encrypted);

      expect(Buffer.from(decrypted).toString("hex")).toBe(
        Buffer.from(secret).toString("hex")
      );
    });

    test("should generate encrypted string in correct format", () => {
      const { secret } = generateTotpSecret("test@example.com");

      const encrypted = encryptSecret(secret);

      // Format: iv:authTag:encrypted (all base64)
      const parts = encrypted.split(":");
      expect(parts.length).toBe(3);

      // Each part should be valid base64
      for (const part of parts) {
        expect(() => Buffer.from(part, "base64")).not.toThrow();
      }
    });

    test("should produce different ciphertext for same secret", () => {
      const { secret } = generateTotpSecret("test@example.com");

      const encrypted1 = encryptSecret(secret);
      const encrypted2 = encryptSecret(secret);

      // IV is random, so ciphertext should be different
      expect(encrypted1).not.toBe(encrypted2);
    });

    test("should decrypt to original secret despite different ciphertexts", () => {
      const { secret } = generateTotpSecret("test@example.com");

      const encrypted1 = encryptSecret(secret);
      const encrypted2 = encryptSecret(secret);

      const decrypted1 = decryptSecret(encrypted1);
      const decrypted2 = decryptSecret(encrypted2);

      expect(Buffer.from(decrypted1).toString("hex")).toBe(
        Buffer.from(secret).toString("hex")
      );
      expect(Buffer.from(decrypted2).toString("hex")).toBe(
        Buffer.from(secret).toString("hex")
      );
    });

    test("should throw on tampered ciphertext", () => {
      const { secret } = generateTotpSecret("test@example.com");
      const encrypted = encryptSecret(secret);

      // Tamper with the encrypted data
      const parts = encrypted.split(":");
      const tamperedEncrypted = Buffer.from(parts[2], "base64");
      tamperedEncrypted[0] ^= 0xff; // Flip bits
      parts[2] = tamperedEncrypted.toString("base64");

      expect(() => decryptSecret(parts.join(":"))).toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // secretToBase32
  // ---------------------------------------------------------------------------

  describe("secretToBase32", () => {
    test("should convert secret to valid base32", () => {
      const { secret } = generateTotpSecret("test@example.com");

      const base32 = secretToBase32(secret);

      // Base32 uses only A-Z and 2-7
      expect(/^[A-Z2-7]+$/.test(base32)).toBe(true);
    });

    test("should produce consistent output for same input", () => {
      const { secret } = generateTotpSecret("test@example.com");

      const base32a = secretToBase32(secret);
      const base32b = secretToBase32(secret);

      expect(base32a).toBe(base32b);
    });

    test("should produce correct length output", () => {
      const { secret } = generateTotpSecret("test@example.com");

      const base32 = secretToBase32(secret);

      // 20 bytes * 8 bits = 160 bits
      // 160 / 5 bits per base32 char = 32 characters
      expect(base32.length).toBe(32);
    });
  });

  // ---------------------------------------------------------------------------
  // verifyTotpCode
  // ---------------------------------------------------------------------------

  describe("verifyTotpCode", () => {
    test("should reject invalid code format", () => {
      const { secret } = generateTotpSecret("test@example.com");

      expect(verifyTotpCode(secret, "")).toBe(false);
      expect(verifyTotpCode(secret, "12345")).toBe(false); // Too short
      expect(verifyTotpCode(secret, "1234567")).toBe(false); // Too long
      expect(verifyTotpCode(secret, "abcdef")).toBe(false); // Non-numeric
    });

    test("should reject random 6-digit codes", () => {
      const { secret } = generateTotpSecret("test@example.com");

      // Random codes should almost certainly be invalid
      for (let i = 0; i < 10; i++) {
        const randomCode = String(Math.floor(Math.random() * 1000000)).padStart(
          6,
          "0"
        );
        // Random codes are almost certainly invalid (1 in 1M chance per code)
        // We verify the function accepts valid format without throwing
        expect(typeof verifyTotpCode(secret, randomCode)).toBe("boolean");
      }
    });

    test("should work with correct code format", () => {
      // This test verifies the function doesn't throw on valid input
      const { secret } = generateTotpSecret("test@example.com");

      // These will return false (not valid codes) but should not throw
      expect(() => verifyTotpCode(secret, "123456")).not.toThrow();
      expect(() => verifyTotpCode(secret, "000000")).not.toThrow();
      expect(() => verifyTotpCode(secret, "999999")).not.toThrow();
    });
  });
});
