import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

import { GameRoom } from "./GameRoom";

// We call onAuth directly — it only uses `options` and global `fetch`,
// so we don't need a full Colyseus server.

const originalFetch = globalThis.fetch;
const originalNodeEnv = process.env.NODE_ENV;

describe("GameRoom.onAuth", () => {
  let room: GameRoom;

  beforeEach(() => {
    // Construct without Colyseus lifecycle (we only test onAuth)
    room = Object.create(GameRoom.prototype) as GameRoom;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.env.NODE_ENV = originalNodeEnv;
  });

  describe("development mode (no joinToken)", () => {
    beforeEach(() => {
      process.env.NODE_ENV = "development";
    });

    test("returns synthetic user when no joinToken and userId provided", async () => {
      const result = await room.onAuth(
        {} as never,
        { userId: 5, displayName: "TestPlayer" },
        {} as never
      );
      expect(result).toEqual({ id: 5, displayName: "TestPlayer" });
    });

    test("defaults displayName when not provided", async () => {
      const result = await room.onAuth({} as never, { userId: 3 }, {} as never);
      expect(result).toEqual({ id: 3, displayName: "Player 3" });
    });

    test("defaults userId to 0 when not provided", async () => {
      const result = await room.onAuth({} as never, {}, {} as never);
      expect(result).toEqual({ id: 0, displayName: "Player 0" });
    });
  });

  describe("production mode (no joinToken)", () => {
    beforeEach(() => {
      process.env.NODE_ENV = "production";
    });

    test("throws when no joinToken provided", async () => {
      expect(room.onAuth({} as never, {}, {} as never)).rejects.toThrow(
        "Missing join token"
      );
    });
  });

  describe("with joinToken", () => {
    test("returns user data on successful validation", async () => {
      globalThis.fetch = mock(() =>
        Promise.resolve(
          new Response(JSON.stringify({ id: 42, displayName: "Alice" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        )
      ) as typeof fetch;

      const result = await room.onAuth(
        {} as never,
        { joinToken: "valid-token" },
        {} as never
      );

      expect(result).toEqual({ id: 42, displayName: "Alice" });
    });

    test("calls validate-join API with correct headers and body", async () => {
      const fetchMock = mock(() =>
        Promise.resolve(
          new Response(JSON.stringify({ id: 1, displayName: "X" }), {
            status: 200,
          })
        )
      );
      globalThis.fetch = fetchMock as typeof fetch;

      await room.onAuth({} as never, { joinToken: "my-token" }, {} as never);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toContain("/api/matchmaking/internal/validate-join");
      expect(options.method).toBe("POST");
      expect(options.headers).toHaveProperty("Authorization");
      expect(JSON.parse(options.body as string)).toEqual({
        joinToken: "my-token",
      });
    });

    test("throws when API returns non-OK status", async () => {
      globalThis.fetch = mock(() =>
        Promise.resolve(new Response("Unauthorized", { status: 401 }))
      ) as typeof fetch;

      expect(
        room.onAuth({} as never, { joinToken: "bad-token" }, {} as never)
      ).rejects.toThrow("Invalid join token");
    });
  });
});
