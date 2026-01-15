import { Elysia } from "elysia";

import { authGuard } from "../../common/guards/auth.macro";
import {
  NotificationsModel,
  mapNotificationError,
} from "./notifications.model";
import { NotificationsService } from "./notifications.service";

export const notificationsController = new Elysia({ prefix: "/notifications" })
  .use(authGuard)

  // Get notifications list
  .get(
    "/",
    async ({ user, query }) => {
      const result = await NotificationsService.getNotifications(user.id, {
        limit: query.limit,
        offset: query.offset,
        unreadOnly: query.unreadOnly,
      });

      return result.match(
        (data) => data,
        () => ({ notifications: [], total: 0, hasMore: false })
      );
    },
    {
      query: NotificationsModel.listQuery,
    }
  )

  // Get unread count
  .get("/unread", async ({ user }) => {
    const result = await NotificationsService.getUnreadCount(user.id);

    return result.match(
      (count) => ({ count }),
      () => ({ count: 0 })
    );
  })

  // Mark notification as read
  .post(
    "/:id/read",
    async ({ user, params, request, set }) => {
      const instance = new URL(request.url).pathname;
      const result = await NotificationsService.markAsRead(user.id, params.id);

      return result.match(
        (notification) => ({ notification }),
        (error) => {
          const problem = mapNotificationError(error, instance);
          set.status = problem.status;
          set.headers["Content-Type"] = "application/problem+json";
          return problem;
        }
      );
    },
    {
      params: NotificationsModel.notificationIdParam,
    }
  )

  // Mark all as read
  .post("/read-all", async ({ user }) => {
    const result = await NotificationsService.markAllAsRead(user.id);

    return result.match(
      () => ({ message: "All notifications marked as read" }),
      () => ({ message: "Failed to mark notifications as read" })
    );
  })

  // Delete notification
  .delete(
    "/:id",
    async ({ user, params, request, set }) => {
      const instance = new URL(request.url).pathname;
      const result = await NotificationsService.deleteNotification(
        user.id,
        params.id
      );

      return result.match(
        () => ({ message: "Notification deleted" }),
        (error) => {
          const problem = mapNotificationError(error, instance);
          set.status = problem.status;
          set.headers["Content-Type"] = "application/problem+json";
          return problem;
        }
      );
    },
    {
      params: NotificationsModel.notificationIdParam,
    }
  )

  // Get preferences
  .get("/preferences", async ({ user }) => {
    const result = await NotificationsService.getPreferences(user.id);

    return result.match(
      (preferences) => ({ preferences }),
      () => ({
        preferences: {
          matchInvites: true,
          friendRequests: true,
          achievements: true,
          rankChanges: true,
          systemMessages: true,
          emailNotifications: false,
        },
      })
    );
  })

  // Update preferences
  .patch(
    "/preferences",
    async ({ user, body }) => {
      const result = await NotificationsService.updatePreferences(
        user.id,
        body
      );

      return result.match(
        (preferences) => ({ preferences }),
        () => ({ preferences: null })
      );
    },
    {
      body: NotificationsModel.updatePreferences,
    }
  );
