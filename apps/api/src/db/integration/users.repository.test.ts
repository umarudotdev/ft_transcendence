/**
 * Integration tests for users repository (profiles, matches, friends).
 *
 * Run tests: bun test src/db/integration/
 */

import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  test,
} from "bun:test";
import { and, eq, or, sql } from "drizzle-orm";

import * as schema from "../schema";
import {
  cleanDatabase,
  createTestDb,
  createTestFriendship,
  createTestMatch,
  createTestUser,
  resetSequences,
} from "../test-utils";

describe("Users Repository Integration Tests", () => {
  const { db, close } = createTestDb();

  beforeAll(async () => {
    await cleanDatabase(db);
    await resetSequences(db);
  });

  afterEach(async () => {
    await cleanDatabase(db);
    await resetSequences(db);
  });

  afterAll(async () => {
    await close();
  });

  describe("Matches CRUD", () => {
    test("creates a match between two players", async () => {
      const player1 = await createTestUser(db, { username: "player1" });
      const player2 = await createTestUser(db, { username: "player2" });

      const [match] = await db
        .insert(schema.matches)
        .values({
          player1Id: player1.id,
          player2Id: player2.id,
          player1Score: 11,
          player2Score: 7,
          winnerId: player1.id,
          duration: 420,
          gameType: "pong",
        })
        .returning();

      expect(match.player1Id).toBe(player1.id);
      expect(match.player2Id).toBe(player2.id);
      expect(match.winnerId).toBe(player1.id);
      expect(match.duration).toBe(420);
      expect(match.isAiGame).toBe(false);
    });

    test("creates an AI match (single player)", async () => {
      const player = await createTestUser(db);

      const [match] = await db
        .insert(schema.matches)
        .values({
          player1Id: player.id,
          player2Id: null,
          player1Score: 11,
          player2Score: 3,
          winnerId: player.id,
          duration: 180,
          isAiGame: true,
        })
        .returning();

      expect(match.player2Id).toBeNull();
      expect(match.isAiGame).toBe(true);
    });

    test("retrieves match with player relations", async () => {
      const player1 = await createTestUser(db, { displayName: "Alice" });
      const player2 = await createTestUser(db, { displayName: "Bob" });
      const match = await createTestMatch(db, player1.id, player2.id);

      const found = await db.query.matches.findFirst({
        where: eq(schema.matches.id, match.id),
        with: {
          player1: { columns: { id: true, displayName: true } },
          player2: { columns: { id: true, displayName: true } },
          winner: { columns: { id: true, displayName: true } },
        },
      });

      expect(found?.player1.displayName).toBe("Alice");
      expect(found?.player2?.displayName).toBe("Bob");
    });

    test("queries match history for a user", async () => {
      const user = await createTestUser(db);
      const opponent1 = await createTestUser(db);
      const opponent2 = await createTestUser(db);

      await createTestMatch(db, user.id, opponent1.id);
      await createTestMatch(db, opponent2.id, user.id); // User is player2
      await createTestMatch(db, user.id, null, { isAiGame: true });

      const userMatches = await db.query.matches.findMany({
        where: or(
          eq(schema.matches.player1Id, user.id),
          eq(schema.matches.player2Id, user.id)
        ),
      });

      expect(userMatches.length).toBe(3);
    });

    test("stores match metadata as JSON string", async () => {
      const player = await createTestUser(db);

      const metadata = JSON.stringify({
        paddleSpeed: 10,
        ballSpeed: 8,
        powerUpsEnabled: true,
      });

      const [match] = await db
        .insert(schema.matches)
        .values({
          player1Id: player.id,
          player2Id: null,
          player1Score: 11,
          player2Score: 0,
          duration: 60,
          metadata,
        })
        .returning();

      expect(match.metadata).toBe(metadata);
      expect(JSON.parse(match.metadata!).powerUpsEnabled).toBe(true);
    });

    test("sets winnerId to null on user deletion (SET NULL)", async () => {
      const player1 = await createTestUser(db);
      const player2 = await createTestUser(db);

      const match = await createTestMatch(db, player1.id, player2.id, {
        winnerId: player1.id,
      });

      // Delete the winner
      await db.delete(schema.users).where(eq(schema.users.id, player1.id));

      const found = await db.query.matches.findFirst({
        where: eq(schema.matches.id, match.id),
      });

      // Match should still exist but winnerId should be null
      expect(found).toBeDefined();
      expect(found?.winnerId).toBeNull();
    });
  });

  describe("Friends CRUD", () => {
    test("creates a pending friend request", async () => {
      const user = await createTestUser(db, { username: "sender" });
      const friend = await createTestUser(db, { username: "receiver" });

      const [request] = await db
        .insert(schema.friends)
        .values({
          userId: user.id,
          friendId: friend.id,
          status: "pending",
        })
        .returning();

      expect(request.userId).toBe(user.id);
      expect(request.friendId).toBe(friend.id);
      expect(request.status).toBe("pending");
    });

    test("accepts a friend request", async () => {
      const user = await createTestUser(db);
      const friend = await createTestUser(db);

      const request = await createTestFriendship(
        db,
        user.id,
        friend.id,
        "pending"
      );

      const [updated] = await db
        .update(schema.friends)
        .set({ status: "accepted" })
        .where(eq(schema.friends.id, request.id))
        .returning();

      expect(updated.status).toBe("accepted");
    });

    test("blocks a user", async () => {
      const user = await createTestUser(db);
      const blocked = await createTestUser(db);

      const [block] = await db
        .insert(schema.friends)
        .values({
          userId: user.id,
          friendId: blocked.id,
          status: "blocked",
        })
        .returning();

      expect(block.status).toBe("blocked");
    });

    test("retrieves friends with user relations", async () => {
      const user = await createTestUser(db, { displayName: "Main User" });
      const friend1 = await createTestUser(db, { displayName: "Friend One" });
      const friend2 = await createTestUser(db, { displayName: "Friend Two" });

      await createTestFriendship(db, user.id, friend1.id, "accepted");
      await createTestFriendship(db, friend2.id, user.id, "accepted"); // Reverse direction

      const friendships = await db.query.friends.findMany({
        where: and(
          or(
            eq(schema.friends.userId, user.id),
            eq(schema.friends.friendId, user.id)
          ),
          eq(schema.friends.status, "accepted")
        ),
        with: {
          user: { columns: { id: true, displayName: true } },
          friend: { columns: { id: true, displayName: true } },
        },
      });

      expect(friendships.length).toBe(2);
    });

    test("retrieves pending friend requests", async () => {
      const user = await createTestUser(db);
      const requester1 = await createTestUser(db, {
        displayName: "Requester 1",
      });
      const requester2 = await createTestUser(db, {
        displayName: "Requester 2",
      });

      await createTestFriendship(db, requester1.id, user.id, "pending");
      await createTestFriendship(db, requester2.id, user.id, "pending");

      const pending = await db.query.friends.findMany({
        where: and(
          eq(schema.friends.friendId, user.id),
          eq(schema.friends.status, "pending")
        ),
        with: {
          user: { columns: { id: true, displayName: true } },
        },
      });

      expect(pending.length).toBe(2);
    });

    test("deletes friendship (unfriend)", async () => {
      const user = await createTestUser(db);
      const friend = await createTestUser(db);

      const friendship = await createTestFriendship(db, user.id, friend.id);

      await db
        .delete(schema.friends)
        .where(eq(schema.friends.id, friendship.id));

      const found = await db.query.friends.findFirst({
        where: eq(schema.friends.id, friendship.id),
      });

      expect(found).toBeUndefined();
    });

    test("cascades deletion when user is deleted", async () => {
      const user = await createTestUser(db);
      const friend = await createTestUser(db);

      await createTestFriendship(db, user.id, friend.id);

      await db.delete(schema.users).where(eq(schema.users.id, user.id));

      const friendships = await db.query.friends.findMany({
        where: or(
          eq(schema.friends.userId, user.id),
          eq(schema.friends.friendId, user.id)
        ),
      });

      expect(friendships.length).toBe(0);
    });
  });

  describe("User Statistics Queries", () => {
    test("calculates win/loss stats", async () => {
      const user = await createTestUser(db);
      const opponent = await createTestUser(db);

      // User wins 3 games
      for (let i = 0; i < 3; i++) {
        await createTestMatch(db, user.id, opponent.id, { winnerId: user.id });
      }

      // User loses 2 games
      for (let i = 0; i < 2; i++) {
        await createTestMatch(db, user.id, opponent.id, {
          winnerId: opponent.id,
        });
      }

      // Count total games
      const [totalGames] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.matches)
        .where(
          or(
            eq(schema.matches.player1Id, user.id),
            eq(schema.matches.player2Id, user.id)
          )
        );

      // Count wins
      const [wins] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.matches)
        .where(eq(schema.matches.winnerId, user.id));

      expect(totalGames.count).toBe(5);
      expect(wins.count).toBe(3);
    });

    test("calculates average match duration", async () => {
      const user = await createTestUser(db);

      await createTestMatch(db, user.id, null, { duration: 100 });
      await createTestMatch(db, user.id, null, { duration: 200 });
      await createTestMatch(db, user.id, null, { duration: 300 });

      const [result] = await db
        .select({ avg: sql<number>`AVG(${schema.matches.duration})` })
        .from(schema.matches)
        .where(eq(schema.matches.player1Id, user.id));

      expect(result.avg).toBe(200);
    });

    test("filters stats by game type", async () => {
      const user = await createTestUser(db);

      await createTestMatch(db, user.id, null, { gameType: "pong" });
      await createTestMatch(db, user.id, null, { gameType: "pong" });
      await createTestMatch(db, user.id, null, { gameType: "custom" });

      const [pongGames] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.matches)
        .where(
          and(
            eq(schema.matches.player1Id, user.id),
            eq(schema.matches.gameType, "pong")
          )
        );

      expect(pongGames.count).toBe(2);
    });
  });

  describe("User Search", () => {
    test("searches users by display name (case insensitive)", async () => {
      await createTestUser(db, {
        displayName: "Alice Smith",
        username: "alice",
      });
      await createTestUser(db, { displayName: "Bob Jones", username: "bob" });
      await createTestUser(db, {
        displayName: "Alice Johnson",
        username: "alicej",
      });

      const results = await db.query.users.findMany({
        where: sql`${schema.users.displayName} ILIKE ${"alice%"}`,
        columns: { id: true, displayName: true, username: true },
      });

      expect(results.length).toBe(2);
      expect(
        results.every((r) => r.displayName.toLowerCase().startsWith("alice"))
      ).toBe(true);
    });

    test("searches users by username", async () => {
      await createTestUser(db, { username: "gamer123" });
      await createTestUser(db, { username: "gamer456" });
      await createTestUser(db, { username: "player789" });

      const results = await db.query.users.findMany({
        where: sql`${schema.users.username} ILIKE ${"gamer%"}`,
      });

      expect(results.length).toBe(2);
    });

    test("excludes current user from search results", async () => {
      const currentUser = await createTestUser(db, {
        displayName: "Test",
        username: "test",
      });
      await createTestUser(db, { displayName: "Tester", username: "tester" });

      const results = await db.query.users.findMany({
        where: and(
          sql`${schema.users.displayName} ILIKE ${"test%"}`,
          sql`${schema.users.id} != ${currentUser.id}`
        ),
      });

      expect(results.length).toBe(1);
      expect(results[0].id).not.toBe(currentUser.id);
    });
  });
});
