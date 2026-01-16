import { describe, expect, test } from "bun:test";
import { Elysia } from "elysia";

import { HttpStatus } from "../../common/errors";
import { GamificationModel, mapGamificationError } from "./gamification.model";

describe("GamificationModel Schema Validation", () => {
  describe("historyQuery", () => {
    const app = new Elysia().get(
      "/history",
      ({ query }) => ({ received: query }),
      { query: GamificationModel.historyQuery }
    );

    test("accepts valid query with all parameters", async () => {
      const response = await app.handle(
        new Request("http://localhost/history?limit=50&offset=10&type=win")
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.received.limit).toBe(50);
      expect(body.received.offset).toBe(10);
      expect(body.received.type).toBe("win");
    });

    test("accepts empty query with defaults", async () => {
      const response = await app.handle(
        new Request("http://localhost/history")
      );
      expect(response.status).toBe(200);
    });

    test("accepts any string for type filter", async () => {
      for (const type of [
        "win",
        "daily_login",
        "streak_bonus",
        "achievement",
      ]) {
        const response = await app.handle(
          new Request(`http://localhost/history?type=${type}`)
        );
        expect(response.status).toBe(200);
      }
    });

    test("rejects limit below minimum (1)", async () => {
      const response = await app.handle(
        new Request("http://localhost/history?limit=0")
      );
      expect(response.status).toBe(422);
    });

    test("rejects limit above maximum (100)", async () => {
      const response = await app.handle(
        new Request("http://localhost/history?limit=101")
      );
      expect(response.status).toBe(422);
    });

    test("rejects negative offset", async () => {
      const response = await app.handle(
        new Request("http://localhost/history?offset=-1")
      );
      expect(response.status).toBe(422);
    });
  });

  describe("userIdParam", () => {
    const app = new Elysia().get(
      "/users/:id",
      ({ params }) => ({ received: params }),
      { params: GamificationModel.userIdParam }
    );

    test("accepts valid numeric user ID", async () => {
      const response = await app.handle(
        new Request("http://localhost/users/123")
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.received.id).toBe(123);
    });

    test("rejects non-numeric ID", async () => {
      const response = await app.handle(
        new Request("http://localhost/users/abc")
      );
      expect(response.status).toBe(422);
    });
  });

  describe("achievementIdParam", () => {
    const app = new Elysia().get(
      "/achievements/:achievementId",
      ({ params }) => ({ received: params }),
      { params: GamificationModel.achievementIdParam }
    );

    test("accepts valid numeric achievement ID", async () => {
      const response = await app.handle(
        new Request("http://localhost/achievements/5")
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.received.achievementId).toBe(5);
    });

    test("rejects non-numeric achievement ID", async () => {
      const response = await app.handle(
        new Request("http://localhost/achievements/invalid")
      );
      expect(response.status).toBe(422);
    });
  });
});

describe("Gamification Error Mapping", () => {
  const instance = "/api/gamification/test";

  test("USER_NOT_FOUND returns 404", () => {
    const result = mapGamificationError({ type: "USER_NOT_FOUND" }, instance);
    expect(result.status).toBe(HttpStatus.NOT_FOUND);
    expect(result.detail).toBe("User not found");
    expect(result.instance).toBe(instance);
  });

  test("ACHIEVEMENT_NOT_FOUND returns 404", () => {
    const result = mapGamificationError(
      { type: "ACHIEVEMENT_NOT_FOUND" },
      instance
    );
    expect(result.status).toBe(HttpStatus.NOT_FOUND);
    expect(result.detail).toBe("Achievement not found");
  });

  test("ALREADY_CLAIMED_TODAY returns 409 Conflict", () => {
    const result = mapGamificationError(
      { type: "ALREADY_CLAIMED_TODAY" },
      instance
    );
    expect(result.status).toBe(HttpStatus.CONFLICT);
    expect(result.detail).toBe("Daily reward already claimed today");
  });

  test("ACHIEVEMENT_ALREADY_UNLOCKED returns 409 Conflict", () => {
    const result = mapGamificationError(
      { type: "ACHIEVEMENT_ALREADY_UNLOCKED" },
      instance
    );
    expect(result.status).toBe(HttpStatus.CONFLICT);
    expect(result.detail).toBe("Achievement already unlocked");
  });

  test("INSUFFICIENT_POINTS returns 400 Bad Request", () => {
    const result = mapGamificationError(
      { type: "INSUFFICIENT_POINTS" },
      instance
    );
    expect(result.status).toBe(HttpStatus.BAD_REQUEST);
    expect(result.detail).toBe("Insufficient points");
  });
});

describe("RFC 9457 Problem Details Compliance", () => {
  const instance = "/api/gamification/test";

  test("all gamification error mappings include required RFC 9457 fields", () => {
    const errors = [
      { type: "USER_NOT_FOUND" as const },
      { type: "ACHIEVEMENT_NOT_FOUND" as const },
      { type: "ALREADY_CLAIMED_TODAY" as const },
      { type: "ACHIEVEMENT_ALREADY_UNLOCKED" as const },
      { type: "INSUFFICIENT_POINTS" as const },
    ];

    for (const error of errors) {
      const result = mapGamificationError(error, instance);
      expect(result).toHaveProperty("type");
      expect(result).toHaveProperty("status");
      expect(result).toHaveProperty("title");
      expect(result).toHaveProperty("detail");
      expect(result).toHaveProperty("instance");
      expect(result.type).toMatch(/^(https?:\/\/|about:blank)/);
    }
  });

  test("error responses are JSON serializable", () => {
    const result = mapGamificationError(
      { type: "ALREADY_CLAIMED_TODAY" },
      instance
    );
    expect(() => JSON.stringify(result)).not.toThrow();
    const parsed = JSON.parse(JSON.stringify(result));
    expect(parsed.status).toBe(result.status);
  });
});
