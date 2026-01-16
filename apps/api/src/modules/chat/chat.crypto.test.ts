import { describe, expect, test } from "bun:test";

import { decryptMessage, encryptMessage, isEncrypted } from "./chat.crypto";

describe("Chat Encryption Module", () => {
  describe("encryptMessage", () => {
    test("encrypts a simple message", () => {
      const plaintext = "Hello, World!";
      const encrypted = encryptMessage(plaintext);

      expect(encrypted).toBeDefined();
      expect(encrypted).not.toBe(plaintext);
      expect(typeof encrypted).toBe("string");
    });

    test("returns encrypted format with three base64 parts", () => {
      const encrypted = encryptMessage("Test message");
      const parts = encrypted.split(":");

      expect(parts).toHaveLength(3);

      // Each part should be valid base64
      for (const part of parts) {
        expect(() => Buffer.from(part, "base64")).not.toThrow();
      }
    });

    test("produces different ciphertext for same message (random IV)", () => {
      const message = "Same message";
      const encrypted1 = encryptMessage(message);
      const encrypted2 = encryptMessage(message);

      expect(encrypted1).not.toBe(encrypted2);

      // IV (first part) should be different
      const iv1 = encrypted1.split(":")[0];
      const iv2 = encrypted2.split(":")[0];
      expect(iv1).not.toBe(iv2);
    });

    test("encrypts empty string", () => {
      const encrypted = encryptMessage("");

      expect(encrypted).toBeDefined();
      expect(encrypted.split(":")).toHaveLength(3);
    });

    test("encrypts very long messages", () => {
      const longMessage = "a".repeat(10000);
      const encrypted = encryptMessage(longMessage);

      expect(encrypted).toBeDefined();
      expect(encrypted.split(":")).toHaveLength(3);
    });

    test("encrypts messages with special characters", () => {
      const specialChars = "!@#$%^&*()_+-=[]{}|;':\",./<>?`~\\";
      const encrypted = encryptMessage(specialChars);

      expect(encrypted).toBeDefined();
      expect(encrypted.split(":")).toHaveLength(3);
    });

    test("encrypts messages with newlines and tabs", () => {
      const whitespace = "Line 1\nLine 2\tTabbed\r\nCRLF";
      const encrypted = encryptMessage(whitespace);

      expect(encrypted).toBeDefined();
      expect(encrypted.split(":")).toHaveLength(3);
    });
  });

  describe("decryptMessage", () => {
    test("decrypts encrypted message correctly", () => {
      const plaintext = "Hello, World!";
      const encrypted = encryptMessage(plaintext);
      const decrypted = decryptMessage(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    test("roundtrip preserves empty string", () => {
      const plaintext = "";
      const encrypted = encryptMessage(plaintext);
      const decrypted = decryptMessage(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    test("roundtrip preserves long messages", () => {
      const plaintext = "x".repeat(5000);
      const encrypted = encryptMessage(plaintext);
      const decrypted = decryptMessage(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    test("roundtrip preserves special characters", () => {
      const plaintext = "!@#$%^&*()_+-=[]{}|;':\",./<>?`~\\";
      const encrypted = encryptMessage(plaintext);
      const decrypted = decryptMessage(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    test("roundtrip preserves whitespace characters", () => {
      const plaintext = "Line 1\nLine 2\tTabbed\r\nCRLF";
      const encrypted = encryptMessage(plaintext);
      const decrypted = decryptMessage(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    test("throws on invalid format (missing parts)", () => {
      expect(() => decryptMessage("onlyonepart")).toThrow(
        "Invalid encrypted message format"
      );

      expect(() => decryptMessage("two:parts")).toThrow(
        "Invalid encrypted message format"
      );

      expect(() => decryptMessage("four:parts:here:now")).toThrow(
        "Invalid encrypted message format"
      );
    });

    test("throws on tampered ciphertext", () => {
      const encrypted = encryptMessage("Original message");
      const parts = encrypted.split(":");

      // Tamper with the ciphertext (third part)
      const tamperedCiphertext = Buffer.from(parts[2], "base64");
      tamperedCiphertext[0] ^= 0xff; // Flip bits
      parts[2] = tamperedCiphertext.toString("base64");

      expect(() => decryptMessage(parts.join(":"))).toThrow();
    });

    test("throws on tampered auth tag", () => {
      const encrypted = encryptMessage("Original message");
      const parts = encrypted.split(":");

      // Tamper with the auth tag (second part)
      const tamperedAuthTag = Buffer.from(parts[1], "base64");
      tamperedAuthTag[0] ^= 0xff;
      parts[1] = tamperedAuthTag.toString("base64");

      expect(() => decryptMessage(parts.join(":"))).toThrow();
    });

    test("throws on tampered IV", () => {
      const encrypted = encryptMessage("Original message");
      const parts = encrypted.split(":");

      // Tamper with the IV (first part)
      const tamperedIV = Buffer.from(parts[0], "base64");
      tamperedIV[0] ^= 0xff;
      parts[0] = tamperedIV.toString("base64");

      expect(() => decryptMessage(parts.join(":"))).toThrow();
    });

    test("throws on completely wrong IV length", () => {
      const encrypted = encryptMessage("Test");
      const parts = encrypted.split(":");

      // Use wrong length IV
      parts[0] = Buffer.from("short").toString("base64");

      expect(() => decryptMessage(parts.join(":"))).toThrow();
    });
  });

  describe("Unicode and Emoji Support", () => {
    test("roundtrip preserves Unicode characters", () => {
      const plaintext = "Hello 世界 🌍 مرحبا привет";
      const encrypted = encryptMessage(plaintext);
      const decrypted = decryptMessage(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    test("roundtrip preserves emojis", () => {
      const plaintext = "👋 Hello! 🎉 Party time! 🚀 Let's go! 💯";
      const encrypted = encryptMessage(plaintext);
      const decrypted = decryptMessage(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    test("roundtrip preserves complex emoji sequences", () => {
      const plaintext = "Family: 👨‍👩‍👧‍👦 Flag: 🇺🇸 Skin tone: 👋🏽";
      const encrypted = encryptMessage(plaintext);
      const decrypted = decryptMessage(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    test("roundtrip preserves mixed content", () => {
      const plaintext = `Hey! 😊
I'm at 42 school 🏫
Learning C++ and 日本語
Let's meet at café ☕️
Time: 14:30 ⏰`;
      const encrypted = encryptMessage(plaintext);
      const decrypted = decryptMessage(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    test("roundtrip preserves CJK characters", () => {
      const plaintext = "中文测试 日本語テスト 한국어 테스트 繁體字測試";
      const encrypted = encryptMessage(plaintext);
      const decrypted = decryptMessage(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    test("roundtrip preserves Arabic and Hebrew", () => {
      const plaintext = "مرحبا بالعالم שלום עולם";
      const encrypted = encryptMessage(plaintext);
      const decrypted = decryptMessage(encrypted);

      expect(decrypted).toBe(plaintext);
    });
  });

  describe("isEncrypted", () => {
    test("returns true for encrypted messages", () => {
      const encrypted = encryptMessage("Test message");
      expect(isEncrypted(encrypted)).toBe(true);
    });

    test("returns false for plaintext messages", () => {
      expect(isEncrypted("Hello, World!")).toBe(false);
      expect(isEncrypted("Simple message")).toBe(false);
    });

    test("returns false for messages with wrong format", () => {
      expect(isEncrypted("one:two")).toBe(false); // Only 2 parts
      expect(isEncrypted("one:two:three:four")).toBe(false); // 4 parts
      expect(isEncrypted("")).toBe(false); // Empty
    });

    test("returns false for invalid base64", () => {
      expect(isEncrypted("!!!:###:$$$")).toBe(false); // Invalid base64 chars
      expect(isEncrypted("abc:def:not-base64!")).toBe(false);
    });

    test("returns true for valid base64 format even if not real encryption", () => {
      // This checks format, not decryptability
      const fakeEncrypted = `${Buffer.from("iv").toString("base64")}:${Buffer.from("tag").toString("base64")}:${Buffer.from("cipher").toString("base64")}`;
      expect(isEncrypted(fakeEncrypted)).toBe(true);
    });

    test("handles edge cases", () => {
      expect(isEncrypted("aaa:bbb:ccc")).toBe(true); // Valid base64 format
      expect(isEncrypted("AA==:BB==:CC==")).toBe(true); // Padded base64
    });
  });

  describe("Encryption Security Properties", () => {
    test("IV has correct length (12 bytes = 96 bits for GCM)", () => {
      const encrypted = encryptMessage("Test");
      const ivBase64 = encrypted.split(":")[0];
      const iv = Buffer.from(ivBase64, "base64");

      expect(iv.length).toBe(12);
    });

    test("Auth tag has correct length (16 bytes = 128 bits)", () => {
      const encrypted = encryptMessage("Test");
      const authTagBase64 = encrypted.split(":")[1];
      const authTag = Buffer.from(authTagBase64, "base64");

      expect(authTag.length).toBe(16);
    });

    test("ciphertext is never shorter than plaintext for non-empty input", () => {
      const plaintext = "Test message";
      const encrypted = encryptMessage(plaintext);
      const ciphertextBase64 = encrypted.split(":")[2];
      const ciphertext = Buffer.from(ciphertextBase64, "base64");

      // GCM mode produces ciphertext of same length as plaintext
      // But base64 encoding adds overhead
      expect(ciphertext.length).toBeGreaterThanOrEqual(plaintext.length);
    });

    test("multiple encryptions all produce valid decryptable output", () => {
      const messages = [
        "Short",
        "Medium length message here",
        "A".repeat(1000),
        "Unicode: 日本語 🎉",
        "Special: !@#$%^&*()",
      ];

      for (const message of messages) {
        const encrypted = encryptMessage(message);
        const decrypted = decryptMessage(encrypted);
        expect(decrypted).toBe(message);
      }
    });
  });

  describe("Edge Cases", () => {
    test("handles null byte in message", () => {
      const plaintext = "Before\x00After";
      const encrypted = encryptMessage(plaintext);
      const decrypted = decryptMessage(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    test("handles message that looks like encrypted format", () => {
      // A message that happens to have colons
      const plaintext = "part1:part2:part3";
      const encrypted = encryptMessage(plaintext);
      const decrypted = decryptMessage(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    test("handles message with base64-like content", () => {
      const plaintext = "SGVsbG8gV29ybGQ=:YW5vdGhlcg==:bGFzdA==";
      const encrypted = encryptMessage(plaintext);
      const decrypted = decryptMessage(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    test("handles very short message (1 char)", () => {
      const plaintext = "X";
      const encrypted = encryptMessage(plaintext);
      const decrypted = decryptMessage(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    test("handles message with only whitespace", () => {
      const plaintext = "   \t\n   ";
      const encrypted = encryptMessage(plaintext);
      const decrypted = decryptMessage(encrypted);

      expect(decrypted).toBe(plaintext);
    });
  });
});
