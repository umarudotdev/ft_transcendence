import { t } from "elysia";

import { badRequest, notFound } from "../../common/errors";

export const RankingsModel = {
  leaderboardQuery: t.Object({
    limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100, default: 20 })),
    offset: t.Optional(t.Numeric({ minimum: 0, default: 0 })),
    tier: t.Optional(
      t.Union([
        t.Literal("bronze"),
        t.Literal("silver"),
        t.Literal("gold"),
        t.Literal("platinum"),
      ])
    ),
  }),

  historyQuery: t.Object({
    limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100, default: 20 })),
    offset: t.Optional(t.Numeric({ minimum: 0, default: 0 })),
  }),

  userIdParam: t.Object({
    id: t.Numeric(),
  }),

  seasonIdParam: t.Object({
    seasonId: t.Numeric(),
  }),

  leaderboardEntry: t.Object({
    rank: t.Number(),
    userId: t.Number(),
    displayName: t.String(),
    avatarUrl: t.Nullable(t.String()),
    rating: t.Number(),
    tier: t.String(),
    gamesRated: t.Number(),
    peakRating: t.Number(),
  }),

  playerRanking: t.Object({
    userId: t.Number(),
    rating: t.Number(),
    tier: t.String(),
    rank: t.Number(),
    gamesRated: t.Number(),
    peakRating: t.Number(),
    lastActivityAt: t.Date(),
  }),

  ratingHistoryEntry: t.Object({
    id: t.Number(),
    matchId: t.Number(),
    ratingBefore: t.Number(),
    ratingAfter: t.Number(),
    ratingChange: t.Number(),
    createdAt: t.Date(),
  }),

  season: t.Object({
    id: t.Number(),
    name: t.String(),
    startDate: t.Date(),
    endDate: t.Date(),
    isActive: t.Boolean(),
  }),

  seasonRankingEntry: t.Object({
    userId: t.Number(),
    displayName: t.String(),
    avatarUrl: t.Nullable(t.String()),
    finalRating: t.Number(),
    finalRank: t.Number(),
    tier: t.String(),
    gamesPlayed: t.Number(),
  }),

  rankingError: t.Union([
    t.Object({ type: t.Literal("USER_NOT_FOUND") }),
    t.Object({ type: t.Literal("RATING_NOT_FOUND") }),
    t.Object({ type: t.Literal("SEASON_NOT_FOUND") }),
    t.Object({ type: t.Literal("MATCH_NOT_FOUND") }),
    t.Object({ type: t.Literal("INVALID_MATCH") }),
  ]),
};

export type LeaderboardQuery =
  (typeof RankingsModel.leaderboardQuery)["static"];
export type HistoryQuery = (typeof RankingsModel.historyQuery)["static"];
export type UserIdParam = (typeof RankingsModel.userIdParam)["static"];
export type SeasonIdParam = (typeof RankingsModel.seasonIdParam)["static"];

export type LeaderboardEntry =
  (typeof RankingsModel.leaderboardEntry)["static"];
export type PlayerRanking = (typeof RankingsModel.playerRanking)["static"];
export type RatingHistoryEntry =
  (typeof RankingsModel.ratingHistoryEntry)["static"];
export type Season = (typeof RankingsModel.season)["static"];
export type SeasonRankingEntry =
  (typeof RankingsModel.seasonRankingEntry)["static"];

export type RankingError = (typeof RankingsModel.rankingError)["static"];

/**
 * Maps ranking errors to RFC 9457 Problem Details.
 */
export function mapRankingError(error: RankingError, instance: string) {
  switch (error.type) {
    case "USER_NOT_FOUND":
      return notFound("User not found", { instance });
    case "RATING_NOT_FOUND":
      return notFound("Rating not found for user", { instance });
    case "SEASON_NOT_FOUND":
      return notFound("Season not found", { instance });
    case "MATCH_NOT_FOUND":
      return notFound("Match not found", { instance });
    case "INVALID_MATCH":
      return badRequest("Invalid match for rating calculation", { instance });
  }
}
