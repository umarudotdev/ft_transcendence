import { describe, expect, test } from "bun:test";
import { Elysia } from "elysia";

import { HttpStatus } from "../../common/errors";
import { mapModerationError, ModerationModel } from "./moderation.model";

describe("ModerationModel Schema Validation", () => {
  describe("createReport", () => {
    const app = new Elysia().post(
      "/reports",
      ({ body }) => ({ received: body }),
      { body: ModerationModel.createReport }
    );

    test("accepts valid report with all fields", async () => {
      const response = await app.handle(
        new Request("http://localhost/reports", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reportedUserId: 123,
            reason: "cheating",
            description: "Player was using aimbots",
            matchId: 456,
          }),
        })
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.received.reportedUserId).toBe(123);
      expect(body.received.reason).toBe("cheating");
    });

    test("accepts valid report with only required fields", async () => {
      const response = await app.handle(
        new Request("http://localhost/reports", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reportedUserId: 123,
            reason: "afk",
          }),
        })
      );
      expect(response.status).toBe(200);
    });

    test("accepts all valid reason values", async () => {
      const reasons = [
        "afk",
        "cheating",
        "harassment",
        "inappropriate_name",
        "other",
      ];

      for (const reason of reasons) {
        const response = await app.handle(
          new Request("http://localhost/reports", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              reportedUserId: 123,
              reason,
            }),
          })
        );
        expect(response.status).toBe(200);
      }
    });

    test("rejects invalid reason value", async () => {
      const response = await app.handle(
        new Request("http://localhost/reports", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reportedUserId: 123,
            reason: "invalid_reason",
          }),
        })
      );
      expect(response.status).toBe(422);
    });

    test("rejects description over 500 characters", async () => {
      const response = await app.handle(
        new Request("http://localhost/reports", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reportedUserId: 123,
            reason: "other",
            description: "x".repeat(501),
          }),
        })
      );
      expect(response.status).toBe(422);
    });

    test("accepts description at exactly 500 characters", async () => {
      const response = await app.handle(
        new Request("http://localhost/reports", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reportedUserId: 123,
            reason: "other",
            description: "x".repeat(500),
          }),
        })
      );
      expect(response.status).toBe(200);
    });
  });

  describe("reportsQuery", () => {
    const app = new Elysia().get(
      "/reports",
      ({ query }) => ({ received: query }),
      { query: ModerationModel.reportsQuery }
    );

    test("accepts valid query with all parameters", async () => {
      const response = await app.handle(
        new Request(
          "http://localhost/reports?limit=50&offset=10&status=pending&reason=cheating"
        )
      );
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.received.status).toBe("pending");
    });

    test("accepts all valid status values", async () => {
      for (const status of ["pending", "reviewed", "resolved", "dismissed"]) {
        const response = await app.handle(
          new Request(`http://localhost/reports?status=${status}`)
        );
        expect(response.status).toBe(200);
      }
    });

    test("rejects invalid status value", async () => {
      const response = await app.handle(
        new Request("http://localhost/reports?status=invalid")
      );
      expect(response.status).toBe(422);
    });
  });

  describe("resolveReport", () => {
    const app = new Elysia().post(
      "/reports/:id/resolve",
      ({ body }) => ({ received: body }),
      { body: ModerationModel.resolveReport }
    );

    test("accepts valid resolution", async () => {
      const response = await app.handle(
        new Request("http://localhost/reports/1/resolve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            resolution: "warning",
            notes: "First offense, verbal warning issued",
          }),
        })
      );
      expect(response.status).toBe(200);
    });

    test("accepts all valid resolution values", async () => {
      for (const resolution of ["warning", "timeout", "ban", "no_action"]) {
        const response = await app.handle(
          new Request("http://localhost/reports/1/resolve", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ resolution }),
          })
        );
        expect(response.status).toBe(200);
      }
    });

    test("rejects invalid resolution value", async () => {
      const response = await app.handle(
        new Request("http://localhost/reports/1/resolve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resolution: "suspend" }),
        })
      );
      expect(response.status).toBe(422);
    });

    test("rejects sanction duration less than 1 hour", async () => {
      const response = await app.handle(
        new Request("http://localhost/reports/1/resolve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            resolution: "timeout",
            sanctionDuration: 0,
          }),
        })
      );
      expect(response.status).toBe(422);
    });

    test("accepts sanction duration of 1 hour", async () => {
      const response = await app.handle(
        new Request("http://localhost/reports/1/resolve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            resolution: "timeout",
            sanctionDuration: 1,
          }),
        })
      );
      expect(response.status).toBe(200);
    });
  });

  describe("issueSanction", () => {
    const app = new Elysia().post(
      "/sanctions",
      ({ body }) => ({ received: body }),
      { body: ModerationModel.issueSanction }
    );

    test("accepts valid sanction with all fields", async () => {
      const response = await app.handle(
        new Request("http://localhost/sanctions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: 123,
            type: "timeout",
            reason: "Repeated violations",
            duration: 24,
            reportId: 456,
          }),
        })
      );
      expect(response.status).toBe(200);
    });

    test("accepts valid sanction with only required fields", async () => {
      const response = await app.handle(
        new Request("http://localhost/sanctions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: 123,
            type: "warning",
            reason: "First offense",
          }),
        })
      );
      expect(response.status).toBe(200);
    });

    test("accepts all valid sanction types", async () => {
      for (const type of ["warning", "timeout", "ban"]) {
        const response = await app.handle(
          new Request("http://localhost/sanctions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId: 123,
              type,
              reason: "Test reason",
            }),
          })
        );
        expect(response.status).toBe(200);
      }
    });

    test("rejects invalid sanction type", async () => {
      const response = await app.handle(
        new Request("http://localhost/sanctions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: 123,
            type: "suspension",
            reason: "Test",
          }),
        })
      );
      expect(response.status).toBe(422);
    });

    test("rejects empty reason", async () => {
      const response = await app.handle(
        new Request("http://localhost/sanctions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: 123,
            type: "warning",
            reason: "",
          }),
        })
      );
      expect(response.status).toBe(422);
    });

    test("rejects reason over 500 characters", async () => {
      const response = await app.handle(
        new Request("http://localhost/sanctions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: 123,
            type: "warning",
            reason: "x".repeat(501),
          }),
        })
      );
      expect(response.status).toBe(422);
    });

    test("rejects duration less than 1 hour", async () => {
      const response = await app.handle(
        new Request("http://localhost/sanctions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: 123,
            type: "timeout",
            reason: "Test",
            duration: 0,
          }),
        })
      );
      expect(response.status).toBe(422);
    });
  });

  describe("auditLogQuery", () => {
    const app = new Elysia().get(
      "/audit-log",
      ({ query }) => ({ received: query }),
      { query: ModerationModel.auditLogQuery }
    );

    test("accepts valid query with all parameters", async () => {
      const response = await app.handle(
        new Request(
          "http://localhost/audit-log?limit=50&offset=10&actorId=1&targetUserId=2&action=sanction_issued"
        )
      );
      expect(response.status).toBe(200);
    });

    test("accepts empty query with defaults", async () => {
      const response = await app.handle(
        new Request("http://localhost/audit-log")
      );
      expect(response.status).toBe(200);
    });
  });
});

