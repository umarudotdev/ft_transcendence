import { describe, expect, test } from "bun:test";
import { Elysia, t } from "elysia";

import { ErrorTypes, HttpStatus } from "../errors/error-types";
import {
  badRequest,
  internalError,
  notFound,
  validationError,
} from "../errors/problem-details-helper";

/**
 * Tests for error handler utility functions.
 * These tests verify the Problem Details response format without requiring
 * the full Elysia request/response cycle.
 */
describe("Error Handler Utilities", () => {
  describe("parseValidationError behavior", () => {
    test("validationError produces correct format for field errors", () => {
      const fieldErrors = [
        { field: "email", message: "Invalid email format" },
        { field: "password", message: "Too short" },
      ];

      const result = validationError(
        "One or more fields failed validation",
        fieldErrors,
        { instance: "/test" }
      );

      expect(result.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
      expect(result.type).toBe(ErrorTypes.VALIDATION);
      expect(result.title).toBe("Validation Failed");
      expect(result.detail).toBe("One or more fields failed validation");
      expect(result.instance).toBe("/test");
      expect(result.errors).toEqual(fieldErrors);
    });

    test("validationError works with single field error", () => {
      const fieldErrors = [{ field: "name", message: "Required field" }];
      const result = validationError("Validation failed", fieldErrors);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe("name");
    });

    test("validationError works with empty errors array", () => {
      const result = validationError("General validation error", []);

      expect(result.errors).toHaveLength(0);
    });
  });

  describe("notFound produces correct format", () => {
    test("should create 404 Problem Details", () => {
      const result = notFound("Resource not found", {
        instance: "/api/users/999",
      });

      expect(result.status).toBe(HttpStatus.NOT_FOUND);
      expect(result.type).toBe(ErrorTypes.NOT_FOUND);
      expect(result.title).toBe("Resource Not Found");
      expect(result.detail).toBe("Resource not found");
      expect(result.instance).toBe("/api/users/999");
    });
  });

  describe("badRequest produces correct format", () => {
    test("should create 400 Problem Details", () => {
      const result = badRequest("Invalid request body", {
        instance: "/api/data",
      });

      expect(result.status).toBe(HttpStatus.BAD_REQUEST);
      expect(result.detail).toBe("Invalid request body");
      expect(result.instance).toBe("/api/data");
    });
  });

  describe("internalError produces correct format", () => {
    test("should create 500 Problem Details with default message", () => {
      const result = internalError(undefined, { instance: "/api/action" });

      expect(result.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(result.type).toBe(ErrorTypes.INTERNAL);
      expect(result.detail).toBe("An unexpected error occurred");
      expect(result.instance).toBe("/api/action");
    });

    test("should not include stack trace or internal details", () => {
      const result = internalError("Custom message", { instance: "/api/fail" });

      // Should only contain RFC 9457 fields
      const json = JSON.stringify(result);
      expect(json).not.toContain("stack");
      expect(json).not.toContain("Error:");
    });
  });
});

describe("RFC 9457 Problem Details Format", () => {
  test("validation response has all required fields", () => {
    const result = validationError(
      "Test error",
      [{ field: "test", message: "test message" }],
      { instance: "/test" }
    );

    // RFC 9457 required members
    expect(result).toHaveProperty("type");
    expect(result).toHaveProperty("status");
    expect(result).toHaveProperty("title");
    expect(result).toHaveProperty("detail");

    // Types should be correct
    expect(typeof result.type).toBe("string");
    expect(typeof result.status).toBe("number");
    expect(typeof result.title).toBe("string");
    expect(typeof result.detail).toBe("string");
  });

  test("error type URIs should be valid URIs", () => {
    const result = notFound("Not found", { instance: "/test" });

    expect(result.type).toMatch(/^https?:\/\//);
  });

  test("status codes should be standard HTTP codes", () => {
    expect(validationError("", []).status).toBe(422);
    expect(notFound("").status).toBe(404);
    expect(badRequest("").status).toBe(400);
    expect(internalError().status).toBe(500);
  });
});

describe("Elysia Validation Integration", () => {
  const app = new Elysia().post(
    "/validate",
    ({ body }) => ({ received: body }),
    {
      body: t.Object({
        email: t.String({ format: "email" }),
        name: t.String({ minLength: 3 }),
      }),
    }
  );

  test("valid request passes validation", async () => {
    const response = await app.handle(
      new Request("http://localhost/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "test@example.com",
          name: "TestUser",
        }),
      })
    );

    expect(response.status).toBe(200);
  });

  test("invalid request returns 422", async () => {
    const response = await app.handle(
      new Request("http://localhost/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "invalid-email",
          name: "AB",
        }),
      })
    );

    expect(response.status).toBe(422);
  });

  test("missing fields return 422", async () => {
    const response = await app.handle(
      new Request("http://localhost/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
    );

    expect(response.status).toBe(422);
  });
});

describe("Error Response Serialization", () => {
  test("Problem Details responses are JSON serializable", () => {
    const responses = [
      validationError("test", [{ field: "f", message: "m" }]),
      notFound("test"),
      badRequest("test"),
      internalError(),
    ];

    for (const response of responses) {
      expect(() => JSON.stringify(response)).not.toThrow();

      const serialized = JSON.stringify(response);
      const parsed = JSON.parse(serialized);

      expect(parsed).toHaveProperty("type");
      expect(parsed).toHaveProperty("status");
      expect(parsed).toHaveProperty("title");
      expect(parsed).toHaveProperty("detail");
    }
  });

  test("validation errors include errors array after serialization", () => {
    const errors = [
      { field: "email", message: "Invalid" },
      { field: "name", message: "Required" },
    ];
    const response = validationError("Validation failed", errors);

    const serialized = JSON.stringify(response);
    const parsed = JSON.parse(serialized);

    expect(parsed.errors).toEqual(errors);
  });
});
