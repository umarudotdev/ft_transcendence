import { t } from "elysia";

import { notFound } from "../../common/errors";

export const NotificationsModel = {
  listQuery: t.Object({
    limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100, default: 20 })),
    offset: t.Optional(t.Numeric({ minimum: 0, default: 0 })),
    unreadOnly: t.Optional(t.Boolean({ default: false })),
  }),

  notificationIdParam: t.Object({
    id: t.Numeric(),
  }),

  notification: t.Object({
    id: t.Number(),
    type: t.String(),
    title: t.String(),
    message: t.String(),
    data: t.Nullable(t.String()),
    isRead: t.Boolean(),
    readAt: t.Nullable(t.Date()),
    createdAt: t.Date(),
  }),

  unreadCount: t.Object({
    count: t.Number(),
  }),

  notificationPreferences: t.Object({
    matchInvites: t.Boolean(),
    friendRequests: t.Boolean(),
    achievements: t.Boolean(),
    rankChanges: t.Boolean(),
    systemMessages: t.Boolean(),
    emailNotifications: t.Boolean(),
  }),

  updatePreferences: t.Object({
    matchInvites: t.Optional(t.Boolean()),
    friendRequests: t.Optional(t.Boolean()),
    achievements: t.Optional(t.Boolean()),
    rankChanges: t.Optional(t.Boolean()),
    systemMessages: t.Optional(t.Boolean()),
    emailNotifications: t.Optional(t.Boolean()),
  }),

  notificationError: t.Union([
    t.Object({ type: t.Literal("NOTIFICATION_NOT_FOUND") }),
    t.Object({ type: t.Literal("NOT_OWNER") }),
  ]),
};

export type ListQuery = (typeof NotificationsModel.listQuery)["static"];
export type NotificationIdParam =
  (typeof NotificationsModel.notificationIdParam)["static"];

export type Notification = (typeof NotificationsModel.notification)["static"];
export type UnreadCount = (typeof NotificationsModel.unreadCount)["static"];
export type NotificationPreferences =
  (typeof NotificationsModel.notificationPreferences)["static"];
export type UpdatePreferences =
  (typeof NotificationsModel.updatePreferences)["static"];

export type NotificationError =
  (typeof NotificationsModel.notificationError)["static"];

/**
 * Maps notification errors to RFC 9457 Problem Details.
 */
export function mapNotificationError(
  error: NotificationError,
  instance: string
) {
  switch (error.type) {
    case "NOTIFICATION_NOT_FOUND":
      return notFound("Notification not found", { instance });
    case "NOT_OWNER":
      return notFound("Notification not found", { instance });
  }
}
