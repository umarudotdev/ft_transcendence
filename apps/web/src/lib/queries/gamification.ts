import { api } from "$lib/api";
import { createApiError, type ApiError } from "$lib/errors";
import {
  createMutation,
  createQuery,
  useQueryClient,
} from "@tanstack/svelte-query";

export const gamificationKeys = {
  all: ["gamification"] as const,
  points: () => [...gamificationKeys.all, "points"] as const,
  pointsHistory: (params?: { limit?: number; offset?: number }) =>
    [...gamificationKeys.all, "points", "history", params] as const,
  streak: () => [...gamificationKeys.all, "streak"] as const,
  achievements: () => [...gamificationKeys.all, "achievements"] as const,
  myAchievements: () =>
    [...gamificationKeys.all, "achievements", "me"] as const,
  userAchievements: (id: number) =>
    [...gamificationKeys.all, "achievements", "user", id] as const,
};

export interface UserPoints {
  balance: number;
  totalEarned: number;
  totalSpent: number;
}

export interface PointsTransaction {
  id: number;
  amount: number;
  type: string;
  description: string;
  referenceId: number | null;
  referenceType: string | null;
  createdAt: Date;
}

export interface LoginStreak {
  currentStreak: number;
  longestStreak: number;
  lastLoginDate: Date | null;
  canClaimReward: boolean;
}

export interface Achievement {
  id: number;
  code: string;
  name: string;
  description: string;
  icon: string | null;
  points: number;
  category: string;
  targetProgress: number;
  isSecret: boolean;
}

export interface UserAchievement {
  id: number;
  achievementId: number;
  code: string;
  name: string;
  description: string;
  icon: string | null;
  points: number;
  category: string;
  unlockedAt: Date;
}

export interface DailyRewardResult {
  points: number;
  streak: number;
  bonus: number;
  message: string;
}

/**
 * Query to get current user's points balance.
 */
export function createPointsQuery() {
  return createQuery<UserPoints, ApiError>(() => ({
    queryKey: gamificationKeys.points(),
    queryFn: async () => {
      const response = await api.api.gamification.points.get({
        fetch: { credentials: "include" },
      });

      if (response.error) {
        throw createApiError(response.error.value);
      }

      return (response.data as { points: UserPoints }).points;
    },
  }));
}

/**
 * Query to get points transaction history.
 */
export function createPointsHistoryQuery(params?: {
  limit?: number;
  offset?: number;
}) {
  return createQuery<
    { transactions: PointsTransaction[]; total: number; hasMore: boolean },
    ApiError
  >(() => ({
    queryKey: gamificationKeys.pointsHistory(params),
    queryFn: async () => {
      const response = await api.api.gamification.points.history.get({
        query: params,
        fetch: { credentials: "include" },
      });

      if (response.error) {
        throw createApiError(response.error.value);
      }

      return response.data as {
        transactions: PointsTransaction[];
        total: number;
        hasMore: boolean;
      };
    },
  }));
}

/**
 * Query to get current user's login streak info.
 */
export function createStreakQuery() {
  return createQuery<LoginStreak, ApiError>(() => ({
    queryKey: gamificationKeys.streak(),
    queryFn: async () => {
      const response = await api.api.gamification.streak.get({
        fetch: { credentials: "include" },
      });

      if (response.error) {
        throw createApiError(response.error.value);
      }

      return (response.data as { streak: LoginStreak }).streak;
    },
  }));
}

/**
 * Mutation to claim daily reward.
 */
export function createClaimDailyRewardMutation() {
  const queryClient = useQueryClient();

  return createMutation<DailyRewardResult, ApiError, void>(() => ({
    mutationFn: async () => {
      const response = await api.api.gamification["daily-reward"].post(
        undefined,
        {
          fetch: { credentials: "include" },
        }
      );

      if (response.error) {
        throw createApiError(response.error.value);
      }

      return (response.data as { reward: DailyRewardResult }).reward;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: gamificationKeys.points() });
      queryClient.invalidateQueries({ queryKey: gamificationKeys.streak() });
    },
  }));
}

/**
 * Query to get all available achievements.
 */
export function createAchievementsQuery() {
  return createQuery<Achievement[], ApiError>(() => ({
    queryKey: gamificationKeys.achievements(),
    queryFn: async () => {
      const response = await api.api.gamification.achievements.get({
        fetch: { credentials: "include" },
      });

      if (response.error) {
        throw createApiError(response.error.value);
      }

      return (response.data as { achievements: Achievement[] }).achievements;
    },
  }));
}

/**
 * Query to get current user's unlocked achievements.
 */
export function createMyAchievementsQuery() {
  return createQuery<UserAchievement[], ApiError>(() => ({
    queryKey: gamificationKeys.myAchievements(),
    queryFn: async () => {
      const response = await api.api.gamification.achievements.me.get({
        fetch: { credentials: "include" },
      });

      if (response.error) {
        throw createApiError(response.error.value);
      }

      return (response.data as { achievements: UserAchievement[] })
        .achievements;
    },
  }));
}

/**
 * Query to get a specific user's unlocked achievements.
 */
export function createUserAchievementsQuery(userId: number) {
  return createQuery<UserAchievement[], ApiError>(() => ({
    queryKey: gamificationKeys.userAchievements(userId),
    queryFn: async () => {
      const response = await api.api.gamification
        .users({ id: userId })
        .achievements.get({
          fetch: { credentials: "include" },
        });

      if (response.error) {
        throw createApiError(response.error.value);
      }

      return (response.data as { achievements: UserAchievement[] })
        .achievements;
    },
  }));
}

/**
 * Get achievement category display name.
 */
export function getCategoryName(category: string): string {
  const categories: Record<string, string> = {
    matches: "Matches",
    wins: "Victories",
    skill: "Skill",
    social: "Social",
    special: "Special",
  };
  return categories[category] ?? category;
}

/**
 * Calculate streak bonus for display.
 */
export function calculateStreakBonus(streak: number): number {
  return Math.min(Math.floor(streak * 0.5), 25);
}