describe("Moderation Error Mapping", () => {
  const instance = "/api/moderation/test";

  test("USER_NOT_FOUND returns 404", () => {
    const result = mapModerationError({ type: "USER_NOT_FOUND" }, instance);
    expect(result.status).toBe(HttpStatus.NOT_FOUND);
    expect(result.detail).toBe("User not found");
    expect(result.instance).toBe(instance);
  });

  test("REPORT_NOT_FOUND returns 404", () => {
    const result = mapModerationError({ type: "REPORT_NOT_FOUND" }, instance);
    expect(result.status).toBe(HttpStatus.NOT_FOUND);
    expect(result.detail).toBe("Report not found");
  });

  test("SANCTION_NOT_FOUND returns 404", () => {
    const result = mapModerationError({ type: "SANCTION_NOT_FOUND" }, instance);
    expect(result.status).toBe(HttpStatus.NOT_FOUND);
    expect(result.detail).toBe("Sanction not found");
  });

  test("CANNOT_REPORT_SELF returns 400", () => {
    const result = mapModerationError({ type: "CANNOT_REPORT_SELF" }, instance);
    expect(result.status).toBe(HttpStatus.BAD_REQUEST);
    expect(result.detail).toBe("Cannot report yourself");
  });

  test("REPORT_ALREADY_RESOLVED returns 400", () => {
    const result = mapModerationError(
      { type: "REPORT_ALREADY_RESOLVED" },
      instance
    );
    expect(result.status).toBe(HttpStatus.BAD_REQUEST);
    expect(result.detail).toBe("Report has already been resolved");
  });

  test("SANCTION_ALREADY_REVOKED returns 400", () => {
    const result = mapModerationError(
      { type: "SANCTION_ALREADY_REVOKED" },
      instance
    );
    expect(result.status).toBe(HttpStatus.BAD_REQUEST);
    expect(result.detail).toBe("Sanction has already been revoked");
  });

  test("INSUFFICIENT_PERMISSIONS returns 403", () => {
    const result = mapModerationError(
      { type: "INSUFFICIENT_PERMISSIONS" },
      instance
    );
    expect(result.status).toBe(HttpStatus.FORBIDDEN);
    expect(result.detail).toBe("Insufficient permissions");
  });

  test("CANNOT_SANCTION_MODERATOR returns 403", () => {
    const result = mapModerationError(
      { type: "CANNOT_SANCTION_MODERATOR" },
      instance
    );
    expect(result.status).toBe(HttpStatus.FORBIDDEN);
    expect(result.detail).toBe("Cannot sanction a moderator or admin");
  });
});

describe("RFC 9457 Problem Details Compliance", () => {
  const instance = "/api/moderation/test";

  test("all moderation error mappings include required RFC 9457 fields", () => {
    const errors = [
      { type: "USER_NOT_FOUND" as const },
      { type: "REPORT_NOT_FOUND" as const },
      { type: "SANCTION_NOT_FOUND" as const },
      { type: "CANNOT_REPORT_SELF" as const },
      { type: "REPORT_ALREADY_RESOLVED" as const },
      { type: "SANCTION_ALREADY_REVOKED" as const },
      { type: "INSUFFICIENT_PERMISSIONS" as const },
      { type: "CANNOT_SANCTION_MODERATOR" as const },
    ];

    for (const error of errors) {
      const result = mapModerationError(error, instance);
      expect(result).toHaveProperty("type");
      expect(result).toHaveProperty("status");
      expect(result).toHaveProperty("title");
      expect(result).toHaveProperty("detail");
      expect(result).toHaveProperty("instance");
      expect(result.type).toMatch(/^(https?:\/\/|about:blank)/);
    }
  });

  test("error responses are JSON serializable", () => {
    const result = mapModerationError(
      { type: "CANNOT_SANCTION_MODERATOR" },
      instance
    );
    expect(() => JSON.stringify(result)).not.toThrow();
    const parsed = JSON.parse(JSON.stringify(result));
    expect(parsed.status).toBe(result.status);
  });
});
