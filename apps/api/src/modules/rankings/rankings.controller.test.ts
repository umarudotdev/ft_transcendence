import { describe, expect, test } from "bun:test";
import { Elysia } from "elysia";

import { HttpStatus } from "../../common/errors";
import { mapRankingError, RankingsModel } from "./rankings.model";

describe("RankingsModel Schema Validation", () => {
  describe("leaderboardQuery", () => {
    const app = new Elysia().get(
      "/leaderboard",
      ({ query }) => ({ received: query }),
      { query: RankingsModel.leaderboardQuery }
    );

    test("accepts valid query with all parameters", async () => {
      const response = await app.handle(
        new Request("http://localhost/leaderboard?limit=50&offset=10&tier=gold")
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.received.limit).toBe(50);
      expect(body.received.offset).toBe(10);
      expect(body.received.tier).toBe("gold");
    });

    test("accepts empty query with defaults", async () => {
      const response = await app.handle(
        new Request("http://localhost/leaderboard")
      );
      expect(response.status).toBe(200);
    });

    test("accepts valid tier values", async () => {
      for (const tier of ["bronze", "silver", "gold", "platinum"]) {
        const response = await app.handle(
          new Request(`http://localhost/leaderboard?tier=${tier}`)
        );
        expect(response.status).toBe(200);
      }
    });

    test("rejects invalid tier value", async () => {
      const response = await app.handle(
        new Request("http://localhost/leaderboard?tier=diamond")
      );
      expect(response.status).toBe(422);
    });

    test("rejects limit below minimum (1)", async () => {
      const response = await app.handle(
        new Request("http://localhost/leaderboard?limit=0")
      );
      expect(response.status).toBe(422);
    });

    test("rejects limit above maximum (100)", async () => {
      const response = await app.handle(
        new Request("http://localhost/leaderboard?limit=101")
      );
      expect(response.status).toBe(422);
    });

    test("rejects negative offset", async () => {
      const response = await app.handle(
        new Request("http://localhost/leaderboard?offset=-1")
      );
      expect(response.status).toBe(422);
    });
  });

  describe("historyQuery", () => {
    const app = new Elysia().get(
      "/history",
      ({ query }) => ({ received: query }),
      { query: RankingsModel.historyQuery }
    );

    test("accepts valid pagination parameters", async () => {
      const response = await app.handle(
        new Request("http://localhost/history?limit=30&offset=5")
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.received.limit).toBe(30);
      expect(body.received.offset).toBe(5);
    });

    test("accepts empty query with defaults", async () => {
      const response = await app.handle(
        new Request("http://localhost/history")
      );
      expect(response.status).toBe(200);
    });

    test("rejects limit outside valid range", async () => {
      const tooLow = await app.handle(
        new Request("http://localhost/history?limit=0")
      );
      expect(tooLow.status).toBe(422);

      const tooHigh = await app.handle(
        new Request("http://localhost/history?limit=101")
      );
      expect(tooHigh.status).toBe(422);
    });
  });

  describe("userIdParam", () => {
    const app = new Elysia().get(
      "/users/:id",
      ({ params }) => ({ received: params }),
      { params: RankingsModel.userIdParam }
    );

    test("accepts valid numeric user ID", async () => {
      const response = await app.handle(
        new Request("http://localhost/users/123")
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.received.id).toBe(123);
    });

    test("converts string ID to number", async () => {
      const response = await app.handle(
        new Request("http://localhost/users/456")
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(typeof body.received.id).toBe("number");
    });

    test("rejects non-numeric ID", async () => {
      const response = await app.handle(
        new Request("http://localhost/users/abc")
      );
      expect(response.status).toBe(422);
    });
  });

  describe("seasonIdParam", () => {
    const app = new Elysia().get(
      "/seasons/:seasonId",
      ({ params }) => ({ received: params }),
      { params: RankingsModel.seasonIdParam }
    );

    test("accepts valid numeric season ID", async () => {
      const response = await app.handle(
        new Request("http://localhost/seasons/1")
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.received.seasonId).toBe(1);
    });

    test("rejects non-numeric season ID", async () => {
      const response = await app.handle(
        new Request("http://localhost/seasons/invalid")
      );
      expect(response.status).toBe(422);
    });
  });
});

describe("Ranking Error Mapping", () => {
  const instance = "/api/rankings/test";

  test("USER_NOT_FOUND returns 404", () => {
    const result = mapRankingError({ type: "USER_NOT_FOUND" }, instance);
    expect(result.status).toBe(HttpStatus.NOT_FOUND);
    expect(result.detail).toBe("User not found");
    expect(result.instance).toBe(instance);
  });

  test("RATING_NOT_FOUND returns 404", () => {
    const result = mapRankingError({ type: "RATING_NOT_FOUND" }, instance);
    expect(result.status).toBe(HttpStatus.NOT_FOUND);
    expect(result.detail).toBe("Rating not found for user");
  });

  test("SEASON_NOT_FOUND returns 404", () => {
    const result = mapRankingError({ type: "SEASON_NOT_FOUND" }, instance);
    expect(result.status).toBe(HttpStatus.NOT_FOUND);
    expect(result.detail).toBe("Season not found");
  });

  test("MATCH_NOT_FOUND returns 404", () => {
    const result = mapRankingError({ type: "MATCH_NOT_FOUND" }, instance);
    expect(result.status).toBe(HttpStatus.NOT_FOUND);
    expect(result.detail).toBe("Match not found");
  });

  test("INVALID_MATCH returns 400", () => {
    const result = mapRankingError({ type: "INVALID_MATCH" }, instance);
    expect(result.status).toBe(HttpStatus.BAD_REQUEST);
    expect(result.detail).toBe("Invalid match for rating calculation");
  });
});

describe("RFC 9457 Problem Details Compliance", () => {
  const instance = "/api/rankings/test";

  test("all ranking error mappings include required RFC 9457 fields", () => {
    const errors = [
      { type: "USER_NOT_FOUND" as const },
      { type: "RATING_NOT_FOUND" as const },
      { type: "SEASON_NOT_FOUND" as const },
      { type: "MATCH_NOT_FOUND" as const },
      { type: "INVALID_MATCH" as const },
    ];

    for (const error of errors) {
      const result = mapRankingError(error, instance);
      expect(result).toHaveProperty("type");
      expect(result).toHaveProperty("status");
      expect(result).toHaveProperty("title");
      expect(result).toHaveProperty("detail");
      expect(result).toHaveProperty("instance");
      expect(result.type).toMatch(/^(https?:\/\/|about:blank)/);
    }
  });

  test("error responses are JSON serializable", () => {
    const result = mapRankingError({ type: "USER_NOT_FOUND" }, instance);
    expect(() => JSON.stringify(result)).not.toThrow();
    const parsed = JSON.parse(JSON.stringify(result));
    expect(parsed.status).toBe(result.status);
  });
});
