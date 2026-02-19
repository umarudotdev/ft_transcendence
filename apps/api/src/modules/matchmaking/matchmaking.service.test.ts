import { afterEach, describe, expect, test } from "bun:test";

import { MatchmakingService } from "./matchmaking.service";

afterEach(() => {
  MatchmakingService.shutdown();
});

describe("MatchmakingService WS Tokens", () => {
  test("generateWsToken returns a non-empty string", () => {
    const token = MatchmakingService.generateWsToken(1);
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(0);
  });

  test("validateWsToken returns userId for a valid token", () => {
    const token = MatchmakingService.generateWsToken(42);
    const userId = MatchmakingService.validateWsToken(token);
    expect(userId).toBe(42);
  });

  test("validateWsToken returns null for unknown token", () => {
    expect(MatchmakingService.validateWsToken("nonexistent")).toBeNull();
  });

  test("validateWsToken is single-use (second call returns null)", () => {
    const token = MatchmakingService.generateWsToken(1);
    MatchmakingService.validateWsToken(token);
    expect(MatchmakingService.validateWsToken(token)).toBeNull();
  });

  test("validateWsToken returns null after expiry", () => {
    const token = MatchmakingService.generateWsToken(1);

    // Manually expire the token by reaching into the internal map
    // We test the logic path by creating a token with past expiry
    const expiredToken = "expired-ws-token";
    // Access private static field via bracket notation for testing
    (
      MatchmakingService as unknown as {
        wsTokens: Map<string, { userId: number; expiresAt: number }>;
      }
    ).wsTokens.set(expiredToken, { userId: 99, expiresAt: Date.now() - 1000 });

    expect(MatchmakingService.validateWsToken(expiredToken)).toBeNull();
    // Token should be deleted even when expired (single-use)
    expect(MatchmakingService.validateWsToken(expiredToken)).toBeNull();
  });

  test("each generated token is unique", () => {
    const t1 = MatchmakingService.generateWsToken(1);
    const t2 = MatchmakingService.generateWsToken(1);
    expect(t1).not.toBe(t2);
  });
});

describe("MatchmakingService Join Tokens", () => {
  test("generateJoinToken returns a non-empty string", () => {
    const token = MatchmakingService.generateJoinToken(1, "Alice", "session-1");
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(0);
  });

  test("validateJoinToken returns data for a valid token", () => {
    const token = MatchmakingService.generateJoinToken(
      7,
      "Bob",
      "match-session-abc"
    );
    const data = MatchmakingService.validateJoinToken(token);

    expect(data).not.toBeNull();
    expect(data!.userId).toBe(7);
    expect(data!.displayName).toBe("Bob");
    expect(data!.matchSessionId).toBe("match-session-abc");
  });

  test("validateJoinToken returns null for unknown token", () => {
    expect(MatchmakingService.validateJoinToken("nonexistent")).toBeNull();
  });

  test("validateJoinToken is single-use (second call returns null)", () => {
    const token = MatchmakingService.generateJoinToken(1, "Alice", "s1");
    MatchmakingService.validateJoinToken(token);
    expect(MatchmakingService.validateJoinToken(token)).toBeNull();
  });

  test("validateJoinToken returns null after expiry", () => {
    const expiredToken = "expired-join-token";
    (
      MatchmakingService as unknown as {
        joinTokens: Map<
          string,
          {
            data: {
              userId: number;
              displayName: string;
              matchSessionId: string;
            };
            expiresAt: number;
          }
        >;
      }
    ).joinTokens.set(expiredToken, {
      data: { userId: 99, displayName: "Expired", matchSessionId: "s-old" },
      expiresAt: Date.now() - 1000,
    });

    expect(MatchmakingService.validateJoinToken(expiredToken)).toBeNull();
  });

  test("each generated token is unique", () => {
    const t1 = MatchmakingService.generateJoinToken(1, "A", "s1");
    const t2 = MatchmakingService.generateJoinToken(1, "A", "s1");
    expect(t1).not.toBe(t2);
  });
});
