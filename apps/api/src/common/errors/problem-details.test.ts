import { describe, expect, test } from "bun:test";

import { ErrorTypes, HttpStatus } from "./error-types";
import {
  badRequest,
  conflict,
  forbidden,
  internalError,
  locked,
  notFound,
  problemDetails,
  rateLimited,
  serviceUnavailable,
  unauthorized,
  validationError,
} from "./problem-details-helper";

describe("Problem Details Helper Functions", () => {
  describe("problemDetails", () => {
    test("should create basic Problem Details with required fields", () => {
      const result = problemDetails(400, "Something went wrong");

      expect(result.type).toBe("about:blank");
      expect(result.status).toBe(400);
      expect(result.detail).toBe("Something went wrong");
      expect(result.title).toBe("Bad Request");
    });

    test("should include instance when provided", () => {
      const result = problemDetails(400, "Error", { instance: "/api/test" });

      expect(result.instance).toBe("/api/test");
    });

    test("should allow custom type and title", () => {
      const result = problemDetails(400, "Error", {
        type: "https://example.com/custom-error",
        title: "Custom Error",
      });

      expect(result.type).toBe("https://example.com/custom-error");
      expect(result.title).toBe("Custom Error");
    });

    test("should include extension fields", () => {
      const result = problemDetails(400, "Error", {
        extensions: { customField: "value", count: 42 },
      });

      expect(result).toHaveProperty("customField", "value");
      expect(result).toHaveProperty("count", 42);
    });

    test("should use error type title when type is not about:blank", () => {
      const result = problemDetails(401, "Not logged in", {
        type: ErrorTypes.UNAUTHORIZED,
      });

      expect(result.title).toBe("Authentication Required");
    });

    test("should fallback to status title when type title not found", () => {
      const result = problemDetails(418, "I'm a teapot", {
        type: "https://example.com/unknown-error",
      });

      expect(result.title).toBe("Error");
    });
  });

  describe("unauthorized", () => {
    test("should create 401 Problem Details", () => {
      const result = unauthorized("Invalid credentials");

      expect(result.status).toBe(HttpStatus.UNAUTHORIZED);
      expect(result.type).toBe(ErrorTypes.UNAUTHORIZED);
      expect(result.detail).toBe("Invalid credentials");
      expect(result.title).toBe("Authentication Required");
    });

    test("should include instance when provided", () => {
      const result = unauthorized("Not logged in", { instance: "/api/auth" });

      expect(result.instance).toBe("/api/auth");
    });
  });

  describe("forbidden", () => {
    test("should create 403 Problem Details", () => {
      const result = forbidden("Access denied");

      expect(result.status).toBe(HttpStatus.FORBIDDEN);
      expect(result.type).toBe(ErrorTypes.FORBIDDEN);
      expect(result.detail).toBe("Access denied");
      expect(result.title).toBe("Access Denied");
    });
  });

  describe("notFound", () => {
    test("should create 404 Problem Details", () => {
      const result = notFound("User not found");

      expect(result.status).toBe(HttpStatus.NOT_FOUND);
      expect(result.type).toBe(ErrorTypes.NOT_FOUND);
      expect(result.detail).toBe("User not found");
      expect(result.title).toBe("Resource Not Found");
    });
  });

  describe("conflict", () => {
    test("should create 409 Problem Details", () => {
      const result = conflict("Email already exists");

      expect(result.status).toBe(HttpStatus.CONFLICT);
      expect(result.type).toBe(ErrorTypes.CONFLICT);
      expect(result.detail).toBe("Email already exists");
      expect(result.title).toBe("Resource Conflict");
    });
  });

  describe("validationError", () => {
    test("should create 422 Problem Details with errors array", () => {
      const errors = [
        { field: "email", message: "Invalid email format" },
        { field: "password", message: "Too short" },
      ];
      const result = validationError("Validation failed", errors);

      expect(result.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
      expect(result.type).toBe(ErrorTypes.VALIDATION);
      expect(result.detail).toBe("Validation failed");
      expect(result.title).toBe("Validation Failed");
      expect(result.errors).toEqual(errors);
    });

    test("should work with empty errors array", () => {
      const result = validationError("Invalid input", []);

      expect(result.errors).toEqual([]);
    });

    test("should include instance when provided", () => {
      const result = validationError("Invalid", [], {
        instance: "/api/register",
      });

      expect(result.instance).toBe("/api/register");
    });
  });

  describe("rateLimited", () => {
    test("should create 429 Problem Details with retryAfter", () => {
      const result = rateLimited(60);

      expect(result.status).toBe(HttpStatus.TOO_MANY_REQUESTS);
      expect(result.type).toBe(ErrorTypes.RATE_LIMITED);
      expect(result.retryAfter).toBe(60);
      expect(result.detail).toBe(
        "Rate limit exceeded. Retry after 60 seconds."
      );
    });

    test("should handle different retry values", () => {
      const result = rateLimited(300);

      expect(result.retryAfter).toBe(300);
      expect(result.detail).toContain("300 seconds");
    });
  });

  describe("locked", () => {
    test("should create 423 Problem Details with unlockAt", () => {
      const unlockAt = new Date("2025-01-15T12:00:00Z");
      const result = locked(unlockAt);

      expect(result.status).toBe(HttpStatus.LOCKED);
      expect(result.unlockAt).toBe(unlockAt.toISOString());
      expect(result.detail).toContain(unlockAt.toISOString());
    });
  });

  describe("internalError", () => {
    test("should create 500 Problem Details with default message", () => {
      const result = internalError();

      expect(result.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(result.type).toBe(ErrorTypes.INTERNAL);
      expect(result.detail).toBe("An unexpected error occurred");
    });

    test("should create 500 Problem Details with custom message", () => {
      const result = internalError("Database connection failed");

      expect(result.detail).toBe("Database connection failed");
    });
  });

  describe("serviceUnavailable", () => {
    test("should create 503 Problem Details", () => {
      const result = serviceUnavailable("Service temporarily unavailable");

      expect(result.status).toBe(HttpStatus.SERVICE_UNAVAILABLE);
      expect(result.type).toBe(ErrorTypes.SERVICE_UNAVAILABLE);
      expect(result.detail).toBe("Service temporarily unavailable");
    });
  });

  describe("badRequest", () => {
    test("should create 400 Problem Details", () => {
      const result = badRequest("Invalid request body");

      expect(result.status).toBe(HttpStatus.BAD_REQUEST);
      expect(result.detail).toBe("Invalid request body");
      expect(result.type).toBe("about:blank");
    });

    test("should include instance when provided", () => {
      const result = badRequest("Invalid", { instance: "/api/test" });

      expect(result.instance).toBe("/api/test");
    });
  });
});

describe("RFC 9457 Compliance", () => {
  test("all helper functions should return required Problem Details fields", () => {
    const helpers = [
      () => unauthorized("test"),
      () => forbidden("test"),
      () => notFound("test"),
      () => conflict("test"),
      () => validationError("test", []),
      () => rateLimited(60),
      () => locked(new Date()),
      () => internalError(),
      () => serviceUnavailable("test"),
      () => badRequest("test"),
    ];

    for (const helper of helpers) {
      const result = helper();

      expect(result).toHaveProperty("type");
      expect(result).toHaveProperty("status");
      expect(result).toHaveProperty("title");
      expect(result).toHaveProperty("detail");
      expect(typeof result.type).toBe("string");
      expect(typeof result.status).toBe("number");
      expect(typeof result.title).toBe("string");
      expect(typeof result.detail).toBe("string");
    }
  });

  test("error type URIs should be valid URIs or about:blank", () => {
    const result = unauthorized("test");

    expect(result.type).toMatch(/^(https?:\/\/|about:blank)/);
  });

  test("status codes should match expected HTTP status codes", () => {
    expect(unauthorized("").status).toBe(401);
    expect(forbidden("").status).toBe(403);
    expect(notFound("").status).toBe(404);
    expect(conflict("").status).toBe(409);
    expect(validationError("", []).status).toBe(422);
    expect(locked(new Date()).status).toBe(423);
    expect(rateLimited(1).status).toBe(429);
    expect(internalError().status).toBe(500);
    expect(serviceUnavailable("").status).toBe(503);
    expect(badRequest("").status).toBe(400);
  });
});
