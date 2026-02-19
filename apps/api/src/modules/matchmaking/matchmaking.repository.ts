import { and, eq, ne } from "drizzle-orm";

import { db } from "../../db";
import {
  gameSessions,
  matches,
  matchmakingQueue,
  type NewGameSession,
} from "../../db/schema";

export const matchmakingRepository = {
  // --- Game Sessions ---

  async createGameSession(data: NewGameSession) {
    const [session] = await db.insert(gameSessions).values(data).returning();
    return session;
  },

  async updateGameSession(
    id: string,
    data: Partial<{
      state: string;
      roomId: string;
      startedAt: Date;
      endedAt: Date;
    }>
  ) {
    const [session] = await db
      .update(gameSessions)
      .set(data)
      .where(eq(gameSessions.id, id))
      .returning();
    return session;
  },

  async getGameSession(id: string) {
    return db.query.gameSessions.findFirst({
      where: eq(gameSessions.id, id),
    });
  },

  /** Atomically finish a session and create a match record in a single transaction.
   *  Returns null if the session is not found or already in a terminal state. */
  async completeGameSession(
    sessionId: string,
    matchData: {
      player1Id: number;
      player2Id: number;
      player1Score: number;
      player2Score: number;
      winnerId: number | null;
      gameType: string;
      isAiGame: boolean;
      duration: number;
    }
  ) {
    return db.transaction(async (tx) => {
      const [session] = await tx
        .update(gameSessions)
        .set({ state: "finished", endedAt: new Date() })
        .where(
          and(
            eq(gameSessions.id, sessionId),
            ne(gameSessions.state, "finished"),
            ne(gameSessions.state, "abandoned")
          )
        )
        .returning();

      if (!session) return null;

      const [match] = await tx
        .insert(matches)
        .values({ ...matchData, sessionId })
        .returning();

      return { session, match };
    });
  },

  // --- Matchmaking Queue (crash recovery) ---

  async addToQueue(data: { userId: number; mode: string; rating: number }) {
    const [entry] = await db
      .insert(matchmakingQueue)
      .values(data)
      .onConflictDoUpdate({
        target: matchmakingQueue.userId,
        set: { mode: data.mode, rating: data.rating, queuedAt: new Date() },
      })
      .returning();
    return entry;
  },

  async removeFromQueue(userId: number) {
    await db
      .delete(matchmakingQueue)
      .where(eq(matchmakingQueue.userId, userId));
  },

  async getQueueEntries() {
    return db.query.matchmakingQueue.findMany({
      orderBy: (q, { asc }) => [asc(q.queuedAt)],
    });
  },

  async clearQueue() {
    await db.delete(matchmakingQueue);
  },
};
