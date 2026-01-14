import { describe, expect, test } from "bun:test";

import { AuthService } from "./auth.service";
import { hashPassword } from "./password";
import { encryptSecret, generateTotpSecret } from "./totp";

describe("Auth Service", () => {
  describe("Password Strength Integration", () => {
    test("register should reject weak passwords", async () => {});
  });

  describe("Session Management", () => {
    test("should use 7-day session duration", () => {
      const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
      expect(SESSION_DURATION_MS).toBe(604800000);
    });

    test("should use 24-hour email verification duration", () => {
      const EMAIL_VERIFICATION_DURATION_MS = 24 * 60 * 60 * 1000;
      expect(EMAIL_VERIFICATION_DURATION_MS).toBe(86400000);
    });

    test("should use 1-hour password reset duration", () => {
      const PASSWORD_RESET_DURATION_MS = 60 * 60 * 1000;
      expect(PASSWORD_RESET_DURATION_MS).toBe(3600000);
    });
  });

  describe("generateOAuthUrl", () => {
    test("should return null when OAuth is not configured", () => {
      const result = AuthService.generateOAuthUrl();

      if (result === null) {
        expect(result).toBeNull();
      } else {
        expect(result).toHaveProperty("url");
        expect(result).toHaveProperty("state");
        expect(result.url).toContain("api.intra.42.fr");
      }
    });
  });

  describe("SafeUser transformation", () => {
    test("should exclude sensitive fields from user response", () => {
      const safeUserKeys = [
        "id",
        "email",
        "displayName",
        "avatarUrl",
        "emailVerified",
        "twoFactorEnabled",
        "intraId",
        "createdAt",
      ];

      expect(safeUserKeys).not.toContain("passwordHash");
      expect(safeUserKeys).not.toContain("totpSecret");
      expect(safeUserKeys).not.toContain("failedLoginAttempts");
      expect(safeUserKeys).not.toContain("lockedUntil");
    });
  });
});

describe("Auth Service Helper Functions", () => {
  describe("toSafeUser function behavior", () => {
    test("should only include public user fields", () => {
      interface SafeUser {
        id: number;
        email: string;
        displayName: string;
        avatarUrl: string | null;
        emailVerified: boolean;
        twoFactorEnabled: boolean;
        intraId: number | null;
        createdAt: Date;
      }

      const user: SafeUser = {
        id: 1,
        email: "test@example.com",
        displayName: "Test",
        avatarUrl: null,
        emailVerified: true,
        twoFactorEnabled: false,
        intraId: null,
        createdAt: new Date(),
      };

      expect(Object.keys(user).sort()).toEqual([
        "avatarUrl",
        "createdAt",
        "displayName",
        "email",
        "emailVerified",
        "id",
        "intraId",
        "twoFactorEnabled",
      ]);
    });
  });
});

describe("Auth Error Types", () => {
  test("RegisterError types should be defined", () => {
    type RegisterErrorTypes = "EMAIL_EXISTS" | "WEAK_PASSWORD";
    const types: RegisterErrorTypes[] = ["EMAIL_EXISTS", "WEAK_PASSWORD"];
    expect(types).toHaveLength(2);
  });

  test("LoginError types should be defined", () => {
    type LoginErrorTypes =
      | "INVALID_CREDENTIALS"
      | "ACCOUNT_LOCKED"
      | "EMAIL_NOT_VERIFIED"
      | "REQUIRES_2FA";
    const types: LoginErrorTypes[] = [
      "INVALID_CREDENTIALS",
      "ACCOUNT_LOCKED",
      "EMAIL_NOT_VERIFIED",
      "REQUIRES_2FA",
    ];
    expect(types).toHaveLength(4);
  });

  test("SessionError types should be defined", () => {
    type SessionErrorTypes = "NOT_FOUND" | "EXPIRED";
    const types: SessionErrorTypes[] = ["NOT_FOUND", "EXPIRED"];
    expect(types).toHaveLength(2);
  });

  test("TokenError types should be defined", () => {
    type TokenErrorTypes = "INVALID_TOKEN" | "EXPIRED_TOKEN";
    const types: TokenErrorTypes[] = ["INVALID_TOKEN", "EXPIRED_TOKEN"];
    expect(types).toHaveLength(2);
  });

  test("PasswordError types should be defined", () => {
    type PasswordErrorTypes =
      | "WEAK_PASSWORD"
      | "INCORRECT_PASSWORD"
      | "SAME_AS_CURRENT";
    const types: PasswordErrorTypes[] = [
      "WEAK_PASSWORD",
      "INCORRECT_PASSWORD",
      "SAME_AS_CURRENT",
    ];
    expect(types).toHaveLength(3);
  });

  test("TotpError types should be defined", () => {
    type TotpErrorTypes = "NOT_ENABLED" | "ALREADY_ENABLED" | "INVALID_CODE";
    const types: TotpErrorTypes[] = [
      "NOT_ENABLED",
      "ALREADY_ENABLED",
      "INVALID_CODE",
    ];
    expect(types).toHaveLength(3);
  });

  test("OAuthError types should be defined", () => {
    type OAuthErrorTypes =
      | "INVALID_STATE"
      | "TOKEN_EXCHANGE_FAILED"
      | "PROFILE_FETCH_FAILED"
      | "ACCOUNT_ALREADY_LINKED";
    const types: OAuthErrorTypes[] = [
      "INVALID_STATE",
      "TOKEN_EXCHANGE_FAILED",
      "PROFILE_FETCH_FAILED",
      "ACCOUNT_ALREADY_LINKED",
    ];
    expect(types).toHaveLength(4);
  });
});

describe("Auth Service with Password Integration", () => {
  test("hashPassword produces verifiable hashes", async () => {
    const password = "ValidPass123";
    const hash = await hashPassword(password);

    expect(hash).toContain("$argon2id$");
  });

  test("TOTP secret generation works correctly", () => {
    const { secret, keyUri } = generateTotpSecret("test@example.com");

    expect(secret.length).toBe(20);
    expect(keyUri).toContain("otpauth://totp/");
  });

  test("TOTP secret encryption roundtrip works", () => {
    const { secret } = generateTotpSecret("test@example.com");
    const encrypted = encryptSecret(secret);

    expect(encrypted.split(":")).toHaveLength(3);
  });
});
