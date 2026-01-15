import { and, count, desc, eq, gt, lt } from "drizzle-orm";

import { db } from "../../db";
import {
  type PlayerTier,
  playerRatings,
  ratingHistory,
  seasonRankings,
  seasons,
  users,
} from "../../db/schema";

export const rankingsRepository = {
  async getPlayerRating(userId: number) {
    return db.query.playerRatings.findFirst({
      where: eq(playerRatings.userId, userId),
    });
  },

  async createPlayerRating(userId: number, seasonId?: number) {
    const [rating] = await db
      .insert(playerRatings)
      .values({
        userId,
        rating: 1000,
        peakRating: 1000,
        gamesRated: 0,
        tier: "bronze",
        seasonId,
      })
      .returning();

    return rating;
  },

  async updatePlayerRating(
    userId: number,
    data: {
      rating: number;
      peakRating?: number;
      gamesRated?: number;
      tier?: PlayerTier;
      lastActivityAt?: Date;
    }
  ) {
    const [updated] = await db
      .update(playerRatings)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(playerRatings.userId, userId))
      .returning();

    return updated;
  },

  async getLeaderboard(options: {
    limit?: number;
    offset?: number;
    tier?: PlayerTier;
  }) {
    const { limit = 20, offset = 0, tier } = options;

    const conditions = tier ? [eq(playerRatings.tier, tier)] : [];

    const ratings = await db
      .select({
        id: playerRatings.id,
        userId: playerRatings.userId,
        rating: playerRatings.rating,
        tier: playerRatings.tier,
        gamesRated: playerRatings.gamesRated,
        peakRating: playerRatings.peakRating,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
      })
      .from(playerRatings)
      .innerJoin(users, eq(playerRatings.userId, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(playerRatings.rating))
      .limit(limit)
      .offset(offset);

    return ratings;
  },

  async getLeaderboardCount(tier?: PlayerTier) {
    const conditions = tier ? [eq(playerRatings.tier, tier)] : [];

    const [result] = await db
      .select({ count: count() })
      .from(playerRatings)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    return result?.count ?? 0;
  },

  async getUserRank(userId: number, rating: number) {
    const [result] = await db
      .select({ count: count() })
      .from(playerRatings)
      .where(gt(playerRatings.rating, rating));

    return (result?.count ?? 0) + 1;
  },

  async createRatingHistoryEntry(data: {
    userId: number;
    matchId: number;
    ratingBefore: number;
    ratingAfter: number;
    ratingChange: number;
  }) {
    const [entry] = await db.insert(ratingHistory).values(data).returning();

    return entry;
  },

  async getRatingHistory(
    userId: number,
    options: { limit?: number; offset?: number } = {}
  ) {
    const { limit = 20, offset = 0 } = options;

    return db.query.ratingHistory.findMany({
      where: eq(ratingHistory.userId, userId),
      orderBy: [desc(ratingHistory.createdAt)],
      limit,
      offset,
    });
  },

  async getRatingHistoryCount(userId: number) {
    const [result] = await db
      .select({ count: count() })
      .from(ratingHistory)
      .where(eq(ratingHistory.userId, userId));

    return result?.count ?? 0;
  },

  async getActiveSeason() {
    return db.query.seasons.findFirst({
      where: eq(seasons.isActive, true),
    });
  },

  async getSeasons() {
    return db.query.seasons.findMany({
      orderBy: [desc(seasons.startDate)],
    });
  },

  async getSeasonById(seasonId: number) {
    return db.query.seasons.findFirst({
      where: eq(seasons.id, seasonId),
    });
  },

  async createSeason(data: { name: string; startDate: Date; endDate: Date }) {
    // Deactivate current active season
    await db
      .update(seasons)
      .set({ isActive: false })
      .where(eq(seasons.isActive, true));

    const [season] = await db
      .insert(seasons)
      .values({
        ...data,
        isActive: true,
      })
      .returning();

    return season;
  },

  async endSeason(seasonId: number) {
    const [updated] = await db
      .update(seasons)
      .set({ isActive: false })
      .where(eq(seasons.id, seasonId))
      .returning();

    return updated;
  },

  async getSeasonRankings(seasonId: number) {
    return db
      .select({
        userId: seasonRankings.userId,
        finalRating: seasonRankings.finalRating,
        finalRank: seasonRankings.finalRank,
        tier: seasonRankings.tier,
        gamesPlayed: seasonRankings.gamesPlayed,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
      })
      .from(seasonRankings)
      .innerJoin(users, eq(seasonRankings.userId, users.id))
      .where(eq(seasonRankings.seasonId, seasonId))
      .orderBy(seasonRankings.finalRank);
  },

  async createSeasonRanking(data: {
    userId: number;
    seasonId: number;
    finalRating: number;
    finalRank: number;
    tier: string;
    gamesPlayed: number;
  }) {
    const [ranking] = await db.insert(seasonRankings).values(data).returning();

    return ranking;
  },

  async getInactivePlayers(daysSinceActivity: number, ratingFloor: number) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysSinceActivity);

    return db.query.playerRatings.findMany({
      where: and(
        lt(playerRatings.lastActivityAt, cutoffDate),
        gt(playerRatings.rating, ratingFloor)
      ),
    });
  },

  async getTopPlayers(limit: number) {
    return db
      .select({
        userId: playerRatings.userId,
        rating: playerRatings.rating,
        tier: playerRatings.tier,
        gamesRated: playerRatings.gamesRated,
        peakRating: playerRatings.peakRating,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
      })
      .from(playerRatings)
      .innerJoin(users, eq(playerRatings.userId, users.id))
      .orderBy(desc(playerRatings.rating))
      .limit(limit);
  },

  async getAllPlayerRatingsForSeason() {
    return db
      .select({
        userId: playerRatings.userId,
        rating: playerRatings.rating,
        tier: playerRatings.tier,
        gamesRated: playerRatings.gamesRated,
      })
      .from(playerRatings)
      .orderBy(desc(playerRatings.rating));
  },
};
