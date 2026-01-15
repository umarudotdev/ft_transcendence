import { err, ok, ResultAsync } from "neverthrow";

import type { PlayerTier } from "../../db/schema";
import type {
  LeaderboardEntry,
  PlayerRanking,
  RatingHistoryEntry,
  RankingError,
  Season,
  SeasonRankingEntry,
} from "./rankings.model";

import { rankingsRepository } from "./rankings.repository";

abstract class RankingsService {
  // Elo calculation constants
  private static readonly K_FACTOR = 32;
  private static readonly INITIAL_RATING = 1000;
  private static readonly DECAY_DAYS = 14;
  private static readonly DECAY_AMOUNT = 10;
  private static readonly DECAY_FLOOR = 800;

  // Tier thresholds
  private static readonly TIER_THRESHOLDS: Record<PlayerTier, number> = {
    bronze: 0,
    silver: 800,
    gold: 1200,
    platinum: 1600,
  };

  /**
   * Calculate expected score for Elo formula.
   */
  private static calculateExpectedScore(
    playerRating: number,
    opponentRating: number
  ): number {
    return 1 / (1 + 10 ** ((opponentRating - playerRating) / 400));
  }

  /**
   * Calculate new Elo rating.
   */
  private static calculateNewRating(
    currentRating: number,
    expectedScore: number,
    actualScore: number
  ): number {
    return Math.round(
      currentRating + RankingsService.K_FACTOR * (actualScore - expectedScore)
    );
  }

  /**
   * Determine tier based on rating.
   */
  static getTierFromRating(rating: number): PlayerTier {
    if (rating >= RankingsService.TIER_THRESHOLDS.platinum) {
      return "platinum";
    }
    if (rating >= RankingsService.TIER_THRESHOLDS.gold) {
      return "gold";
    }
    if (rating >= RankingsService.TIER_THRESHOLDS.silver) {
      return "silver";
    }
    return "bronze";
  }

  /**
   * Calculate Elo change for a match result.
   */
  static calculateEloChange(
    playerRating: number,
    opponentRating: number,
    won: boolean
  ): number {
    const expectedScore = RankingsService.calculateExpectedScore(
      playerRating,
      opponentRating
    );
    const actualScore = won ? 1 : 0;
    const newRating = RankingsService.calculateNewRating(
      playerRating,
      expectedScore,
      actualScore
    );

    return newRating - playerRating;
  }

  /**
   * Get or create player rating.
   */
  static getOrCreatePlayerRating(
    userId: number
  ): ResultAsync<PlayerRanking, never> {
    return ResultAsync.fromPromise(
      (async () => {
        let rating = await rankingsRepository.getPlayerRating(userId);

        if (!rating) {
          const activeSeason = await rankingsRepository.getActiveSeason();
          rating = await rankingsRepository.createPlayerRating(
            userId,
            activeSeason?.id
          );
        }

        const rank = await rankingsRepository.getUserRank(
          userId,
          rating.rating
        );

        return {
          userId: rating.userId,
          rating: rating.rating,
          tier: rating.tier as PlayerTier,
          rank,
          gamesRated: rating.gamesRated,
          peakRating: rating.peakRating,
          lastActivityAt: rating.lastActivityAt,
        };
      })(),
      (): never => {
        throw new Error("Unexpected error getting player rating");
      }
    );
  }

