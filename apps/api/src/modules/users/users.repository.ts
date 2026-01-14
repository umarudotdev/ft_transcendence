import { and, count, desc, eq, or, sql } from "drizzle-orm";

import { db } from "../../db";
import {
  type FriendshipStatus,
  friends,
  matches,
  users,
} from "../../db/schema";

export const usersRepository = {
  async findById(id: number) {
    return db.query.users.findFirst({
      where: eq(users.id, id),
    });
  },

  async findByDisplayName(displayName: string) {
    return db.query.users.findFirst({
      where: eq(users.displayName, displayName),
    });
  },

  async updateProfile(
    id: number,
    data: { displayName?: string; avatarUrl?: string | null }
  ) {
    const [updated] = await db
      .update(users)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();

    return updated;
  },

  async updateAvatarUrl(userId: number, avatarUrl: string | null) {
    const [updated] = await db
      .update(users)
      .set({
        avatarUrl,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();

    return updated;
  },

  async getMatchHistory(
    userId: number,
    options: {
      limit?: number;
      offset?: number;
      gameType?: string;
    } = {}
  ) {
    const { limit = 10, offset = 0, gameType } = options;

    const conditions = [
      or(eq(matches.player1Id, userId), eq(matches.player2Id, userId)),
    ];

    if (gameType) {
      conditions.push(eq(matches.gameType, gameType));
    }

    const matchList = await db.query.matches.findMany({
      where: and(...conditions),
      orderBy: [desc(matches.createdAt)],
      limit: Math.min(limit, 100),
      offset,
      with: {
        player1: {
          columns: {
            id: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        player2: {
          columns: {
            id: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        winner: {
          columns: {
            id: true,
            displayName: true,
          },
        },
      },
    });

    return matchList;
  },

  async getMatchHistoryCount(userId: number, gameType?: string) {
    const conditions = [
      or(eq(matches.player1Id, userId), eq(matches.player2Id, userId)),
    ];

    if (gameType) {
      conditions.push(eq(matches.gameType, gameType));
    }

    const [result] = await db
      .select({ count: count() })
      .from(matches)
      .where(and(...conditions));

    return result?.count ?? 0;
  },

  async getStats(userId: number, gameType?: string) {
    const baseCondition = or(
      eq(matches.player1Id, userId),
      eq(matches.player2Id, userId)
    );

    const conditions = gameType
      ? and(baseCondition, eq(matches.gameType, gameType))
      : baseCondition;

    const [totalGames] = await db
      .select({ count: count() })
      .from(matches)
      .where(conditions);

    const winConditions = gameType
      ? and(eq(matches.winnerId, userId), eq(matches.gameType, gameType))
      : eq(matches.winnerId, userId);

    const [wins] = await db
      .select({ count: count() })
      .from(matches)
      .where(winConditions);

    const lossConditions = gameType
      ? and(
          baseCondition,
          sql`${matches.winnerId} IS NOT NULL`,
          sql`${matches.winnerId} != ${userId}`,
          eq(matches.gameType, gameType)
        )
      : and(
          baseCondition,
          sql`${matches.winnerId} IS NOT NULL`,
          sql`${matches.winnerId} != ${userId}`
        );

    const [losses] = await db
      .select({ count: count() })
      .from(matches)
      .where(lossConditions);

    const [avgDuration] = await db
      .select({ avg: sql<number>`AVG(${matches.duration})` })
      .from(matches)
      .where(conditions);

    const gamesPlayed = totalGames?.count ?? 0;
    const winsCount = wins?.count ?? 0;
    const lossesCount = losses?.count ?? 0;
    const drawsCount = gamesPlayed - winsCount - lossesCount;

    return {
      gamesPlayed,
      wins: winsCount,
      losses: lossesCount,
      draws: drawsCount,
      winRate: gamesPlayed > 0 ? (winsCount / gamesPlayed) * 100 : 0,
      averageDuration: avgDuration?.avg ?? 0,
    };
  },

  async getFriends(userId: number) {
    const friendships = await db.query.friends.findMany({
      where: and(
        or(eq(friends.userId, userId), eq(friends.friendId, userId)),
        eq(friends.status, "accepted")
      ),
      with: {
        user: {
          columns: {
            id: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        friend: {
          columns: {
            id: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });

    return friendships.map((f) => ({
      friendshipId: f.id,
      ...(f.userId === userId ? f.friend : f.user),
      since: f.createdAt,
    }));
  },

  async getPendingRequests(userId: number) {
    const requests = await db.query.friends.findMany({
      where: and(eq(friends.friendId, userId), eq(friends.status, "pending")),
      with: {
        user: {
          columns: {
            id: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });

    return requests.map((r) => ({
      requestId: r.id,
      from: r.user,
      createdAt: r.createdAt,
    }));
  },

  async getSentRequests(userId: number) {
    const requests = await db.query.friends.findMany({
      where: and(eq(friends.userId, userId), eq(friends.status, "pending")),
      with: {
        friend: {
          columns: {
            id: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });

    return requests.map((r) => ({
      requestId: r.id,
      to: r.friend,
      createdAt: r.createdAt,
    }));
  },

  async getFriendship(userId: number, friendId: number) {
    return db.query.friends.findFirst({
      where: or(
        and(eq(friends.userId, userId), eq(friends.friendId, friendId)),
        and(eq(friends.userId, friendId), eq(friends.friendId, userId))
      ),
    });
  },

  async createFriendRequest(userId: number, friendId: number) {
    const [request] = await db
      .insert(friends)
      .values({
        userId,
        friendId,
        status: "pending",
      })
      .returning();

    return request;
  },

  async updateFriendshipStatus(friendshipId: number, status: FriendshipStatus) {
    const [updated] = await db
      .update(friends)
      .set({ status })
      .where(eq(friends.id, friendshipId))
      .returning();

    return updated;
  },

  async deleteFriendship(friendshipId: number) {
    await db.delete(friends).where(eq(friends.id, friendshipId));
  },

  async getBlockedUsers(userId: number) {
    const blocked = await db.query.friends.findMany({
      where: and(eq(friends.userId, userId), eq(friends.status, "blocked")),
      with: {
        friend: {
          columns: {
            id: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });

    return blocked.map((b) => ({
      id: b.id,
      user: b.friend,
      blockedAt: b.createdAt,
    }));
  },

  async searchUsers(query: string, currentUserId: number, limit = 10) {
    return db.query.users.findMany({
      where: and(
        sql`${users.displayName} ILIKE ${`%${query}%`}`,
        sql`${users.id} != ${currentUserId}`
      ),
      limit,
      columns: {
        id: true,
        displayName: true,
        avatarUrl: true,
      },
    });
  },
};
