import { and, count, desc, eq } from "drizzle-orm";

import { db } from "../../db";
import {
  type NotificationType,
  notificationPreferences,
  notifications,
} from "../../db/schema";

export const notificationsRepository = {
  // =========================================================================
  // Notifications
  // =========================================================================

  async createNotification(data: {
    userId: number;
    type: NotificationType;
    title: string;
    message: string;
    data?: string;
  }) {
    const [notification] = await db
      .insert(notifications)
      .values(data)
      .returning();

    return notification;
  },

  async getNotificationById(id: number) {
    return db.query.notifications.findFirst({
      where: eq(notifications.id, id),
    });
  },

  async getNotifications(
    userId: number,
    options: { limit?: number; offset?: number; unreadOnly?: boolean } = {}
  ) {
    const { limit = 20, offset = 0, unreadOnly = false } = options;

    const conditions = [eq(notifications.userId, userId)];
    if (unreadOnly) {
      conditions.push(eq(notifications.isRead, false));
    }

    return db.query.notifications.findMany({
      where: and(...conditions),
      orderBy: [desc(notifications.createdAt)],
      limit,
      offset,
    });
  },

  async getNotificationsCount(userId: number, unreadOnly = false) {
    const conditions = [eq(notifications.userId, userId)];
    if (unreadOnly) {
      conditions.push(eq(notifications.isRead, false));
    }

    const [result] = await db
      .select({ count: count() })
      .from(notifications)
      .where(and(...conditions));

    return result?.count ?? 0;
  },

  async getUnreadCount(userId: number) {
    const [result] = await db
      .select({ count: count() })
      .from(notifications)
      .where(
        and(eq(notifications.userId, userId), eq(notifications.isRead, false))
      );

    return result?.count ?? 0;
  },

  async markAsRead(id: number) {
    const [updated] = await db
      .update(notifications)
      .set({
        isRead: true,
        readAt: new Date(),
      })
      .where(eq(notifications.id, id))
      .returning();

    return updated;
  },

  async markAllAsRead(userId: number) {
    await db
      .update(notifications)
      .set({
        isRead: true,
        readAt: new Date(),
      })
      .where(
        and(eq(notifications.userId, userId), eq(notifications.isRead, false))
      );
  },

  async deleteNotification(id: number) {
    await db.delete(notifications).where(eq(notifications.id, id));
  },

  async deleteAllNotifications(userId: number) {
    await db.delete(notifications).where(eq(notifications.userId, userId));
  },

  // =========================================================================
  // Preferences
  // =========================================================================

  async getPreferences(userId: number) {
    return db.query.notificationPreferences.findFirst({
      where: eq(notificationPreferences.userId, userId),
    });
  },

  async createPreferences(userId: number) {
    const [prefs] = await db
      .insert(notificationPreferences)
      .values({
        userId,
        matchInvites: true,
        friendRequests: true,
        achievements: true,
        rankChanges: true,
        systemMessages: true,
        emailNotifications: false,
      })
      .returning();

    return prefs;
  },

  async updatePreferences(
    userId: number,
    data: {
      matchInvites?: boolean;
      friendRequests?: boolean;
      achievements?: boolean;
      rankChanges?: boolean;
      systemMessages?: boolean;
      emailNotifications?: boolean;
    }
  ) {
    const [updated] = await db
      .update(notificationPreferences)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(notificationPreferences.userId, userId))
      .returning();

    return updated;
  },
};