  /**
   * Update ratings after a match.
   */
  static updateRatingsAfterMatch(
    matchId: number,
    player1Id: number,
    player2Id: number,
    winnerId: number | null
  ): ResultAsync<
    { player1Change: number; player2Change: number },
    RankingError
  > {
    return ResultAsync.fromPromise(
      (async () => {
        // Get or create ratings for both players
        let player1Rating = await rankingsRepository.getPlayerRating(player1Id);
        let player2Rating = await rankingsRepository.getPlayerRating(player2Id);

        if (!player1Rating) {
          const activeSeason = await rankingsRepository.getActiveSeason();
          player1Rating = await rankingsRepository.createPlayerRating(
            player1Id,
            activeSeason?.id
          );
        }

        if (!player2Rating) {
          const activeSeason = await rankingsRepository.getActiveSeason();
          player2Rating = await rankingsRepository.createPlayerRating(
            player2Id,
            activeSeason?.id
          );
        }

        // Calculate rating changes
        const player1Won = winnerId === player1Id;
        const player2Won = winnerId === player2Id;
        const isDraw = winnerId === null;

        let player1Change: number;
        let player2Change: number;

        if (isDraw) {
          // For draws, use 0.5 as actual score
          const expected1 = RankingsService.calculateExpectedScore(
            player1Rating.rating,
            player2Rating.rating
          );
          const expected2 = RankingsService.calculateExpectedScore(
            player2Rating.rating,
            player1Rating.rating
          );

          player1Change =
            RankingsService.calculateNewRating(
              player1Rating.rating,
              expected1,
              0.5
            ) - player1Rating.rating;
          player2Change =
            RankingsService.calculateNewRating(
              player2Rating.rating,
              expected2,
              0.5
            ) - player2Rating.rating;
        } else {
          player1Change = RankingsService.calculateEloChange(
            player1Rating.rating,
            player2Rating.rating,
            player1Won
          );
          player2Change = RankingsService.calculateEloChange(
            player2Rating.rating,
            player1Rating.rating,
            player2Won
          );
        }

        // Update player 1
        const newRating1 = player1Rating.rating + player1Change;
        const newTier1 = RankingsService.getTierFromRating(newRating1);
        await rankingsRepository.updatePlayerRating(player1Id, {
          rating: newRating1,
          peakRating: Math.max(player1Rating.peakRating, newRating1),
          gamesRated: player1Rating.gamesRated + 1,
          tier: newTier1,
          lastActivityAt: new Date(),
        });

        // Update player 2
        const newRating2 = player2Rating.rating + player2Change;
        const newTier2 = RankingsService.getTierFromRating(newRating2);
        await rankingsRepository.updatePlayerRating(player2Id, {
          rating: newRating2,
          peakRating: Math.max(player2Rating.peakRating, newRating2),
          gamesRated: player2Rating.gamesRated + 1,
          tier: newTier2,
          lastActivityAt: new Date(),
        });

        // Record history for both players
        await rankingsRepository.createRatingHistoryEntry({
          userId: player1Id,
          matchId,
          ratingBefore: player1Rating.rating,
          ratingAfter: newRating1,
          ratingChange: player1Change,
        });

        await rankingsRepository.createRatingHistoryEntry({
          userId: player2Id,
          matchId,
          ratingBefore: player2Rating.rating,
          ratingAfter: newRating2,
          ratingChange: player2Change,
        });

        return ok({ player1Change, player2Change });
      })(),
      () => ({ type: "MATCH_NOT_FOUND" as const })
    ).andThen((result) => result);
  }

  /**
   * Get leaderboard with pagination.
   */
  static getLeaderboard(options: {
    limit?: number;
    offset?: number;
    tier?: PlayerTier;
  }): ResultAsync<
    { entries: LeaderboardEntry[]; total: number; hasMore: boolean },
    never
  > {
    return ResultAsync.fromPromise(
      (async () => {
        const { limit = 20, offset = 0, tier } = options;

        const ratings = await rankingsRepository.getLeaderboard({
          limit: limit + 1,
          offset,
          tier,
        });

        const total = await rankingsRepository.getLeaderboardCount(tier);

        const hasMore = ratings.length > limit;
        const ratingsToReturn = hasMore ? ratings.slice(0, limit) : ratings;

        const entries: LeaderboardEntry[] = ratingsToReturn.map(
          (rating, index) => ({
            rank: offset + index + 1,
            userId: rating.userId,
            displayName: rating.displayName,
            avatarUrl: rating.avatarUrl,
            rating: rating.rating,
            tier: rating.tier,
            gamesRated: rating.gamesRated,
            peakRating: rating.peakRating,
          })
        );

        return { entries, total, hasMore };
      })(),
      (): never => {
        throw new Error("Unexpected error fetching leaderboard");
      }
    );
  }

  /**
   * Get top players (e.g., for homepage).
   */
  static getTopPlayers(limit = 10): ResultAsync<LeaderboardEntry[], never> {
    return ResultAsync.fromPromise(
      (async () => {
        const ratings = await rankingsRepository.getTopPlayers(limit);

        return ratings.map((rating, index) => ({
          rank: index + 1,
          userId: rating.userId,
          displayName: rating.displayName,
          avatarUrl: rating.avatarUrl,
          rating: rating.rating,
          tier: rating.tier,
          gamesRated: rating.gamesRated,
          peakRating: rating.peakRating,
        }));
      })(),
      (): never => {
        throw new Error("Unexpected error fetching top players");
      }
    );
  }

  /**
   * Get user's ranking info.
   */
  static getUserRanking(
    userId: number
  ): ResultAsync<PlayerRanking | null, never> {
    return ResultAsync.fromPromise(
      (async () => {
        const rating = await rankingsRepository.getPlayerRating(userId);

        if (!rating) {
          return null;
        }

        const rank = await rankingsRepository.getUserRank(
          userId,
          rating.rating
        );

        return {
          userId: rating.userId,
          rating: rating.rating,
          tier: rating.tier as PlayerTier,
          rank,
          gamesRated: rating.gamesRated,
          peakRating: rating.peakRating,
          lastActivityAt: rating.lastActivityAt,
        };
      })(),
      (): never => {
        throw new Error("Unexpected error fetching user ranking");
      }
    );
  }

