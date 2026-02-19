import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { MatchmakingService } from "./matchmaking.service";

// Helper to access private static fields for testing
type ServiceInternals = {
  queue: Map<
    number,
    {
      userId: number;
      mode: string;
      rating: number;
      displayName: string;
      queuedAt: number;
    }
  >;
  connections: Map<number, Set<WebSocket>>;
  wsTokens: Map<string, { userId: number; expiresAt: number }>;
  joinTokens: Map<
    string,
    {
      data: { userId: number; displayName: string; matchSessionId: string };
      expiresAt: number;
    }
  >;
};

function getInternals(): ServiceInternals {
  return MatchmakingService as unknown as ServiceInternals;
}

beforeEach(() => {
  // Clear all in-memory state before each test
  getInternals().queue.clear();
  getInternals().connections.clear();
  getInternals().wsTokens.clear();
  getInternals().joinTokens.clear();
});

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
    const _token = MatchmakingService.generateWsToken(1);

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

describe("MatchmakingService Queue Management", () => {
  test("joinQueue succeeds and returns position", () => {
    const result = MatchmakingService.joinQueue(1, "ranked", 1200, "Alice");
    expect(result.isOk()).toBe(true);
    result.map((data) => {
      expect(data.position).toBe(1);
      expect(data.estimatedWait).toBeGreaterThan(0);
    });
  });

  test("joinQueue returns ALREADY_IN_QUEUE for duplicate", () => {
    MatchmakingService.joinQueue(1, "ranked", 1200, "Alice");
    const result = MatchmakingService.joinQueue(1, "ranked", 1200, "Alice");
    expect(result.isErr()).toBe(true);
    result.mapErr((e) => {
      expect(e.type).toBe("ALREADY_IN_QUEUE");
    });
  });

  test("joinQueue tracks position correctly for multiple players", () => {
    MatchmakingService.joinQueue(1, "ranked", 1200, "Alice");
    const result = MatchmakingService.joinQueue(2, "ranked", 1100, "Bob");
    expect(result.isOk()).toBe(true);
    result.map((data) => {
      expect(data.position).toBe(2);
    });
  });

  test("leaveQueue succeeds for queued player", () => {
    MatchmakingService.joinQueue(1, "ranked", 1200, "Alice");
    const result = MatchmakingService.leaveQueue(1);
    expect(result.isOk()).toBe(true);
  });

  test("leaveQueue returns NOT_IN_QUEUE for non-queued player", () => {
    const result = MatchmakingService.leaveQueue(999);
    expect(result.isErr()).toBe(true);
    result.mapErr((e) => {
      expect(e.type).toBe("NOT_IN_QUEUE");
    });
  });

  test("leaveQueue allows re-joining", () => {
    MatchmakingService.joinQueue(1, "ranked", 1200, "Alice");
    MatchmakingService.leaveQueue(1);
    const result = MatchmakingService.joinQueue(1, "ranked", 1200, "Alice");
    expect(result.isOk()).toBe(true);
  });

  test("getQueueStatus returns inQueue=false for non-queued player", () => {
    const status = MatchmakingService.getQueueStatus(999);
    expect(status.inQueue).toBe(false);
    expect(status.position).toBe(0);
  });

  test("getQueueStatus returns correct position for queued player", () => {
    MatchmakingService.joinQueue(1, "ranked", 1200, "Alice");
    MatchmakingService.joinQueue(2, "ranked", 1100, "Bob");

    const status1 = MatchmakingService.getQueueStatus(1);
    expect(status1.inQueue).toBe(true);
    expect(status1.position).toBe(1);

    const status2 = MatchmakingService.getQueueStatus(2);
    expect(status2.inQueue).toBe(true);
    expect(status2.position).toBe(2);
  });

  test("getQueueStatus updates after a player leaves", () => {
    MatchmakingService.joinQueue(1, "ranked", 1200, "Alice");
    MatchmakingService.joinQueue(2, "ranked", 1100, "Bob");
    MatchmakingService.leaveQueue(1);

    const status = MatchmakingService.getQueueStatus(2);
    expect(status.inQueue).toBe(true);
    expect(status.position).toBe(1);
  });
});

