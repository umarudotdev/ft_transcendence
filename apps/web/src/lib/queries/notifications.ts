import { api } from "$lib/api";
import { createApiError, type ApiError } from "$lib/errors";
import {
  createMutation,
  createQuery,
  useQueryClient,
} from "@tanstack/svelte-query";

export const notificationsKeys = {
  all: ["notifications"] as const,
  list: (params?: { limit?: number; offset?: number; unreadOnly?: boolean }) =>
    [...notificationsKeys.all, "list", params] as const,
  unreadCount: () => [...notificationsKeys.all, "unread"] as const,
  preferences: () => [...notificationsKeys.all, "preferences"] as const,
};

export type NotificationType =
  | "match_invite"
  | "friend_request"
  | "achievement"
  | "rank_change"
  | "system";

export interface Notification {
  id: number;
  userId: number;
  type: NotificationType;
  title: string;
  message: string;
  data: Record<string, unknown> | null;
  isRead: boolean;
  createdAt: Date;
  readAt: Date | null;
}

export interface NotificationPreferences {
  matchInvites: boolean;
  friendRequests: boolean;
  achievements: boolean;
  rankChanges: boolean;
  systemMessages: boolean;
}

/**
 * Query to get notifications list.
 */
export function createNotificationsQuery(params?: {
  limit?: number;
  offset?: number;
  unreadOnly?: boolean;
}) {
  return createQuery<
    { notifications: Notification[]; total: number; hasMore: boolean },
    ApiError
  >(() => ({
    queryKey: notificationsKeys.list(params),
    queryFn: async () => {
      const response = await api.api.notifications.get({
        query: params,
        fetch: { credentials: "include" },
      });

      if (response.error) {
        throw createApiError(response.error.value);
      }

      return response.data as {
        notifications: Notification[];
        total: number;
        hasMore: boolean;
      };
    },
  }));
}

/**
 * Query to get unread notification count.
 */
export function createUnreadCountQuery() {
  return createQuery<number, ApiError>(() => ({
    queryKey: notificationsKeys.unreadCount(),
    queryFn: async () => {
      const response = await api.api.notifications.unread.get({
        fetch: { credentials: "include" },
      });

      if (response.error) {
        throw createApiError(response.error.value);
      }

      return response.data.count as number;
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  }));
}

/**
 * Mutation to mark a notification as read.
 */
export function createMarkAsReadMutation() {
  const queryClient = useQueryClient();

  return createMutation<unknown, ApiError, number>(() => ({
    mutationFn: async (notificationId: number) => {
      const response = await api.api
        .notifications({ id: notificationId })
        .read.post(undefined, {
          fetch: { credentials: "include" },
        });

      if (response.error) {
        throw createApiError(response.error.value);
      }

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationsKeys.all });
    },
  }));
}

/**
 * Mutation to mark all notifications as read.
 */
export function createMarkAllAsReadMutation() {
  const queryClient = useQueryClient();

  return createMutation<unknown, ApiError, void>(() => ({
    mutationFn: async () => {
      const response = await api.api.notifications["read-all"].post(undefined, {
        fetch: { credentials: "include" },
      });

      if (response.error) {
        throw createApiError(response.error.value);
      }

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationsKeys.all });
    },
  }));
}

/**
 * Mutation to delete a notification.
 */
export function createDeleteNotificationMutation() {
  const queryClient = useQueryClient();

  return createMutation<unknown, ApiError, number>(() => ({
    mutationFn: async (notificationId: number) => {
      const response = await api.api
        .notifications({ id: notificationId })
        .delete({
          fetch: { credentials: "include" },
        });

      if (response.error) {
        throw createApiError(response.error.value);
      }

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationsKeys.all });
    },
  }));
}

/**
 * Query to get notification preferences.
 */
export function createNotificationPreferencesQuery() {
  return createQuery<NotificationPreferences, ApiError>(() => ({
    queryKey: notificationsKeys.preferences(),
    queryFn: async () => {
      const response = await api.api.notifications.preferences.get({
        fetch: { credentials: "include" },
      });

      if (response.error) {
        throw createApiError(response.error.value);
      }

      return response.data.preferences as NotificationPreferences;
    },
  }));
}

/**
 * Mutation to update notification preferences.
 */
export function createUpdatePreferencesMutation() {
  const queryClient = useQueryClient();

  return createMutation<
    NotificationPreferences,
    ApiError,
    Partial<NotificationPreferences>
  >(() => ({
    mutationFn: async (prefs: Partial<NotificationPreferences>) => {
      const response = await api.api.notifications.preferences.patch(prefs, {
        fetch: { credentials: "include" },
      });

      if (response.error) {
        throw createApiError(response.error.value);
      }

      return response.data.preferences as NotificationPreferences;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: notificationsKeys.preferences(),
      });
    },
  }));
}

/**
 * Get icon name for notification type.
 */
export function getNotificationIcon(type: NotificationType): string {
  switch (type) {
    case "match_invite":
      return "gamepad-2";
    case "friend_request":
      return "user-plus";
    case "achievement":
      return "trophy";
    case "rank_change":
      return "trending-up";
    case "system":
      return "info";
  }
}

/**
 * Get color classes for notification type.
 */
export function getNotificationColor(type: NotificationType): string {
  switch (type) {
    case "match_invite":
      return "text-blue-600 bg-blue-100";
    case "friend_request":
      return "text-green-600 bg-green-100";
    case "achievement":
      return "text-yellow-600 bg-yellow-100";
    case "rank_change":
      return "text-purple-600 bg-purple-100";
    case "system":
      return "text-slate-600 bg-slate-100";
  }
}
