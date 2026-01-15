import { err, ok, ResultAsync } from "neverthrow";

import type { NotificationType } from "../../db/schema";
import type {
  Notification,
  NotificationError,
  NotificationPreferences,
} from "./notifications.model";

import { notificationsRepository } from "./notifications.repository";

// In-memory store for WebSocket connections
const connectedUsers = new Map<number, Set<WebSocket>>();

abstract class NotificationsService {
  /**
   * Register a WebSocket connection for a user.
   */
  static registerConnection(userId: number, ws: WebSocket): void {
    if (!connectedUsers.has(userId)) {
      connectedUsers.set(userId, new Set());
    }
    connectedUsers.get(userId)?.add(ws);
  }

  /**
   * Unregister a WebSocket connection.
   */
  static unregisterConnection(userId: number, ws: WebSocket): void {
    const connections = connectedUsers.get(userId);
    if (connections) {
      connections.delete(ws);
      if (connections.size === 0) {
        connectedUsers.delete(userId);
      }
    }
  }

  /**
   * Broadcast notification to user's connected clients.
   */
  static broadcastToUser(userId: number, notification: Notification): void {
    const connections = connectedUsers.get(userId);
    if (connections) {
      const message = JSON.stringify({
        type: "notification",
        data: notification,
      });

      for (const ws of connections) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(message);
        }
      }
    }
  }

  /**
   * Create a notification and broadcast to connected clients.
   */
  static createNotification(
    userId: number,
    type: NotificationType,
    title: string,
    message: string,
    data?: Record<string, unknown>
  ): ResultAsync<Notification, never> {
    return ResultAsync.fromPromise(
      (async () => {
        // Check preferences
        const shouldNotify = await NotificationsService.shouldNotify(
          userId,
          type
        );

        if (!shouldNotify) {
          // Return a "silent" notification object
          return {
            id: 0,
            type,
            title,
            message,
            data: null,
            isRead: true,
            readAt: new Date(),
            createdAt: new Date(),
          };
        }

        const notification = await notificationsRepository.createNotification({
          userId,
          type,
          title,
          message,
          data: data ? JSON.stringify(data) : undefined,
        });

        const notificationObj: Notification = {
          id: notification.id,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          data: notification.data,
          isRead: notification.isRead,
          readAt: notification.readAt,
          createdAt: notification.createdAt,
        };

        // Broadcast to connected clients
        NotificationsService.broadcastToUser(userId, notificationObj);

        return notificationObj;
      })(),
      (): never => {
        throw new Error("Unexpected error creating notification");
      }
    );
  }

  /**
   * Check if user should receive notification based on preferences.
   */
  private static async shouldNotify(
    userId: number,
    type: NotificationType
  ): Promise<boolean> {
    let prefs = await notificationsRepository.getPreferences(userId);

    if (!prefs) {
      prefs = await notificationsRepository.createPreferences(userId);
    }

    switch (type) {
      case "match_invite":
        return prefs.matchInvites;
      case "friend_request":
        return prefs.friendRequests;
      case "achievement":
        return prefs.achievements;
      case "rank_change":
        return prefs.rankChanges;
      case "system":
        return prefs.systemMessages;
      default:
        return true;
    }
  }

  /**
   * Get notifications for a user.
   */
  static getNotifications(
    userId: number,
    options: { limit?: number; offset?: number; unreadOnly?: boolean } = {}
  ): ResultAsync<
    { notifications: Notification[]; total: number; hasMore: boolean },
    never
  > {
    return ResultAsync.fromPromise(
      (async () => {
        const { limit = 20, offset = 0, unreadOnly = false } = options;

        const notificationList = await notificationsRepository.getNotifications(
          userId,
          { limit: limit + 1, offset, unreadOnly }
        );

        const total = await notificationsRepository.getNotificationsCount(
          userId,
          unreadOnly
        );

        const hasMore = notificationList.length > limit;
        const notificationsToReturn = hasMore
          ? notificationList.slice(0, limit)
          : notificationList;

        return {
          notifications: notificationsToReturn.map((n) => ({
            id: n.id,
            type: n.type,
            title: n.title,
            message: n.message,
            data: n.data,
            isRead: n.isRead,
            readAt: n.readAt,
            createdAt: n.createdAt,
          })),
          total,
          hasMore,
        };
      })(),
      (): never => {
        throw new Error("Unexpected error getting notifications");
      }
    );
  }

  /**
   * Get unread notification count.
   */
  static getUnreadCount(userId: number): ResultAsync<number, never> {
    return ResultAsync.fromPromise(
      notificationsRepository.getUnreadCount(userId),
      (): never => {
        throw new Error("Unexpected error getting unread count");
      }
    );
  }

  /**
   * Mark a notification as read.
   */
  static markAsRead(
    userId: number,
    notificationId: number
  ): ResultAsync<Notification, NotificationError> {
    return ResultAsync.fromPromise(
      (async () => {
        const notification =
          await notificationsRepository.getNotificationById(notificationId);

        if (!notification) {
          return err({ type: "NOTIFICATION_NOT_FOUND" as const });
        }

        if (notification.userId !== userId) {
          return err({ type: "NOT_OWNER" as const });
        }

        const updated =
          await notificationsRepository.markAsRead(notificationId);

        return ok({
          id: updated.id,
          type: updated.type,
          title: updated.title,
          message: updated.message,
          data: updated.data,
          isRead: updated.isRead,
          readAt: updated.readAt,
          createdAt: updated.createdAt,
        });
      })(),
      () => ({ type: "NOTIFICATION_NOT_FOUND" as const })
    ).andThen((result) => result);
  }

  /**
   * Mark all notifications as read for a user.
   */
  static markAllAsRead(userId: number): ResultAsync<void, never> {
    return ResultAsync.fromPromise(
      notificationsRepository.markAllAsRead(userId),
      (): never => {
        throw new Error("Unexpected error marking all as read");
      }
    );
  }

  /**
   * Delete a notification.
   */
  static deleteNotification(
    userId: number,
    notificationId: number
  ): ResultAsync<void, NotificationError> {
    return ResultAsync.fromPromise(
      (async () => {
        const notification =
          await notificationsRepository.getNotificationById(notificationId);

        if (!notification) {
          return err({ type: "NOTIFICATION_NOT_FOUND" as const });
        }

        if (notification.userId !== userId) {
          return err({ type: "NOT_OWNER" as const });
        }

        await notificationsRepository.deleteNotification(notificationId);

        return ok(undefined);
      })(),
      () => ({ type: "NOTIFICATION_NOT_FOUND" as const })
    ).andThen((result) => result);
  }

  /**
   * Get notification preferences.
   */
  static getPreferences(
    userId: number
  ): ResultAsync<NotificationPreferences, never> {
    return ResultAsync.fromPromise(
      (async () => {
        let prefs = await notificationsRepository.getPreferences(userId);

        if (!prefs) {
          prefs = await notificationsRepository.createPreferences(userId);
        }

        return {
          matchInvites: prefs.matchInvites,
          friendRequests: prefs.friendRequests,
          achievements: prefs.achievements,
          rankChanges: prefs.rankChanges,
          systemMessages: prefs.systemMessages,
          emailNotifications: prefs.emailNotifications,
        };
      })(),
      (): never => {
        throw new Error("Unexpected error getting preferences");
      }
    );
  }

  /**
   * Update notification preferences.
   */
  static updatePreferences(
    userId: number,
    data: Partial<NotificationPreferences>
  ): ResultAsync<NotificationPreferences, never> {
    return ResultAsync.fromPromise(
      (async () => {
        let prefs = await notificationsRepository.getPreferences(userId);

        if (!prefs) {
          prefs = await notificationsRepository.createPreferences(userId);
        }

        const updated = await notificationsRepository.updatePreferences(
          userId,
          data
        );

        return {
          matchInvites: updated.matchInvites,
          friendRequests: updated.friendRequests,
          achievements: updated.achievements,
          rankChanges: updated.rankChanges,
          systemMessages: updated.systemMessages,
          emailNotifications: updated.emailNotifications,
        };
      })(),
      (): never => {
        throw new Error("Unexpected error updating preferences");
      }
    );
  }

  // =========================================================================
  // Convenience methods for creating specific notification types
  // =========================================================================

  static notifyMatchInvite(
    userId: number,
    fromUserId: number,
    fromDisplayName: string
  ): ResultAsync<Notification, never> {
    return NotificationsService.createNotification(
      userId,
      "match_invite",
      "Match Invite",
      `${fromDisplayName} invited you to play!`,
      { fromUserId, fromDisplayName }
    );
  }

  static notifyFriendRequest(
    userId: number,
    fromUserId: number,
    fromDisplayName: string
  ): ResultAsync<Notification, never> {
    return NotificationsService.createNotification(
      userId,
      "friend_request",
      "Friend Request",
      `${fromDisplayName} sent you a friend request`,
      { fromUserId, fromDisplayName }
    );
  }

  static notifyAchievement(
    userId: number,
    achievementName: string,
    achievementId: number,
    points: number
  ): ResultAsync<Notification, never> {
    return NotificationsService.createNotification(
      userId,
      "achievement",
      "Achievement Unlocked!",
      `You unlocked "${achievementName}" and earned ${points} points!`,
      { achievementId, achievementName, points }
    );
  }

  static notifyRankChange(
    userId: number,
    newTier: string,
    newRating: number,
    isPromotion: boolean
  ): ResultAsync<Notification, never> {
    const title = isPromotion ? "Promoted!" : "Rank Changed";
    const message = isPromotion
      ? `Congratulations! You've been promoted to ${newTier}!`
      : `Your rank has changed to ${newTier} (${newRating} rating)`;

    return NotificationsService.createNotification(
      userId,
      "rank_change",
      title,
      message,
      { newTier, newRating, isPromotion }
    );
  }

  static notifySystem(
    userId: number,
    title: string,
    message: string,
    data?: Record<string, unknown>
  ): ResultAsync<Notification, never> {
    return NotificationsService.createNotification(
      userId,
      "system",
      title,
      message,
      data
    );
  }
}

export { NotificationsService };
