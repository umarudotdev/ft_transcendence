import { describe, expect, test } from "bun:test";
import { Elysia } from "elysia";

import { ErrorTypes, HttpStatus } from "../../common/errors";
import {
  AuthModel,
  mapLoginError,
  mapOAuthError,
  mapPasswordError,
  mapRegisterError,
  mapTokenError,
  mapTotpError,
} from "./auth.model";

/**
 * Controller tests focusing on schema validation and error mapping.
 * These tests verify the TypeBox schemas and error mapping functions
 * without requiring database access.
 */
describe("Auth Schema Validation", () => {
  describe("Registration schema", () => {
    const app = new Elysia().post(
      "/register",
      ({ body }) => ({ received: body }),
      { body: AuthModel.register }
    );

    test("accepts valid registration input", async () => {
      const response = await app.handle(
        new Request("http://localhost/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: "test@example.com",
            password: "ValidPass123",
            displayName: "TestUser",
            username: "testuser",
          }),
        })
      );

      expect(response.status).toBe(200);
    });

    test("rejects invalid email format", async () => {
      const response = await app.handle(
        new Request("http://localhost/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: "not-an-email",
            password: "ValidPass123",
            displayName: "TestUser",
            username: "testuser",
          }),
        })
      );

      expect(response.status).toBe(422);
    });

    test("rejects password shorter than 8 characters", async () => {
      const response = await app.handle(
        new Request("http://localhost/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: "test@example.com",
            password: "short",
            displayName: "TestUser",
            username: "testuser",
          }),
        })
      );

      expect(response.status).toBe(422);
    });

    test("rejects username shorter than 3 characters", async () => {
      const response = await app.handle(
        new Request("http://localhost/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: "test@example.com",
            password: "ValidPass123",
            displayName: "TestUser",
            username: "ab",
          }),
        })
      );

      expect(response.status).toBe(422);
    });

    test("rejects display name longer than 50 characters", async () => {
      const response = await app.handle(
        new Request("http://localhost/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: "test@example.com",
            password: "ValidPass123",
            displayName: "A".repeat(51),
            username: "testuser",
          }),
        })
      );

      expect(response.status).toBe(422);
    });

    test("rejects missing required fields", async () => {
      const response = await app.handle(
        new Request("http://localhost/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        })
      );

      expect(response.status).toBe(422);
    });
  });

  describe("Login schema", () => {
    const app = new Elysia().post(
      "/login",
      ({ body }) => ({ received: body }),
      { body: AuthModel.login }
    );

    test("accepts valid login input", async () => {
      const response = await app.handle(
        new Request("http://localhost/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: "test@example.com",
            password: "anypassword",
          }),
        })
      );

      expect(response.status).toBe(200);
    });

    test("rejects invalid email format", async () => {
      const response = await app.handle(
        new Request("http://localhost/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: "invalid",
            password: "test123",
          }),
        })
      );

      expect(response.status).toBe(422);
    });

    test("rejects empty password", async () => {
      const response = await app.handle(
        new Request("http://localhost/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: "test@example.com",
            password: "",
          }),
        })
      );

      expect(response.status).toBe(422);
    });
  });

  describe("TOTP code schema", () => {
    const app = new Elysia().post("/totp", ({ body }) => ({ received: body }), {
      body: AuthModel.totpCode,
    });

    test("accepts valid 6-digit code", async () => {
      const response = await app.handle(
        new Request("http://localhost/totp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: "123456" }),
        })
      );

      expect(response.status).toBe(200);
    });

    test("accepts code with leading zeros", async () => {
      const response = await app.handle(
        new Request("http://localhost/totp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: "000001" }),
        })
      );

      expect(response.status).toBe(200);
    });

    test("rejects 5-digit code", async () => {
      const response = await app.handle(
        new Request("http://localhost/totp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: "12345" }),
        })
      );

      expect(response.status).toBe(422);
    });

    test("rejects 7-digit code", async () => {
      const response = await app.handle(
        new Request("http://localhost/totp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: "1234567" }),
        })
      );

      expect(response.status).toBe(422);
    });

    test("rejects non-numeric code", async () => {
      const response = await app.handle(
        new Request("http://localhost/totp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: "abcdef" }),
        })
      );

      expect(response.status).toBe(422);
    });
  });

  describe("Other auth schemas", () => {
    test("verify-email requires token", async () => {
      const app = new Elysia().post(
        "/verify",
        ({ body }) => ({ received: body }),
        { body: AuthModel.verifyEmail }
      );

      const validResponse = await app.handle(
        new Request("http://localhost/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: "some-token" }),
        })
      );
      expect(validResponse.status).toBe(200);

      const invalidResponse = await app.handle(
        new Request("http://localhost/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        })
      );
      expect(invalidResponse.status).toBe(422);
    });

    test("forgot-password requires email", async () => {
      const app = new Elysia().post(
        "/forgot",
        ({ body }) => ({ received: body }),
        { body: AuthModel.forgotPassword }
      );

      const validResponse = await app.handle(
        new Request("http://localhost/forgot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: "test@example.com" }),
        })
      );
      expect(validResponse.status).toBe(200);
    });

    test("reset-password requires token and password", async () => {
      const app = new Elysia().post(
        "/reset",
        ({ body }) => ({ received: body }),
        { body: AuthModel.resetPassword }
      );

      const validResponse = await app.handle(
        new Request("http://localhost/reset", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token: "reset-token",
            password: "NewPassword123",
          }),
        })
      );
      expect(validResponse.status).toBe(200);
    });

    test("change-password requires currentPassword and newPassword", async () => {
      const app = new Elysia().post(
        "/change",
        ({ body }) => ({ received: body }),
        { body: AuthModel.changePassword }
      );

      const validResponse = await app.handle(
        new Request("http://localhost/change", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            currentPassword: "OldPassword123",
            newPassword: "NewPassword456",
          }),
        })
      );
      expect(validResponse.status).toBe(200);
    });
  });
});

