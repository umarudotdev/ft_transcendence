import { t } from "elysia";

import { badRequest, forbidden, notFound } from "../../common/errors";

export const ModerationModel = {
  createReport: t.Object({
    reportedUserId: t.Number(),
    reason: t.Union([
      t.Literal("afk"),
      t.Literal("cheating"),
      t.Literal("harassment"),
      t.Literal("inappropriate_name"),
      t.Literal("other"),
    ]),
    description: t.Optional(t.String({ maxLength: 500 })),
    matchId: t.Optional(t.Number()),
  }),

  reportsQuery: t.Object({
    limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100, default: 20 })),
    offset: t.Optional(t.Numeric({ minimum: 0, default: 0 })),
    status: t.Optional(
      t.Union([
        t.Literal("pending"),
        t.Literal("reviewed"),
        t.Literal("resolved"),
        t.Literal("dismissed"),
      ])
    ),
    reason: t.Optional(t.String()),
  }),

  resolveReport: t.Object({
    resolution: t.Union([
      t.Literal("warning"),
      t.Literal("timeout"),
      t.Literal("ban"),
      t.Literal("no_action"),
    ]),
    sanctionDuration: t.Optional(t.Number({ minimum: 1 })), // hours
    notes: t.Optional(t.String({ maxLength: 500 })),
  }),

  issueSanction: t.Object({
    userId: t.Number(),
    type: t.Union([
      t.Literal("warning"),
      t.Literal("timeout"),
      t.Literal("ban"),
    ]),
    reason: t.String({ minLength: 1, maxLength: 500 }),
    duration: t.Optional(t.Number({ minimum: 1 })), // hours, null for permanent
    reportId: t.Optional(t.Number()),
  }),

  reportIdParam: t.Object({
    reportId: t.Numeric(),
  }),

  sanctionIdParam: t.Object({
    sanctionId: t.Numeric(),
  }),

  userIdParam: t.Object({
    id: t.Numeric(),
  }),

  auditLogQuery: t.Object({
    limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100, default: 20 })),
    offset: t.Optional(t.Numeric({ minimum: 0, default: 0 })),
    actorId: t.Optional(t.Numeric()),
    targetUserId: t.Optional(t.Numeric()),
    action: t.Optional(t.String()),
  }),

  report: t.Object({
    id: t.Number(),
    reporterId: t.Number(),
    reporterName: t.String(),
    reportedUserId: t.Number(),
    reportedUserName: t.String(),
    matchId: t.Nullable(t.Number()),
    reason: t.String(),
    description: t.Nullable(t.String()),
    status: t.String(),
    resolvedBy: t.Nullable(t.Number()),
    resolvedAt: t.Nullable(t.Date()),
    resolution: t.Nullable(t.String()),
    createdAt: t.Date(),
  }),

  sanction: t.Object({
    id: t.Number(),
    userId: t.Number(),
    userName: t.String(),
    type: t.String(),
    reason: t.String(),
    reportId: t.Nullable(t.Number()),
    issuedBy: t.Number(),
    issuedByName: t.String(),
    expiresAt: t.Nullable(t.Date()),
    isActive: t.Boolean(),
    revokedAt: t.Nullable(t.Date()),
    revokedBy: t.Nullable(t.Number()),
    createdAt: t.Date(),
  }),

  auditLogEntry: t.Object({
    id: t.Number(),
    actorId: t.Number(),
    actorName: t.String(),
    action: t.String(),
    targetUserId: t.Nullable(t.Number()),
    targetUserName: t.Nullable(t.String()),
    targetId: t.Nullable(t.Number()),
    targetType: t.Nullable(t.String()),
    details: t.Nullable(t.String()),
    createdAt: t.Date(),
  }),

  userRole: t.Object({
    userId: t.Number(),
    role: t.String(),
  }),

  sanctionStatus: t.Object({
    isBanned: t.Boolean(),
    isTimedOut: t.Boolean(),
    activeUntil: t.Nullable(t.Date()),
    activeSanctions: t.Number(),
  }),

  moderationError: t.Union([
    t.Object({ type: t.Literal("USER_NOT_FOUND") }),
    t.Object({ type: t.Literal("REPORT_NOT_FOUND") }),
    t.Object({ type: t.Literal("SANCTION_NOT_FOUND") }),
    t.Object({ type: t.Literal("CANNOT_REPORT_SELF") }),
    t.Object({ type: t.Literal("REPORT_ALREADY_RESOLVED") }),
    t.Object({ type: t.Literal("SANCTION_ALREADY_REVOKED") }),
    t.Object({ type: t.Literal("INSUFFICIENT_PERMISSIONS") }),
    t.Object({ type: t.Literal("CANNOT_SANCTION_MODERATOR") }),
  ]),
};

export type CreateReportBody = (typeof ModerationModel.createReport)["static"];
export type ReportsQuery = (typeof ModerationModel.reportsQuery)["static"];
export type ResolveReportBody =
  (typeof ModerationModel.resolveReport)["static"];
export type IssueSanctionBody =
  (typeof ModerationModel.issueSanction)["static"];
export type ReportIdParam = (typeof ModerationModel.reportIdParam)["static"];
export type SanctionIdParam =
  (typeof ModerationModel.sanctionIdParam)["static"];
export type UserIdParam = (typeof ModerationModel.userIdParam)["static"];
export type AuditLogQuery = (typeof ModerationModel.auditLogQuery)["static"];

export type Report = (typeof ModerationModel.report)["static"];
export type Sanction = (typeof ModerationModel.sanction)["static"];
export type AuditLogEntry = (typeof ModerationModel.auditLogEntry)["static"];
export type UserRole = (typeof ModerationModel.userRole)["static"];
export type SanctionStatus = (typeof ModerationModel.sanctionStatus)["static"];

export type ModerationError =
  (typeof ModerationModel.moderationError)["static"];

/**
 * Maps moderation errors to RFC 9457 Problem Details.
 */
export function mapModerationError(error: ModerationError, instance: string) {
  switch (error.type) {
    case "USER_NOT_FOUND":
      return notFound("User not found", { instance });
    case "REPORT_NOT_FOUND":
      return notFound("Report not found", { instance });
    case "SANCTION_NOT_FOUND":
      return notFound("Sanction not found", { instance });
    case "CANNOT_REPORT_SELF":
      return badRequest("Cannot report yourself", { instance });
    case "REPORT_ALREADY_RESOLVED":
      return badRequest("Report has already been resolved", { instance });
    case "SANCTION_ALREADY_REVOKED":
      return badRequest("Sanction has already been revoked", { instance });
    case "INSUFFICIENT_PERMISSIONS":
      return forbidden("Insufficient permissions", { instance });
    case "CANNOT_SANCTION_MODERATOR":
      return forbidden("Cannot sanction a moderator or admin", { instance });
  }
}
