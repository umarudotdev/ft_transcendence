import { afterEach, describe, expect, test } from "bun:test";
import { Elysia, t } from "elysia";

import { unauthorized } from "../../common/errors/problem-details-helper";
import { MatchmakingService } from "./matchmaking.service";

/**
 * Integration tests for the POST /internal/validate-join endpoint.
 * Uses a minimal Elysia app that mirrors the controller's route and guard.
 */

const INTERNAL_SECRET = "dev-game-secret";

// Minimal app reproducing the internal route with its auth guard
const app = new Elysia({ prefix: "/matchmaking" }).group("/internal", (group) =>
  group
    .onBeforeHandle(({ request, set }) => {
      const authHeader = request.headers.get("Authorization");
      if (authHeader !== `Bearer ${INTERNAL_SECRET}`) {
        set.status = 401;
        return unauthorized("Invalid internal secret");
      }
    })
    .post(
      "/validate-join",
      ({ body, set }) => {
        const data = MatchmakingService.validateJoinToken(body.joinToken);

        if (!data) {
          set.status = 401;
          return unauthorized("Invalid or expired join token");
        }

        return {
          id: data.userId,
          displayName: data.displayName,
          matchSessionId: data.matchSessionId,
        };
      },
      {
        body: t.Object({
          joinToken: t.String(),
        }),
      }
    )
);

function makeRequest(joinToken: string, secret = INTERNAL_SECRET) {
  return app.handle(
    new Request("http://localhost/matchmaking/internal/validate-join", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({ joinToken }),
    })
  );
}

afterEach(() => {
  MatchmakingService.shutdown();
});

describe("POST /internal/validate-join", () => {
  test("returns user data for a valid join token", async () => {
    const token = MatchmakingService.generateJoinToken(
      10,
      "Charlie",
      "match-xyz"
    );

    const res = await makeRequest(token);
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      id: number;
      displayName: string;
      matchSessionId: string;
    };
    expect(body.id).toBe(10);
    expect(body.displayName).toBe("Charlie");
    expect(body.matchSessionId).toBe("match-xyz");
  });

  test("returns 401 for an invalid join token", async () => {
    const res = await makeRequest("nonexistent-token");
    expect(res.status).toBe(401);
  });

  test("returns 401 for an already-consumed (single-use) token", async () => {
    const token = MatchmakingService.generateJoinToken(1, "A", "s1");

    // First call consumes the token
    const first = await makeRequest(token);
    expect(first.status).toBe(200);

    // Second call should fail
    const second = await makeRequest(token);
    expect(second.status).toBe(401);
  });

  test("returns 401 when Authorization header is wrong", async () => {
    const token = MatchmakingService.generateJoinToken(1, "A", "s1");

    const res = await makeRequest(token, "wrong-secret");
    expect(res.status).toBe(401);
  });

  test("returns 401 when Authorization header is missing", async () => {
    const token = MatchmakingService.generateJoinToken(1, "A", "s1");

    const res = await app.handle(
      new Request("http://localhost/matchmaking/internal/validate-join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ joinToken: token }),
      })
    );
    expect(res.status).toBe(401);
  });
});
