import { describe, expect, test } from "bun:test";

import { ErrorTypes, HttpStatus } from "../../common/errors";
import {
  mapLoginError,
  mapOAuthError,
  mapPasswordError,
  mapRegisterError,
  mapTokenError,
  mapTotpError,
} from "./auth.model";
import { AuthService } from "./auth.service";
import { hashPassword, verifyPassword } from "./password";
import { decryptSecret, encryptSecret, generateTotpSecret } from "./totp";

describe("AuthService.generateOAuthUrl", () => {
  test("returns null when OAuth is not configured, or valid URL when configured", () => {
    const result = AuthService.generateOAuthUrl();

    if (result === null) {
      // OAuth not configured - this is valid
      expect(result).toBeNull();
    } else {
      // OAuth configured - verify structure
      expect(result).toHaveProperty("url");
      expect(result).toHaveProperty("state");
      expect(typeof result.url).toBe("string");
      expect(typeof result.state).toBe("string");
      expect(result.url).toContain("api.intra.42.fr");
      expect(result.state.length).toBeGreaterThan(0);
    }
  });
});

describe("Auth Error Mapping Functions", () => {
  const instance = "/api/auth/test";

  describe("mapRegisterError", () => {
    test("EMAIL_EXISTS returns 409 Conflict with correct message", () => {
      const result = mapRegisterError({ type: "EMAIL_EXISTS" }, instance);

      expect(result.status).toBe(HttpStatus.CONFLICT);
      expect(result.type).toBe(ErrorTypes.CONFLICT);
      expect(result.detail).toBe("Email already registered");
      expect(result.instance).toBe(instance);
    });

    test("WEAK_PASSWORD returns 422 with field-level errors", () => {
      const requirements = [
        "At least 8 characters",
        "At least 1 uppercase letter",
      ];
      const result = mapRegisterError(
        { type: "WEAK_PASSWORD", requirements },
        instance
      );

      expect(result.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
      expect(result.type).toBe(ErrorTypes.VALIDATION);

      const { errors } = result as unknown as {
        errors: { field: string; message: string }[];
      };
      expect(errors).toHaveLength(2);
      expect(errors[0]).toEqual({
        field: "password",
        message: requirements[0],
      });
      expect(errors[1]).toEqual({
        field: "password",
        message: requirements[1],
      });
    });
  });

  describe("mapLoginError", () => {
    test("INVALID_CREDENTIALS returns 401 without leaking which field was wrong", () => {
      const result = mapLoginError({ type: "INVALID_CREDENTIALS" }, instance);

      expect(result).not.toBeNull();
      expect(result!.status).toBe(HttpStatus.UNAUTHORIZED);
      expect(result!.detail).toBe("Invalid email or password");
      // Should not say "email not found" or "wrong password"
      expect(result!.detail).not.toContain("email not found");
      expect(result!.detail).not.toContain("wrong password");
    });

    test("EMAIL_NOT_VERIFIED returns 403 with helpful message", () => {
      const result = mapLoginError({ type: "EMAIL_NOT_VERIFIED" }, instance);

      expect(result!.status).toBe(HttpStatus.FORBIDDEN);
      expect(result!.detail).toContain("verify");
    });

    test("ACCOUNT_LOCKED returns 423 with unlock timestamp", () => {
      const unlockAt = new Date("2025-01-15T12:00:00Z");
      const result = mapLoginError(
        { type: "ACCOUNT_LOCKED", unlockAt },
        instance
      );

      expect(result!.status).toBe(HttpStatus.LOCKED);
      const { unlockAt: returnedUnlockAt } = result as unknown as {
        unlockAt: string;
      };
      expect(returnedUnlockAt).toBe(unlockAt.toISOString());
    });

    test("REQUIRES_2FA returns null (handled as redirect, not error)", () => {
      const result = mapLoginError(
        { type: "REQUIRES_2FA", userId: 123 },
        instance
      );
      expect(result).toBeNull();
    });
  });

  describe("mapPasswordError", () => {
    test("INCORRECT_PASSWORD returns 401", () => {
      const result = mapPasswordError({ type: "INCORRECT_PASSWORD" }, instance);
      expect(result.status).toBe(HttpStatus.UNAUTHORIZED);
    });

    test("WEAK_PASSWORD uses newPassword field (not password)", () => {
      const result = mapPasswordError(
        { type: "WEAK_PASSWORD", requirements: ["At least 1 number"] },
        instance
      );

      const { errors } = result as unknown as {
        errors: { field: string; message: string }[];
      };
      expect(errors[0].field).toBe("newPassword");
    });

    test("SAME_AS_CURRENT returns 400", () => {
      const result = mapPasswordError({ type: "SAME_AS_CURRENT" }, instance);
      expect(result.status).toBe(HttpStatus.BAD_REQUEST);
    });
  });

  describe("mapTokenError", () => {
    test("INVALID_TOKEN and EXPIRED_TOKEN both return 400", () => {
      expect(mapTokenError({ type: "INVALID_TOKEN" }, instance).status).toBe(
        400
      );
      expect(mapTokenError({ type: "EXPIRED_TOKEN" }, instance).status).toBe(
        400
      );
    });
  });

  describe("mapOAuthError", () => {
    test("external service failures return 503", () => {
      expect(
        mapOAuthError({ type: "TOKEN_EXCHANGE_FAILED" }, instance).status
      ).toBe(HttpStatus.SERVICE_UNAVAILABLE);
      expect(
        mapOAuthError({ type: "PROFILE_FETCH_FAILED" }, instance).status
      ).toBe(HttpStatus.SERVICE_UNAVAILABLE);
    });

    test("ACCOUNT_ALREADY_LINKED returns 409", () => {
      const result = mapOAuthError(
        { type: "ACCOUNT_ALREADY_LINKED" },
        instance
      );
      expect(result.status).toBe(HttpStatus.CONFLICT);
    });
  });

  describe("mapTotpError", () => {
    test("state conflicts return 409", () => {
      expect(mapTotpError({ type: "ALREADY_ENABLED" }, instance).status).toBe(
        409
      );
    });

    test("invalid operations return 400", () => {
      expect(mapTotpError({ type: "INVALID_CODE" }, instance).status).toBe(400);
      expect(mapTotpError({ type: "NOT_ENABLED" }, instance).status).toBe(400);
    });
  });
});

describe("RFC 9457 Problem Details Compliance", () => {
  const instance = "/api/test";

  test("all error mappings include required RFC 9457 fields", () => {
    const errorMappings = [
      mapRegisterError({ type: "EMAIL_EXISTS" }, instance),
      mapLoginError({ type: "INVALID_CREDENTIALS" }, instance),
      mapPasswordError({ type: "INCORRECT_PASSWORD" }, instance),
      mapTokenError({ type: "INVALID_TOKEN" }, instance),
      mapOAuthError({ type: "INVALID_STATE" }, instance),
      mapTotpError({ type: "INVALID_CODE" }, instance),
    ];

    for (const result of errorMappings) {
      if (result === null) continue;

      expect(result).toHaveProperty("type");
      expect(result).toHaveProperty("status");
      expect(result).toHaveProperty("title");
      expect(result).toHaveProperty("detail");
      expect(result).toHaveProperty("instance");

      // type should be a URI or about:blank (RFC 9457 allows both)
      expect(result.type).toMatch(/^(https?:\/\/|about:blank)/);
    }
  });

  test("error responses are JSON serializable", () => {
    const result = mapRegisterError(
      { type: "WEAK_PASSWORD", requirements: ["test"] },
      instance
    );

    expect(() => JSON.stringify(result)).not.toThrow();
    const parsed = JSON.parse(JSON.stringify(result));
    expect(parsed.status).toBe(result.status);
    expect(parsed.errors).toEqual(
      (result as unknown as { errors: unknown[] }).errors
    );
  });
});

describe("Password Hashing Integration", () => {
  test("hashPassword and verifyPassword work together", async () => {
    const password = "SecurePass123!";
    const hash = await hashPassword(password);

    expect(await verifyPassword(password, hash)).toBe(true);
    expect(await verifyPassword("WrongPassword", hash)).toBe(false);
  });

  test("same password produces different hashes (salt is random)", async () => {
    const password = "TestPassword123";
    const hash1 = await hashPassword(password);
    const hash2 = await hashPassword(password);

    expect(hash1).not.toBe(hash2);
    // But both should verify correctly
    expect(await verifyPassword(password, hash1)).toBe(true);
    expect(await verifyPassword(password, hash2)).toBe(true);
  });
});

describe("TOTP Secret Management", () => {
  test("generateTotpSecret produces valid secret and URI", () => {
    const email = "test@example.com";
    const { secret, keyUri } = generateTotpSecret(email);

    expect(secret).toBeInstanceOf(Uint8Array);
    expect(secret.length).toBe(20);
    expect(keyUri).toMatch(/^otpauth:\/\/totp\//);
    expect(keyUri).toContain(encodeURIComponent(email));
  });

  test("encrypt/decrypt roundtrip preserves secret", () => {
    const { secret } = generateTotpSecret("test@example.com");
    const encrypted = encryptSecret(secret);
    const decrypted = decryptSecret(encrypted);

    expect(Buffer.from(decrypted).toString("hex")).toBe(
      Buffer.from(secret).toString("hex")
    );
  });

  test("encrypted format has expected structure (iv:authTag:ciphertext)", () => {
    const { secret } = generateTotpSecret("test@example.com");
    const encrypted = encryptSecret(secret);

    const parts = encrypted.split(":");
    expect(parts).toHaveLength(3);
    // Each part should be valid base64
    for (const part of parts) {
      expect(() => Buffer.from(part, "base64")).not.toThrow();
    }
  });

  test("tampering with ciphertext causes decryption to fail", () => {
    const { secret } = generateTotpSecret("test@example.com");
    const encrypted = encryptSecret(secret);

    const parts = encrypted.split(":");
    const tamperedCiphertext = Buffer.from(parts[2], "base64");
    tamperedCiphertext[0] ^= 0xff;
    parts[2] = tamperedCiphertext.toString("base64");

    expect(() => decryptSecret(parts.join(":"))).toThrow();
  });
});
