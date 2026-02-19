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

  /** Atomically mark a session as finished only if it's not already finished.
   *  Returns the updated session, or undefined if not found or already finished. */
  async finishGameSession(id: string) {
    const [session] = await db
      .update(gameSessions)
      .set({ state: "finished", endedAt: new Date() })
      .where(and(eq(gameSessions.id, id), ne(gameSessions.state, "finished")))
      .returning();
    return session;
  },

  // --- Matches ---

  async createMatch(data: {
    player1Id: number;
    player2Id: number;
    player1Score: number;
    player2Score: number;
    winnerId: number | null;
    gameType: string;
    isAiGame: boolean;
    duration: number;
    sessionId?: string;
  }) {
    const [match] = await db.insert(matches).values(data).returning();
    return match;
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
