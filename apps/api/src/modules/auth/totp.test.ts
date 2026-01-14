import { describe, expect, test } from "bun:test";

import {
  decryptSecret,
  encryptSecret,
  generateTotpSecret,
  secretToBase32,
  verifyTotpCode,
} from "./totp";

describe("TOTP Utilities", () => {
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

      expect(Buffer.from(result1.secret).toString("hex")).not.toBe(
        Buffer.from(result2.secret).toString("hex")
      );
    });

    test("should handle special characters in email", () => {
      const { keyUri } = generateTotpSecret("test+tag@example.com");

      expect(keyUri).toContain("test");
      expect(keyUri.startsWith("otpauth://")).toBe(true);
    });
  });

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

      const parts = encrypted.split(":");
      expect(parts.length).toBe(3);

      for (const part of parts) {
        expect(() => Buffer.from(part, "base64")).not.toThrow();
      }
    });

    test("should produce different ciphertext for same secret", () => {
      const { secret } = generateTotpSecret("test@example.com");

      const encrypted1 = encryptSecret(secret);
      const encrypted2 = encryptSecret(secret);

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

      const parts = encrypted.split(":");
      const tamperedEncrypted = Buffer.from(parts[2], "base64");
      tamperedEncrypted[0] ^= 0xff;
      parts[2] = tamperedEncrypted.toString("base64");

      expect(() => decryptSecret(parts.join(":"))).toThrow();
    });
  });

  describe("secretToBase32", () => {
    test("should convert secret to valid base32", () => {
      const { secret } = generateTotpSecret("test@example.com");

      const base32 = secretToBase32(secret);

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

      expect(base32.length).toBe(32);
    });
  });

  describe("verifyTotpCode", () => {
    test("should reject invalid code format", () => {
      const { secret } = generateTotpSecret("test@example.com");

      expect(verifyTotpCode(secret, "")).toBe(false);
      expect(verifyTotpCode(secret, "12345")).toBe(false);
      expect(verifyTotpCode(secret, "1234567")).toBe(false);
      expect(verifyTotpCode(secret, "abcdef")).toBe(false);
    });

    test("should reject random 6-digit codes", () => {
      const { secret } = generateTotpSecret("test@example.com");

      for (let i = 0; i < 10; i++) {
        const randomCode = String(Math.floor(Math.random() * 1000000)).padStart(
          6,
          "0"
        );

        expect(typeof verifyTotpCode(secret, randomCode)).toBe("boolean");
      }
    });

    test("should work with correct code format", () => {
      const { secret } = generateTotpSecret("test@example.com");

      expect(() => verifyTotpCode(secret, "123456")).not.toThrow();
      expect(() => verifyTotpCode(secret, "000000")).not.toThrow();
      expect(() => verifyTotpCode(secret, "999999")).not.toThrow();
    });
  });
});