  /**
   * Get rating history for a user.
   */
  static getRatingHistory(
    userId: number,
    options: { limit?: number; offset?: number } = {}
  ): ResultAsync<
    { entries: RatingHistoryEntry[]; total: number; hasMore: boolean },
    never
  > {
    return ResultAsync.fromPromise(
      (async () => {
        const { limit = 20, offset = 0 } = options;

        const history = await rankingsRepository.getRatingHistory(userId, {
          limit: limit + 1,
          offset,
        });

        const total = await rankingsRepository.getRatingHistoryCount(userId);

        const hasMore = history.length > limit;
        const historyToReturn = hasMore ? history.slice(0, limit) : history;

        const entries: RatingHistoryEntry[] = historyToReturn.map((entry) => ({
          id: entry.id,
          matchId: entry.matchId,
          ratingBefore: entry.ratingBefore,
          ratingAfter: entry.ratingAfter,
          ratingChange: entry.ratingChange,
          createdAt: entry.createdAt,
        }));

        return { entries, total, hasMore };
      })(),
      (): never => {
        throw new Error("Unexpected error fetching rating history");
      }
    );
  }

  /**
   * Apply time decay to inactive players.
   */
  static applyTimeDecay(): ResultAsync<number, never> {
    return ResultAsync.fromPromise(
      (async () => {
        const inactivePlayers = await rankingsRepository.getInactivePlayers(
          RankingsService.DECAY_DAYS,
          RankingsService.DECAY_FLOOR
        );

        let decayedCount = 0;

        for (const player of inactivePlayers) {
          const newRating = Math.max(
            player.rating - RankingsService.DECAY_AMOUNT,
            RankingsService.DECAY_FLOOR
          );
          const newTier = RankingsService.getTierFromRating(newRating);

          await rankingsRepository.updatePlayerRating(player.userId, {
            rating: newRating,
            tier: newTier,
          });

          decayedCount++;
        }

        return decayedCount;
      })(),
      (): never => {
        throw new Error("Unexpected error applying time decay");
      }
    );
  }

  /**
   * Get all seasons.
   */
  static getSeasons(): ResultAsync<Season[], never> {
    return ResultAsync.fromPromise(
      (async () => {
        const seasonList = await rankingsRepository.getSeasons();

        return seasonList.map((s) => ({
          id: s.id,
          name: s.name,
          startDate: s.startDate,
          endDate: s.endDate,
          isActive: s.isActive,
        }));
      })(),
      (): never => {
        throw new Error("Unexpected error fetching seasons");
      }
    );
  }

  /**
   * Get current active season.
   */
  static getCurrentSeason(): ResultAsync<Season | null, never> {
    return ResultAsync.fromPromise(
      (async () => {
        const season = await rankingsRepository.getActiveSeason();

        if (!season) {
          return null;
        }

        return {
          id: season.id,
          name: season.name,
          startDate: season.startDate,
          endDate: season.endDate,
          isActive: season.isActive,
        };
      })(),
      (): never => {
        throw new Error("Unexpected error fetching current season");
      }
    );
  }

  /**
   * Get season results.
   */
  static getSeasonResults(
    seasonId: number
  ): ResultAsync<SeasonRankingEntry[], RankingError> {
    return ResultAsync.fromPromise(
      (async () => {
        const season = await rankingsRepository.getSeasonById(seasonId);

        if (!season) {
          return err({ type: "SEASON_NOT_FOUND" as const });
        }

        const rankings = await rankingsRepository.getSeasonRankings(seasonId);

        return ok(
          rankings.map((r) => ({
            userId: r.userId,
            displayName: r.displayName,
            avatarUrl: r.avatarUrl,
            finalRating: r.finalRating,
            finalRank: r.finalRank,
            tier: r.tier,
            gamesPlayed: r.gamesPlayed,
          }))
        );
      })(),
      () => ({ type: "SEASON_NOT_FOUND" as const })
    ).andThen((result) => result);
  }

  /**
   * End current season and start a new one.
   */
  static endSeasonAndStartNew(
    newSeasonName: string,
    endDate: Date
  ): ResultAsync<{ endedSeason: Season; newSeason: Season }, RankingError> {
    return ResultAsync.fromPromise(
      (async () => {
        const currentSeason = await rankingsRepository.getActiveSeason();

        if (!currentSeason) {
          return err({ type: "SEASON_NOT_FOUND" as const });
        }

        // Snapshot current rankings
        const allRatings =
          await rankingsRepository.getAllPlayerRatingsForSeason();

        for (const [index, rating] of allRatings.entries()) {
          await rankingsRepository.createSeasonRanking({
            userId: rating.userId,
            seasonId: currentSeason.id,
            finalRating: rating.rating,
            finalRank: index + 1,
            tier: rating.tier,
            gamesPlayed: rating.gamesRated,
          });
        }

        // End current season
        await rankingsRepository.endSeason(currentSeason.id);

        // Create new season
        const startDate = new Date();
        const newSeason = await rankingsRepository.createSeason({
          name: newSeasonName,
          startDate,
          endDate,
        });

        return ok({
          endedSeason: {
            id: currentSeason.id,
            name: currentSeason.name,
            startDate: currentSeason.startDate,
            endDate: currentSeason.endDate,
            isActive: false,
          },
          newSeason: {
            id: newSeason.id,
            name: newSeason.name,
            startDate: newSeason.startDate,
            endDate: newSeason.endDate,
            isActive: newSeason.isActive,
          },
        });
      })(),
      () => ({ type: "SEASON_NOT_FOUND" as const })
    ).andThen((result) => result);
  }
}

export { RankingsService };