describe("MatchmakingService Connection Management", () => {
  function makeMockWs(): WebSocket {
    return {} as WebSocket;
  }

  test("getConnectionCount returns 0 for unknown user", () => {
    expect(MatchmakingService.getConnectionCount(999)).toBe(0);
  });

  test("registerConnection increments count", () => {
    const ws = makeMockWs();
    MatchmakingService.registerConnection(1, ws);
    expect(MatchmakingService.getConnectionCount(1)).toBe(1);
  });

  test("registerConnection supports multiple connections per user", () => {
    const ws1 = makeMockWs();
    const ws2 = makeMockWs();
    MatchmakingService.registerConnection(1, ws1);
    MatchmakingService.registerConnection(1, ws2);
    expect(MatchmakingService.getConnectionCount(1)).toBe(2);
  });

  test("unregisterConnection decrements count", () => {
    const ws1 = makeMockWs();
    const ws2 = makeMockWs();
    MatchmakingService.registerConnection(1, ws1);
    MatchmakingService.registerConnection(1, ws2);

    MatchmakingService.unregisterConnection(1, ws1);
    expect(MatchmakingService.getConnectionCount(1)).toBe(1);
  });

  test("unregisterConnection cleans up empty set", () => {
    const ws = makeMockWs();
    MatchmakingService.registerConnection(1, ws);
    MatchmakingService.unregisterConnection(1, ws);
    expect(MatchmakingService.getConnectionCount(1)).toBe(0);
    // Internal set should be removed
    expect(getInternals().connections.has(1)).toBe(false);
  });

  test("unregisterConnection is idempotent for unknown ws", () => {
    const ws = makeMockWs();
    // Should not throw
    MatchmakingService.unregisterConnection(999, ws);
    expect(MatchmakingService.getConnectionCount(999)).toBe(0);
  });

  test("connections are isolated between users", () => {
    MatchmakingService.registerConnection(1, makeMockWs());
    MatchmakingService.registerConnection(2, makeMockWs());
    MatchmakingService.registerConnection(2, makeMockWs());

    expect(MatchmakingService.getConnectionCount(1)).toBe(1);
    expect(MatchmakingService.getConnectionCount(2)).toBe(2);
  });
});

describe("MatchmakingService Token Sweep", () => {
  test("sweepExpiredTokens removes expired WS tokens", () => {
    const internals = getInternals();
    internals.wsTokens.set("valid", {
      userId: 1,
      expiresAt: Date.now() + 60_000,
    });
    internals.wsTokens.set("expired", {
      userId: 2,
      expiresAt: Date.now() - 1000,
    });

    // Access private method via bracket notation
    (
      MatchmakingService as unknown as { sweepExpiredTokens: () => void }
    ).sweepExpiredTokens();

    expect(internals.wsTokens.has("valid")).toBe(true);
    expect(internals.wsTokens.has("expired")).toBe(false);
  });

  test("sweepExpiredTokens removes expired join tokens", () => {
    const internals = getInternals();
    internals.joinTokens.set("valid", {
      data: { userId: 1, displayName: "A", matchSessionId: "s1" },
      expiresAt: Date.now() + 60_000,
    });
    internals.joinTokens.set("expired", {
      data: { userId: 2, displayName: "B", matchSessionId: "s2" },
      expiresAt: Date.now() - 1000,
    });

    (
      MatchmakingService as unknown as { sweepExpiredTokens: () => void }
    ).sweepExpiredTokens();

    expect(internals.joinTokens.has("valid")).toBe(true);
    expect(internals.joinTokens.has("expired")).toBe(false);
  });
});
