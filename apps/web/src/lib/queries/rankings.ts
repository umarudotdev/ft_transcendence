import { api } from "$lib/api";
import { createApiError, type ApiError } from "$lib/errors";
import { createQuery } from "@tanstack/svelte-query";

export const rankingsKeys = {
  all: ["rankings"] as const,
  leaderboard: (params?: { limit?: number; offset?: number }) =>
    [...rankingsKeys.all, "leaderboard", params] as const,
  leaderboardTop: (limit?: number) =>
    [...rankingsKeys.all, "leaderboard", "top", limit] as const,
  me: () => [...rankingsKeys.all, "me"] as const,
  user: (id: number) => [...rankingsKeys.all, "user", id] as const,
  history: (params?: { limit?: number; offset?: number }) =>
    [...rankingsKeys.all, "history", params] as const,
  seasons: () => [...rankingsKeys.all, "seasons"] as const,
  currentSeason: () => [...rankingsKeys.all, "seasons", "current"] as const,
};

export type PlayerTier = "bronze" | "silver" | "gold" | "platinum";

export interface LeaderboardEntry {
  rank: number;
  userId: number;
  displayName: string;
  avatarUrl: string | null;
  rating: number;
  tier: PlayerTier;
  gamesRated: number;
  peakRating: number;
}

export interface PlayerRanking {
  userId: number;
  rating: number;
  tier: PlayerTier;
  rank: number;
  gamesRated: number;
  peakRating: number;
  lastActivityAt: Date;
}

export interface RatingHistoryEntry {
  id: number;
  matchId: number;
  ratingBefore: number;
  ratingAfter: number;
  ratingChange: number;
  createdAt: Date;
}

export interface Season {
  id: number;
  name: string;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
}

/**
 * Query to get the leaderboard.
 */
export function createLeaderboardQuery(params?: {
  limit?: number;
  offset?: number;
}) {
  return createQuery<
    { entries: LeaderboardEntry[]; total: number; hasMore: boolean },
    ApiError
  >(() => ({
    queryKey: rankingsKeys.leaderboard(params),
    queryFn: async () => {
      const response = await api.api.rankings.leaderboard.get({
        query: params,
        fetch: { credentials: "include" },
      });

      if (response.error) {
        throw createApiError(response.error.value);
      }

      return response.data as {
        entries: LeaderboardEntry[];
        total: number;
        hasMore: boolean;
      };
    },
  }));
}

/**
 * Query to get top players on the leaderboard.
 */
export function createLeaderboardTopQuery(limit = 10) {
  return createQuery<LeaderboardEntry[], ApiError>(() => ({
    queryKey: rankingsKeys.leaderboardTop(limit),
    queryFn: async () => {
      const response = await api.api.rankings.leaderboard.top.get({
        fetch: { credentials: "include" },
      });

      if (response.error) {
        throw createApiError(response.error.value);
      }

      return (response.data as { entries: LeaderboardEntry[] }).entries;
    },
  }));
}

/**
 * Query to get current user's ranking.
 */
export function createMyRankingQuery() {
  return createQuery<PlayerRanking | null, ApiError>(() => ({
    queryKey: rankingsKeys.me(),
    queryFn: async () => {
      const response = await api.api.rankings.me.get({
        fetch: { credentials: "include" },
      });

      if (response.error) {
        throw createApiError(response.error.value);
      }

      return (response.data as { ranking: PlayerRanking | null }).ranking;
    },
    retry: false,
  }));
}

/**
 * Query to get a user's ranking by ID.
 */
export function createUserRankingQuery(userId: number) {
  return createQuery<PlayerRanking | null, ApiError>(() => ({
    queryKey: rankingsKeys.user(userId),
    queryFn: async () => {
      const response = await api.api.rankings.users({ id: userId }).get({
        fetch: { credentials: "include" },
      });

      if (response.error) {
        throw createApiError(response.error.value);
      }

      const data = response.data as { ranking?: PlayerRanking };
      return data.ranking ?? null;
    },
  }));
}

/**
 * Query to get current user's rating history.
 */
export function createRatingHistoryQuery(params?: {
  limit?: number;
  offset?: number;
}) {
  return createQuery<
    { entries: RatingHistoryEntry[]; total: number; hasMore: boolean },
    ApiError
  >(() => ({
    queryKey: rankingsKeys.history(params),
    queryFn: async () => {
      const response = await api.api.rankings.history.get({
        query: params,
        fetch: { credentials: "include" },
      });

      if (response.error) {
        throw createApiError(response.error.value);
      }

      return response.data as {
        entries: RatingHistoryEntry[];
        total: number;
        hasMore: boolean;
      };
    },
  }));
}

/**
 * Query to get all seasons.
 */
export function createSeasonsQuery() {
  return createQuery<Season[], ApiError>(() => ({
    queryKey: rankingsKeys.seasons(),
    queryFn: async () => {
      const response = await api.api.rankings.seasons.get({
        fetch: { credentials: "include" },
      });

      if (response.error) {
        throw createApiError(response.error.value);
      }

      return (response.data as { seasons: Season[] }).seasons;
    },
  }));
}

/**
 * Query to get current active season.
 */
export function createCurrentSeasonQuery() {
  return createQuery<Season | null, ApiError>(() => ({
    queryKey: rankingsKeys.currentSeason(),
    queryFn: async () => {
      const response = await api.api.rankings.seasons.current.get({
        fetch: { credentials: "include" },
      });

      if (response.error) {
        throw createApiError(response.error.value);
      }

      return (response.data as { season: Season | null }).season;
    },
  }));
}

/**
 * Get tier color classes for styling.
 */
export function getTierColor(tier: PlayerTier): string {
  switch (tier) {
    case "bronze":
      return "text-amber-700 bg-amber-100";
    case "silver":
      return "text-slate-600 bg-slate-100";
    case "gold":
      return "text-yellow-600 bg-yellow-100";
    case "platinum":
      return "text-cyan-600 bg-cyan-100";
  }
}

/**
 * Get tier display name.
 */
export function getTierName(tier: PlayerTier): string {
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}
