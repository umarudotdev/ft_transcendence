import type {
  DailyStatsResponse,
  FriendItem,
  MatchHistoryItem,
  PendingRequest,
  PublicUser,
  SentRequest,
  UserProfile,
  UserStats,
  UsernameHistoryItem,
} from "@api/modules/users/users.model";

import { api } from "$lib/api";
import { ApiError, createApiError } from "$lib/errors";
import {
  createMutation,
  createQuery,
  useQueryClient,
} from "@tanstack/svelte-query";

export const usersKeys = {
  all: ["users"] as const,
  profile: (id: number) => [...usersKeys.all, "profile", id] as const,
  stats: (id: number, gameType?: string) =>
    [...usersKeys.all, "stats", id, gameType ?? "all"] as const,
  dailyStats: (days: number) =>
    [...usersKeys.all, "daily-stats", days] as const,
  matches: (
    id: number,
    params?: { limit?: number; offset?: number; gameType?: string }
  ) => [...usersKeys.all, "matches", id, params] as const,
  friends: () => [...usersKeys.all, "friends"] as const,
  pendingRequests: () => [...usersKeys.all, "pending-requests"] as const,
  sentRequests: () => [...usersKeys.all, "sent-requests"] as const,
  search: (query: string) => [...usersKeys.all, "search", query] as const,
  usernameHistory: () => [...usersKeys.all, "username-history"] as const,
};

export type {
  DailyStatsResponse,
  PublicUser,
  UserProfile,
  UserStats,
  MatchHistoryItem,
  SentRequest,
  UsernameHistoryItem,
};

export type Friend = FriendItem;

export type FriendRequest = PendingRequest;

export type FriendshipStatus =
  | "none"
  | "friends"
  | "pending_sent"
  | "pending_received"
  | "blocked"
  | "blocked_by";

export function createMyStatsQuery(gameType?: string) {
  return createQuery<UserStats | null, ApiError>(() => ({
    queryKey: usersKeys.stats(0, gameType),
    queryFn: async () => {
      const response = await api.api.users.me.stats.get({
        query: gameType ? { gameType } : {},
        fetch: { credentials: "include" },
      });

      if (response.error) {
        throw createApiError(response.error.value);
      }

      return response.data.stats as UserStats | null;
    },
  }));
}

export function createDailyStatsQuery(days = 30) {
  return createQuery<DailyStatsResponse, ApiError>(() => ({
    queryKey: usersKeys.dailyStats(days),
    queryFn: async () => {
      const response = await api.api.users.me.stats.daily.get({
        query: { days },
        fetch: { credentials: "include" },
      });

      if (response.error) {
        throw createApiError(response.error.value);
      }

      return response.data as DailyStatsResponse;
    },
  }));
}

export function createMyMatchesQuery(params?: {
  limit?: number;
  offset?: number;
  gameType?: string;
  result?: "win" | "loss";
}) {
  return createQuery<
    { matches: MatchHistoryItem[]; total: number; hasMore: boolean },
    ApiError
  >(() => ({
    queryKey: usersKeys.matches(0, params),
    queryFn: async () => {
      const response = await api.api.users.me.matches.get({
        query: params ?? {},
        fetch: { credentials: "include" },
      });

      if (response.error) {
        throw createApiError(response.error.value);
      }

      const data = response.data as {
        matches: MatchHistoryItem[];
        total: number;
        hasMore: boolean;
      };

      return {
        matches: data.matches.map((m) => ({
          ...m,
          createdAt: new Date(m.createdAt),
        })),
        total: data.total,
        hasMore: data.hasMore,
      };
    },
  }));
}

export function createFriendsQuery() {
  return createQuery<Friend[], ApiError>(() => ({
    queryKey: usersKeys.friends(),
    queryFn: async () => {
      const response = await api.api.users.me.friends.get({
        fetch: { credentials: "include" },
      });

      if (response.error) {
        throw createApiError(response.error.value);
      }

      const data = response.data as { friends: Friend[] };
      return data.friends.map((f) => ({
        ...f,
        since: new Date(f.since),
      }));
    },
  }));
}

