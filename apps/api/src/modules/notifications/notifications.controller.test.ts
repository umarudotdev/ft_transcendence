import { describe, expect, test } from "bun:test";
import { Elysia } from "elysia";

import { HttpStatus } from "../../common/errors";
import {
  mapNotificationError,
  NotificationsModel,
} from "./notifications.model";

describe("NotificationsModel Schema Validation", () => {
  describe("listQuery", () => {
    const app = new Elysia().get(
      "/notifications",
      ({ query }) => ({ received: query }),
      { query: NotificationsModel.listQuery }
    );

    test("accepts valid query with all parameters", async () => {
      const response = await app.handle(
        new Request(
          "http://localhost/notifications?limit=50&offset=10&unreadOnly=true"
        )
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.received.limit).toBe(50);
      expect(body.received.offset).toBe(10);
      expect(body.received.unreadOnly).toBe(true);
    });

    test("accepts empty query with defaults", async () => {
      const response = await app.handle(
        new Request("http://localhost/notifications")
      );
      expect(response.status).toBe(200);
    });

    test("accepts unreadOnly as false", async () => {
      const response = await app.handle(
        new Request("http://localhost/notifications?unreadOnly=false")
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.received.unreadOnly).toBe(false);
    });

    test("rejects limit below minimum (1)", async () => {
      const response = await app.handle(
        new Request("http://localhost/notifications?limit=0")
      );
      expect(response.status).toBe(422);
    });

    test("rejects limit above maximum (100)", async () => {
      const response = await app.handle(
        new Request("http://localhost/notifications?limit=101")
      );
      expect(response.status).toBe(422);
    });

    test("rejects negative offset", async () => {
      const response = await app.handle(
        new Request("http://localhost/notifications?offset=-1")
      );
      expect(response.status).toBe(422);
    });
  });

  describe("notificationIdParam", () => {
    const app = new Elysia().get(
      "/notifications/:id",
      ({ params }) => ({ received: params }),
      { params: NotificationsModel.notificationIdParam }
    );

    test("accepts valid numeric notification ID", async () => {
      const response = await app.handle(
        new Request("http://localhost/notifications/123")
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.received.id).toBe(123);
    });

    test("converts string ID to number", async () => {
      const response = await app.handle(
        new Request("http://localhost/notifications/456")
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(typeof body.received.id).toBe("number");
    });

    test("rejects non-numeric ID", async () => {
      const response = await app.handle(
        new Request("http://localhost/notifications/abc")
      );
      expect(response.status).toBe(422);
    });
  });

  describe("updatePreferences", () => {
    const app = new Elysia().patch(
      "/preferences",
      ({ body }) => ({ received: body }),
      { body: NotificationsModel.updatePreferences }
    );

    test("accepts partial preference updates", async () => {
      const response = await app.handle(
        new Request("http://localhost/preferences", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ matchInvites: false }),
        })
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.received.matchInvites).toBe(false);
    });

    test("accepts empty body (no changes)", async () => {
      const response = await app.handle(
        new Request("http://localhost/preferences", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        })
      );
      expect(response.status).toBe(200);
    });

    test("accepts all preference fields", async () => {
      const response = await app.handle(
        new Request("http://localhost/preferences", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            matchInvites: true,
            friendRequests: false,
            achievements: true,
            rankChanges: false,
            systemMessages: true,
            emailNotifications: false,
          }),
        })
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.received.matchInvites).toBe(true);
      expect(body.received.friendRequests).toBe(false);
      expect(body.received.achievements).toBe(true);
      expect(body.received.rankChanges).toBe(false);
      expect(body.received.systemMessages).toBe(true);
      expect(body.received.emailNotifications).toBe(false);
    });

    test("rejects non-boolean values for preferences", async () => {
      const response = await app.handle(
        new Request("http://localhost/preferences", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ matchInvites: "yes" }),
        })
      );
      expect(response.status).toBe(422);
    });
  });
});

describe("Notification Error Mapping", () => {
  const instance = "/api/notifications/test";

  test("NOTIFICATION_NOT_FOUND returns 404", () => {
    const result = mapNotificationError(
      { type: "NOTIFICATION_NOT_FOUND" },
      instance
    );
    expect(result.status).toBe(HttpStatus.NOT_FOUND);
    expect(result.detail).toBe("Notification not found");
    expect(result.instance).toBe(instance);
  });

  test("NOT_OWNER returns 404 (hidden as not found for security)", () => {
    const result = mapNotificationError({ type: "NOT_OWNER" }, instance);
    // NOT_OWNER is intentionally mapped to 404 to prevent enumeration
    expect(result.status).toBe(HttpStatus.NOT_FOUND);
    expect(result.detail).toBe("Notification not found");
  });

  test("both error types return same response (no information leakage)", () => {
    const notFound = mapNotificationError(
      { type: "NOTIFICATION_NOT_FOUND" },
      instance
    );
    const notOwner = mapNotificationError({ type: "NOT_OWNER" }, instance);

    expect(notFound.status).toBe(notOwner.status);
    expect(notFound.detail).toBe(notOwner.detail);
    expect(notFound.title).toBe(notOwner.title);
  });
});

describe("RFC 9457 Problem Details Compliance", () => {
  const instance = "/api/notifications/test";

  test("all notification error mappings include required RFC 9457 fields", () => {
    const errors = [
      { type: "NOTIFICATION_NOT_FOUND" as const },
      { type: "NOT_OWNER" as const },
    ];

    for (const error of errors) {
      const result = mapNotificationError(error, instance);
      expect(result).toHaveProperty("type");
      expect(result).toHaveProperty("status");
      expect(result).toHaveProperty("title");
      expect(result).toHaveProperty("detail");
      expect(result).toHaveProperty("instance");
      expect(result.type).toMatch(/^(https?:\/\/|about:blank)/);
    }
  });

  test("error responses are JSON serializable", () => {
    const result = mapNotificationError(
      { type: "NOTIFICATION_NOT_FOUND" },
      instance
    );
    expect(() => JSON.stringify(result)).not.toThrow();
    const parsed = JSON.parse(JSON.stringify(result));
    expect(parsed.status).toBe(result.status);
  });
});
