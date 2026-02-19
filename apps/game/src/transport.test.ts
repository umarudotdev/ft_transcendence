import { describe, expect, test } from "bun:test";

/**
 * Tests for the PatchedBunWebSockets query-string stripping fix.
 *
 * The @colyseus/bun-websockets@0.17.7 regex for extracting roomId:
 *   /\/[a-zA-Z0-9_\-]+\/([a-zA-Z0-9_\-]+)$/
 *
 * fails when rawClient.data.url includes query parameters because
 * the `$` anchor doesn't match before `?sessionId=...`.
 */

// The exact regex from @colyseus/bun-websockets@0.17.7 BunWebSockets.ts line 187
const COLYSEUS_ROOM_ID_REGEX = /\/[a-zA-Z0-9_-]+\/([a-zA-Z0-9_-]+)$/;

/** Replicate the stripping logic from PatchedBunWebSockets.onConnection */
function stripQueryParams(url: string): string {
  const qIdx = url.indexOf("?");
  return qIdx !== -1 ? url.substring(0, qIdx) : url;
}

describe("PatchedBunWebSockets query-string stripping", () => {
  test("Colyseus regex fails on URL with query params (the bug)", () => {
    const urlWithQuery = "/-OUEZ1BO_/gWl8SXbPE?sessionId=AgyDrIwqw";
    const match = urlWithQuery.match(COLYSEUS_ROOM_ID_REGEX);
    expect(match).toBeNull();
  });

  test("Colyseus regex succeeds after stripping query params (the fix)", () => {
    const urlWithQuery = "/-OUEZ1BO_/gWl8SXbPE?sessionId=AgyDrIwqw";
    const stripped = stripQueryParams(urlWithQuery);
    const match = stripped.match(COLYSEUS_ROOM_ID_REGEX);
    expect(match).not.toBeNull();
    expect(match![1]).toBe("gWl8SXbPE");
  });

  test("stripping is a no-op when URL has no query params", () => {
    const url = "/-OUEZ1BO_/gWl8SXbPE";
    expect(stripQueryParams(url)).toBe(url);

    const match = url.match(COLYSEUS_ROOM_ID_REGEX);
    expect(match).not.toBeNull();
    expect(match![1]).toBe("gWl8SXbPE");
  });

  test("handles multiple query params", () => {
    const url = "/processId/roomId?sessionId=abc&foo=bar";
    const stripped = stripQueryParams(url);
    expect(stripped).toBe("/processId/roomId");

    const match = stripped.match(COLYSEUS_ROOM_ID_REGEX);
    expect(match).not.toBeNull();
    expect(match![1]).toBe("roomId");
  });

  test("handles query param with special Colyseus IDs", () => {
    const url = "/abc-DEF_123/room_id-456?sessionId=sess-xyz_789";
    const stripped = stripQueryParams(url);
    const match = stripped.match(COLYSEUS_ROOM_ID_REGEX);
    expect(match).not.toBeNull();
    expect(match![1]).toBe("room_id-456");
  });
});