export function createPendingRequestsQuery() {
  return createQuery<FriendRequest[], ApiError>(() => ({
    queryKey: usersKeys.pendingRequests(),
    queryFn: async () => {
      const response = await api.api.users.me.friends.pending.get({
        fetch: { credentials: "include" },
      });

      if (response.error) {
        throw createApiError(response.error.value);
      }

      const data = response.data as { requests: FriendRequest[] };
      return data.requests.map((r) => ({
        ...r,
        createdAt: new Date(r.createdAt),
      }));
    },
  }));
}

export function createSentRequestsQuery() {
  return createQuery<SentRequest[], ApiError>(() => ({
    queryKey: usersKeys.sentRequests(),
    queryFn: async () => {
      const response = await api.api.users.me.friends.sent.get({
        fetch: { credentials: "include" },
      });

      if (response.error) {
        throw createApiError(response.error.value);
      }

      const data = response.data as { requests: SentRequest[] };
      return data.requests.map((r) => ({
        ...r,
        createdAt: new Date(r.createdAt),
      }));
    },
  }));
}

export function createUserProfileQuery(userId: number) {
  return createQuery<
    { user: PublicUser; friendshipStatus: FriendshipStatus } | null,
    ApiError
  >(() => ({
    queryKey: usersKeys.profile(userId),
    queryFn: async () => {
      const response = await api.api.users({ id: userId }).get({
        fetch: { credentials: "include" },
      });

      if (response.error) {
        return null;
      }

      const data = response.data as {
        user: PublicUser;
        friendshipStatus: FriendshipStatus;
      };

      return {
        user: {
          ...data.user,
          createdAt: new Date(data.user.createdAt),
        },
        friendshipStatus: data.friendshipStatus,
      };
    },
    enabled: userId > 0,
  }));
}

export function createUserStatsQuery(userId: number, gameType?: string) {
  return createQuery<UserStats | null, ApiError>(() => ({
    queryKey: usersKeys.stats(userId, gameType),
    queryFn: async () => {
      const response = await api.api.users({ id: userId }).stats.get({
        query: gameType ? { gameType } : {},
        fetch: { credentials: "include" },
      });

      if (response.error) {
        return null;
      }

      const data = response.data as { stats: UserStats | null };
      return data.stats;
    },
    enabled: userId > 0,
  }));
}

export function createUserMatchesQuery(
  userId: number,
  params?: {
    limit?: number;
    offset?: number;
    gameType?: string;
    result?: "win" | "loss";
  }
) {
  return createQuery<
    { matches: MatchHistoryItem[]; total: number; hasMore: boolean },
    ApiError
  >(() => ({
    queryKey: usersKeys.matches(userId, params),
    queryFn: async () => {
      const response = await api.api.users({ id: userId }).matches.get({
        query: params ?? {},
        fetch: { credentials: "include" },
      });

      if (response.error) {
        throw createApiError(response.error.value);
      }

      const data = response.data as {
        matches: MatchHistoryItem[];
        total: number;
        hasMore: boolean;
      };

      return {
        matches: data.matches.map((m) => ({
          ...m,
          createdAt: new Date(m.createdAt),
        })),
        total: data.total,
        hasMore: data.hasMore,
      };
    },
    enabled: userId > 0,
  }));
}

export function createSearchUsersQuery(query: string) {
  return createQuery<
    Array<{
      id: number;
      displayName: string;
      username: string;
      avatarUrl: string | null;
    }>,
    ApiError
  >(() => ({
    queryKey: usersKeys.search(query),
    queryFn: async () => {
      const response = await api.api.users.search.get({
        query: { q: query },
        fetch: { credentials: "include" },
      });

      if (response.error) {
        return [];
      }

      return response.data.users as Array<{
        id: number;
        displayName: string;
        username: string;
        avatarUrl: string | null;
      }>;
    },
    enabled: query.length >= 1,
  }));
}

export function createUpdateProfileMutation() {
  const queryClient = useQueryClient();

  return createMutation<unknown, ApiError, { displayName?: string }>(() => ({
    mutationFn: async (data) => {
      const response = await api.api.users.me.patch(data, {
        fetch: { credentials: "include" },
      });

      if (response.error) {
        throw createApiError(response.error.value);
      }

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
    },
  }));
}

export function createUploadAvatarMutation() {
  const queryClient = useQueryClient();

  return createMutation<{ avatarUrl: string }, ApiError, File>(() => ({
    mutationFn: async (file) => {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/users/me/avatar", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        const data = await response.json();
        throw createApiError(data);
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
    },
  }));
}