describe("Auth Error Mapping to Problem Details", () => {
  const instance = "/api/auth/test";

  describe("mapRegisterError", () => {
    test("EMAIL_EXISTS maps to 409 Conflict", () => {
      const error = { type: "EMAIL_EXISTS" as const };
      const problem = mapRegisterError(error, instance);

      expect(problem.status).toBe(HttpStatus.CONFLICT);
      expect(problem.type).toBe(ErrorTypes.CONFLICT);
      expect(problem.detail).toBe("Email already registered");
      expect(problem.instance).toBe(instance);
    });

    test("WEAK_PASSWORD maps to 422 with validation errors", () => {
      const error = {
        type: "WEAK_PASSWORD" as const,
        requirements: ["At least 8 characters", "At least 1 uppercase"],
      };
      const problem = mapRegisterError(error, instance);

      expect(problem.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
      expect(problem.type).toBe(ErrorTypes.VALIDATION);

      const validationProblem = problem as unknown as {
        errors: { field: string; message: string }[];
      };
      expect(validationProblem.errors).toHaveLength(2);
      expect(validationProblem.errors[0].field).toBe("password");
    });
  });

  describe("mapLoginError", () => {
    test("INVALID_CREDENTIALS maps to 401 Unauthorized", () => {
      const error = { type: "INVALID_CREDENTIALS" as const };
      const problem = mapLoginError(error, instance);

      expect(problem).not.toBeNull();
      expect(problem!.status).toBe(HttpStatus.UNAUTHORIZED);
      expect(problem!.type).toBe(ErrorTypes.UNAUTHORIZED);
    });

    test("EMAIL_NOT_VERIFIED maps to 403 Forbidden", () => {
      const error = { type: "EMAIL_NOT_VERIFIED" as const };
      const problem = mapLoginError(error, instance);

      expect(problem!.status).toBe(HttpStatus.FORBIDDEN);
      expect(problem!.type).toBe(ErrorTypes.FORBIDDEN);
    });

    test("ACCOUNT_LOCKED maps to 423 with unlockAt", () => {
      const unlockAt = new Date("2025-01-15T12:00:00Z");
      const error = { type: "ACCOUNT_LOCKED" as const, unlockAt };
      const problem = mapLoginError(error, instance);

      expect(problem!.status).toBe(HttpStatus.LOCKED);
      const lockedProblem = problem as unknown as { unlockAt: string };
      expect(lockedProblem.unlockAt).toBe(unlockAt.toISOString());
    });

    test("REQUIRES_2FA returns null (not an error)", () => {
      const error = { type: "REQUIRES_2FA" as const, userId: 123 };
      const problem = mapLoginError(error, instance);

      expect(problem).toBeNull();
    });
  });

  describe("mapPasswordError", () => {
    test("INCORRECT_PASSWORD maps to 401", () => {
      const error = { type: "INCORRECT_PASSWORD" as const };
      const problem = mapPasswordError(error, instance);

      expect(problem.status).toBe(HttpStatus.UNAUTHORIZED);
    });

    test("WEAK_PASSWORD maps to 422 with newPassword field", () => {
      const error = {
        type: "WEAK_PASSWORD" as const,
        requirements: ["At least 1 number"],
      };
      const problem = mapPasswordError(error, instance);

      const validationProblem = problem as unknown as {
        errors: { field: string; message: string }[];
      };
      expect(validationProblem.errors[0].field).toBe("newPassword");
    });

    test("SAME_AS_CURRENT maps to 400", () => {
      const error = { type: "SAME_AS_CURRENT" as const };
      const problem = mapPasswordError(error, instance);

      expect(problem.status).toBe(HttpStatus.BAD_REQUEST);
    });
  });

  describe("mapTokenError", () => {
    test("INVALID_TOKEN maps to 400", () => {
      const error = { type: "INVALID_TOKEN" as const };
      const problem = mapTokenError(error, instance);

      expect(problem.status).toBe(HttpStatus.BAD_REQUEST);
    });

    test("EXPIRED_TOKEN maps to 400", () => {
      const error = { type: "EXPIRED_TOKEN" as const };
      const problem = mapTokenError(error, instance);

      expect(problem.status).toBe(HttpStatus.BAD_REQUEST);
    });
  });

  describe("mapOAuthError", () => {
    test("INVALID_STATE maps to 400", () => {
      const error = { type: "INVALID_STATE" as const };
      const problem = mapOAuthError(error, instance);

      expect(problem.status).toBe(HttpStatus.BAD_REQUEST);
    });

    test("TOKEN_EXCHANGE_FAILED maps to 503", () => {
      const error = { type: "TOKEN_EXCHANGE_FAILED" as const };
      const problem = mapOAuthError(error, instance);

      expect(problem.status).toBe(HttpStatus.SERVICE_UNAVAILABLE);
    });

    test("ACCOUNT_ALREADY_LINKED maps to 409", () => {
      const error = { type: "ACCOUNT_ALREADY_LINKED" as const };
      const problem = mapOAuthError(error, instance);

      expect(problem.status).toBe(HttpStatus.CONFLICT);
    });
  });

  describe("mapTotpError", () => {
    test("INVALID_CODE maps to 400", () => {
      const error = { type: "INVALID_CODE" as const };
      const problem = mapTotpError(error, instance);

      expect(problem.status).toBe(HttpStatus.BAD_REQUEST);
    });

    test("ALREADY_ENABLED maps to 409", () => {
      const error = { type: "ALREADY_ENABLED" as const };
      const problem = mapTotpError(error, instance);

      expect(problem.status).toBe(HttpStatus.CONFLICT);
    });

    test("NOT_ENABLED maps to 400", () => {
      const error = { type: "NOT_ENABLED" as const };
      const problem = mapTotpError(error, instance);

      expect(problem.status).toBe(HttpStatus.BAD_REQUEST);
    });
  });
});

describe("Problem Details JSON Serialization", () => {
  test("all error mappings produce valid JSON", () => {
    const instance = "/test";

    const testCases = [
      mapRegisterError({ type: "EMAIL_EXISTS" }, instance),
      mapRegisterError(
        { type: "WEAK_PASSWORD", requirements: ["test"] },
        instance
      ),
      mapLoginError({ type: "INVALID_CREDENTIALS" }, instance),
      mapLoginError({ type: "EMAIL_NOT_VERIFIED" }, instance),
      mapLoginError({ type: "ACCOUNT_LOCKED", unlockAt: new Date() }, instance),
      mapPasswordError({ type: "INCORRECT_PASSWORD" }, instance),
      mapPasswordError({ type: "SAME_AS_CURRENT" }, instance),
      mapTokenError({ type: "INVALID_TOKEN" }, instance),
      mapOAuthError({ type: "INVALID_STATE" }, instance),
      mapTotpError({ type: "INVALID_CODE" }, instance),
    ];

    for (const problem of testCases) {
      if (problem === null) continue;

      expect(() => JSON.stringify(problem)).not.toThrow();

      const parsed = JSON.parse(JSON.stringify(problem));
      expect(parsed).toHaveProperty("type");
      expect(parsed).toHaveProperty("status");
      expect(parsed).toHaveProperty("title");
      expect(parsed).toHaveProperty("detail");
    }
  });
});