export function createRemoveAvatarMutation() {
  const queryClient = useQueryClient();

  return createMutation<{ message: string }, ApiError, void>(() => ({
    mutationFn: async () => {
      const response = await fetch("/api/users/me/avatar", {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        const data = await response.json();
        throw createApiError(data);
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
    },
  }));
}

export function createSendFriendRequestMutation() {
  const queryClient = useQueryClient();

  return createMutation<unknown, ApiError, number>(() => ({
    mutationFn: async (userId) => {
      const response = await api.api
        .users({ id: userId })
        .friend.post(undefined, {
          fetch: { credentials: "include" },
        });

      if (response.error) {
        throw createApiError(response.error.value);
      }

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: usersKeys.sentRequests() });
      queryClient.invalidateQueries({ queryKey: usersKeys.all });
    },
  }));
}

export function createAcceptFriendRequestMutation() {
  const queryClient = useQueryClient();

  return createMutation<unknown, ApiError, number>(() => ({
    mutationFn: async (requestId) => {
      const response = await api.api.users.friends
        .requests({
          requestId,
        })
        .accept.post(undefined, {
          fetch: { credentials: "include" },
        });

      if (response.error) {
        throw createApiError(response.error.value);
      }

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: usersKeys.friends() });
      queryClient.invalidateQueries({ queryKey: usersKeys.pendingRequests() });
      queryClient.invalidateQueries({ queryKey: usersKeys.all });
    },
  }));
}

export function createRejectFriendRequestMutation() {
  const queryClient = useQueryClient();

  return createMutation<unknown, ApiError, number>(() => ({
    mutationFn: async (requestId) => {
      const response = await api.api.users.friends
        .requests({
          requestId,
        })
        .reject.post(undefined, {
          fetch: { credentials: "include" },
        });

      if (response.error) {
        throw createApiError(response.error.value);
      }

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: usersKeys.pendingRequests() });
    },
  }));
}

export function createRemoveFriendMutation() {
  const queryClient = useQueryClient();

  return createMutation<unknown, ApiError, number>(() => ({
    mutationFn: async (userId) => {
      const response = await api.api.users({ id: userId }).friend.delete({
        fetch: { credentials: "include" },
      });

      if (response.error) {
        throw createApiError(response.error.value);
      }

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: usersKeys.friends() });
      queryClient.invalidateQueries({ queryKey: usersKeys.all });
    },
  }));
}

export function createBlockUserMutation() {
  const queryClient = useQueryClient();

  return createMutation<unknown, ApiError, number>(() => ({
    mutationFn: async (userId) => {
      const response = await api.api
        .users({ id: userId })
        .block.post(undefined, {
          fetch: { credentials: "include" },
        });

      if (response.error) {
        throw createApiError(response.error.value);
      }

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: usersKeys.friends() });
      queryClient.invalidateQueries({ queryKey: usersKeys.all });
    },
  }));
}

export function createUnblockUserMutation() {
  const queryClient = useQueryClient();

  return createMutation<unknown, ApiError, number>(() => ({
    mutationFn: async (userId) => {
      const response = await api.api.users({ id: userId }).block.delete({
        fetch: { credentials: "include" },
      });

      if (response.error) {
        throw createApiError(response.error.value);
      }

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: usersKeys.all });
    },
  }));
}

export function createUpdateUsernameMutation() {
  const queryClient = useQueryClient();

  return createMutation<unknown, ApiError, { username: string }>(() => ({
    mutationFn: async (data) => {
      const response = await api.api.users.me.username.patch(data, {
        fetch: { credentials: "include" },
      });

      if (response.error) {
        throw createApiError(response.error.value);
      }

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      queryClient.invalidateQueries({ queryKey: usersKeys.usernameHistory() });
    },
  }));
}

export function createUsernameHistoryQuery() {
  return createQuery<UsernameHistoryItem[], ApiError>(() => ({
    queryKey: usersKeys.usernameHistory(),
    queryFn: async () => {
      const response = await api.api.users.me.username.history.get({
        fetch: { credentials: "include" },
      });

      if (response.error) {
        throw createApiError(response.error.value);
      }

      const data = response.data as { history: UsernameHistoryItem[] };
      return data.history.map((h) => ({
        ...h,
        changedAt: new Date(h.changedAt),
      }));
    },
  }));
}
