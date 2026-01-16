import { err, ok, ResultAsync } from "neverthrow";

import type {
  ReportReason,
  ReportStatus,
  SanctionType,
  UserRole,
} from "../../db/schema";
import type {
  AdminStats,
  AdminUser,
  AuditLogEntry,
  ModerationError,
  Report,
  Sanction,
  SanctionStatus,
} from "./moderation.model";

import { moderationRepository } from "./moderation.repository";

abstract class ModerationService {
  // =========================================================================
  // Reports
  // =========================================================================

  /**
   * Create a new report.
   */
  static createReport(
    reporterId: number,
    reportedUserId: number,
    reason: ReportReason,
    description?: string,
    matchId?: number
  ): ResultAsync<Report, ModerationError> {
    return ResultAsync.fromPromise(
      (async () => {
        if (reporterId === reportedUserId) {
          return err({ type: "CANNOT_REPORT_SELF" as const });
        }

        const reportedUser =
          await moderationRepository.getUserById(reportedUserId);
        if (!reportedUser) {
          return err({ type: "USER_NOT_FOUND" as const });
        }

        const reporter = await moderationRepository.getUserById(reporterId);
        if (!reporter) {
          return err({ type: "USER_NOT_FOUND" as const });
        }

        const report = await moderationRepository.createReport({
          reporterId,
          reportedUserId,
          reason,
          description,
          matchId,
        });

        // Log the action
        await moderationRepository.createAuditLogEntry({
          actorId: reporterId,
          action: "report_created",
          targetUserId: reportedUserId,
          targetId: report.id,
          targetType: "report",
          details: JSON.stringify({ reason, description }),
        });

        return ok({
          id: report.id,
          reporterId: report.reporterId,
          reporterName: reporter.displayName,
          reportedUserId: report.reportedUserId,
          reportedUserName: reportedUser.displayName,
          matchId: report.matchId,
          reason: report.reason,
          description: report.description,
          status: report.status,
          resolvedBy: report.resolvedBy,
          resolvedAt: report.resolvedAt,
          resolution: report.resolution,
          createdAt: report.createdAt,
        });
      })(),
      () => ({ type: "USER_NOT_FOUND" as const })
    ).andThen((result) => result);
  }

  /**
   * Get reports list (moderator/admin only).
   */
  static getReports(
    options: {
      limit?: number;
      offset?: number;
      status?: ReportStatus;
      reason?: string;
    } = {}
  ): ResultAsync<
    { reports: Report[]; total: number; hasMore: boolean },
    never
  > {
    return ResultAsync.fromPromise(
      (async () => {
        const { limit = 20, offset = 0, status, reason } = options;

        const reportList = await moderationRepository.getReports({
          limit: limit + 1,
          offset,
          status,
          reason,
        });

        const total = await moderationRepository.getReportsCount(
          status,
          reason
        );

        const hasMore = reportList.length > limit;
        const reportsToReturn = hasMore
          ? reportList.slice(0, limit)
          : reportList;

        // Fetch user names for each report
        const reportsWithNames: Report[] = [];
        for (const report of reportsToReturn) {
          const reporter = await moderationRepository.getUserById(
            report.reporterId
          );
          const reportedUser = await moderationRepository.getUserById(
            report.reportedUserId
          );

          reportsWithNames.push({
            id: report.id,
            reporterId: report.reporterId,
            reporterName: reporter?.displayName ?? "Unknown",
            reportedUserId: report.reportedUserId,
            reportedUserName: reportedUser?.displayName ?? "Unknown",
            matchId: report.matchId,
            reason: report.reason,
            description: report.description,
            status: report.status,
            resolvedBy: report.resolvedBy,
            resolvedAt: report.resolvedAt,
            resolution: report.resolution,
            createdAt: report.createdAt,
          });
        }

        return { reports: reportsWithNames, total, hasMore };
      })(),
      (): never => {
        throw new Error("Unexpected error getting reports");
      }
    );
  }

  /**
   * Resolve a report.
   */
  static resolveReport(
    reportId: number,
    moderatorId: number,
    resolution: "warning" | "timeout" | "ban" | "no_action",
    sanctionDuration?: number,
    notes?: string
  ): ResultAsync<Report, ModerationError> {
    return ResultAsync.fromPromise(
      (async () => {
        const report = await moderationRepository.getReportById(reportId);

        if (!report) {
          return err({ type: "REPORT_NOT_FOUND" as const });
        }

        if (report.status !== "pending") {
          return err({ type: "REPORT_ALREADY_RESOLVED" as const });
        }

        // Issue sanction if needed
        if (resolution !== "no_action") {
          const sanctionResult = await ModerationService.issueSanction(
            report.reportedUserId,
            resolution as SanctionType,
            notes || `Sanction for report #${reportId}`,
            moderatorId,
            sanctionDuration,
            reportId
          );

          if (sanctionResult.isErr()) {
            return err(sanctionResult.error);
          }
        }

        // Update report status
        const status: ReportStatus =
          resolution === "no_action" ? "dismissed" : "resolved";
        const updated = await moderationRepository.resolveReport(reportId, {
          resolvedBy: moderatorId,
          resolution,
          status,
        });

        // Log the action
        await moderationRepository.createAuditLogEntry({
          actorId: moderatorId,
          action: "report_resolved",
          targetUserId: report.reportedUserId,
          targetId: reportId,
          targetType: "report",
          details: JSON.stringify({ resolution, sanctionDuration, notes }),
        });

        const reporter = await moderationRepository.getUserById(
          report.reporterId
        );
        const reportedUser = await moderationRepository.getUserById(
          report.reportedUserId
        );

        return ok({
          id: updated.id,
          reporterId: updated.reporterId,
          reporterName: reporter?.displayName ?? "Unknown",
          reportedUserId: updated.reportedUserId,
          reportedUserName: reportedUser?.displayName ?? "Unknown",
          matchId: updated.matchId,
          reason: updated.reason,
          description: updated.description,
          status: updated.status,
          resolvedBy: updated.resolvedBy,
          resolvedAt: updated.resolvedAt,
          resolution: updated.resolution,
          createdAt: updated.createdAt,
        });
      })(),
      () => ({ type: "REPORT_NOT_FOUND" as const })
    ).andThen((result) => result);
  }

  // =========================================================================
  // Sanctions
  // =========================================================================

  /**
   * Issue a sanction.
   */
  static issueSanction(
    userId: number,
    type: SanctionType,
    reason: string,
    issuedBy: number,
    duration?: number, // hours
    reportId?: number
  ): ResultAsync<Sanction, ModerationError> {
    return ResultAsync.fromPromise(
      (async () => {
        const targetUser = await moderationRepository.getUserById(userId);
        if (!targetUser) {
          return err({ type: "USER_NOT_FOUND" as const });
        }

        // Check if target is a moderator/admin (can't sanction them)
        const targetRole = await moderationRepository.getUserRole(userId);
        if (
          targetRole &&
          (targetRole.role === "moderator" || targetRole.role === "admin")
        ) {
          return err({ type: "CANNOT_SANCTION_MODERATOR" as const });
        }

        const issuer = await moderationRepository.getUserById(issuedBy);
        if (!issuer) {
          return err({ type: "USER_NOT_FOUND" as const });
        }

        let expiresAt: Date | undefined;
        if (duration && type !== "ban") {
          expiresAt = new Date();
          expiresAt.setHours(expiresAt.getHours() + duration);
        }

        const sanction = await moderationRepository.createSanction({
          userId,
          type,
          reason,
          issuedBy,
          expiresAt,
          reportId,
        });

        // Log the action
        await moderationRepository.createAuditLogEntry({
          actorId: issuedBy,
          action: "sanction_issued",
          targetUserId: userId,
          targetId: sanction.id,
          targetType: "sanction",
          details: JSON.stringify({ type, reason, duration }),
        });

        return ok({
          id: sanction.id,
          userId: sanction.userId,
          userName: targetUser.displayName,
          type: sanction.type,
          reason: sanction.reason,
          reportId: sanction.reportId,
          issuedBy: sanction.issuedBy,
          issuedByName: issuer.displayName,
          expiresAt: sanction.expiresAt,
          isActive: sanction.isActive,
          revokedAt: sanction.revokedAt,
          revokedBy: sanction.revokedBy,
          createdAt: sanction.createdAt,
        });
      })(),
      () => ({ type: "USER_NOT_FOUND" as const })
    ).andThen((result) => result);
  }

  /**
   * Revoke a sanction.
   */
  static revokeSanction(
    sanctionId: number,
    revokedBy: number
  ): ResultAsync<Sanction, ModerationError> {
    return ResultAsync.fromPromise(
      (async () => {
        const sanction = await moderationRepository.getSanctionById(sanctionId);

        if (!sanction) {
          return err({ type: "SANCTION_NOT_FOUND" as const });
        }

        if (!sanction.isActive) {
          return err({ type: "SANCTION_ALREADY_REVOKED" as const });
        }

        const updated = await moderationRepository.revokeSanction(
          sanctionId,
          revokedBy
        );

        const targetUser = await moderationRepository.getUserById(
          updated.userId
        );
        const issuer = await moderationRepository.getUserById(updated.issuedBy);

        // Log the action
        await moderationRepository.createAuditLogEntry({
          actorId: revokedBy,
          action: "sanction_revoked",
          targetUserId: updated.userId,
          targetId: sanctionId,
          targetType: "sanction",
        });

        return ok({
          id: updated.id,
          userId: updated.userId,
          userName: targetUser?.displayName ?? "Unknown",
          type: updated.type,
          reason: updated.reason,
          reportId: updated.reportId,
          issuedBy: updated.issuedBy,
          issuedByName: issuer?.displayName ?? "Unknown",
          expiresAt: updated.expiresAt,
          isActive: updated.isActive,
          revokedAt: updated.revokedAt,
          revokedBy: updated.revokedBy,
          createdAt: updated.createdAt,
        });
      })(),
      () => ({ type: "SANCTION_NOT_FOUND" as const })
    ).andThen((result) => result);
  }

  /**
   * Get sanctions list.
   */
  static getSanctions(
    options: {
      limit?: number;
      offset?: number;
      userId?: number;
      type?: SanctionType;
      isActive?: boolean;
    } = {}
  ): ResultAsync<
    { sanctions: Sanction[]; total: number; hasMore: boolean },
    never
  > {
    return ResultAsync.fromPromise(
      (async () => {
        const { limit = 20, offset = 0, userId, type, isActive } = options;

        const sanctionList = await moderationRepository.getSanctions({
          limit: limit + 1,
          offset,
          userId,
          type,
          isActive,
        });

        const total = await moderationRepository.getSanctionsCount(
          userId,
          type,
          isActive
        );

        const hasMore = sanctionList.length > limit;
        const sanctionsToReturn = hasMore
          ? sanctionList.slice(0, limit)
          : sanctionList;

        // Fetch user names
        const sanctionsWithNames: Sanction[] = [];
        for (const sanction of sanctionsToReturn) {
          const targetUser = await moderationRepository.getUserById(
            sanction.userId
          );
          const issuer = await moderationRepository.getUserById(
            sanction.issuedBy
          );

          sanctionsWithNames.push({
            id: sanction.id,
            userId: sanction.userId,
            userName: targetUser?.displayName ?? "Unknown",
            type: sanction.type,
            reason: sanction.reason,
            reportId: sanction.reportId,
            issuedBy: sanction.issuedBy,
            issuedByName: issuer?.displayName ?? "Unknown",
            expiresAt: sanction.expiresAt,
            isActive: sanction.isActive,
            revokedAt: sanction.revokedAt,
            revokedBy: sanction.revokedBy,
            createdAt: sanction.createdAt,
          });
        }

        return { sanctions: sanctionsWithNames, total, hasMore };
      })(),
      (): never => {
        throw new Error("Unexpected error getting sanctions");
      }
    );
  }

  /**
   * Check if user is sanctioned.
   */
  static getSanctionStatus(userId: number): ResultAsync<SanctionStatus, never> {
    return ResultAsync.fromPromise(
      (async () => {
        // First, expire old sanctions
        await moderationRepository.expireOldSanctions();

        const activeSanctions =
          await moderationRepository.getActiveSanctions(userId);

        const isBanned = activeSanctions.some((s) => s.type === "ban");
        const timeoutSanction = activeSanctions.find(
          (s) => s.type === "timeout"
        );
        const isTimedOut = !!timeoutSanction;

        return {
          isBanned,
          isTimedOut,
          activeUntil: timeoutSanction?.expiresAt ?? null,
          activeSanctions: activeSanctions.length,
        };
      })(),
      (): never => {
        throw new Error("Unexpected error checking sanction status");
      }
    );
  }

  // =========================================================================
  // Roles & Permissions
  // =========================================================================

  /**
   * Get user's role.
   */
  static getUserRole(userId: number): ResultAsync<UserRole, never> {
    return ResultAsync.fromPromise(
      (async () => {
        const role = await moderationRepository.getUserRole(userId);
        return (role?.role ?? "user") as UserRole;
      })(),
      (): never => {
        throw new Error("Unexpected error getting user role");
      }
    );
  }

  /**
   * Check if user has moderator or admin role.
   */
  static hasModeratorPermissions(userId: number): ResultAsync<boolean, never> {
    return ResultAsync.fromPromise(
      (async () => {
        const role = await moderationRepository.getUserRole(userId);
        return role?.role === "moderator" || role?.role === "admin";
      })(),
      (): never => {
        throw new Error("Unexpected error checking permissions");
      }
    );
  }

  /**
   * Check if user has admin role.
   */
  static hasAdminPermissions(userId: number): ResultAsync<boolean, never> {
    return ResultAsync.fromPromise(
      (async () => {
        const role = await moderationRepository.getUserRole(userId);
        return role?.role === "admin";
      })(),
      (): never => {
        throw new Error("Unexpected error checking permissions");
      }
    );
  }

  // =========================================================================
  // Audit Log
  // =========================================================================

  /**
   * Get audit log.
   */
  static getAuditLog(
    options: {
      limit?: number;
      offset?: number;
      actorId?: number;
      targetUserId?: number;
      action?: string;
    } = {}
  ): ResultAsync<
    { entries: AuditLogEntry[]; total: number; hasMore: boolean },
    never
  > {
    return ResultAsync.fromPromise(
      (async () => {
        const {
          limit = 20,
          offset = 0,
          actorId,
          targetUserId,
          action,
        } = options;

        const entries = await moderationRepository.getAuditLog({
          limit: limit + 1,
          offset,
          actorId,
          targetUserId,
          action,
        });

        const total = await moderationRepository.getAuditLogCount(
          actorId,
          targetUserId,
          action
        );

        const hasMore = entries.length > limit;
        const entriesToReturn = hasMore ? entries.slice(0, limit) : entries;

        // Fetch user names
        const entriesWithNames: AuditLogEntry[] = [];
        for (const entry of entriesToReturn) {
          const actor = await moderationRepository.getUserById(entry.actorId);
          const targetUser = entry.targetUserId
            ? await moderationRepository.getUserById(entry.targetUserId)
            : null;

          entriesWithNames.push({
            id: entry.id,
            actorId: entry.actorId,
            actorName: actor?.displayName ?? "Unknown",
            action: entry.action,
            targetUserId: entry.targetUserId,
            targetUserName: targetUser?.displayName ?? null,
            targetId: entry.targetId,
            targetType: entry.targetType,
            details: entry.details,
            createdAt: entry.createdAt,
          });
        }

        return { entries: entriesWithNames, total, hasMore };
      })(),
      (): never => {
        throw new Error("Unexpected error getting audit log");
      }
    );
  }

  // =========================================================================
  // Admin Panel
  // =========================================================================

  /**
   * Get list of users for admin panel.
   */
  static getAdminUsers(options: {
    limit?: number;
    offset?: number;
    search?: string;
    role?: UserRole;
    sortBy?: "createdAt" | "displayName" | "email";
    sortOrder?: "asc" | "desc";
  }): ResultAsync<
    { users: AdminUser[]; total: number; hasMore: boolean },
    never
  > {
    return ResultAsync.fromPromise(
      (async () => {
        const { limit = 20, ...rest } = options;

        const userList = await moderationRepository.getAdminUsers({
          limit: limit + 1,
          ...rest,
        });

        const total = await moderationRepository.getAdminUsersCount({
          search: options.search,
          role: options.role,
        });

        const hasMore = userList.length > limit;
        const usersToReturn = hasMore ? userList.slice(0, limit) : userList;

        // Get stats for each user
        const usersWithStats: AdminUser[] = [];
        for (const user of usersToReturn) {
          const details = await moderationRepository.getUserWithDetails(
            user.id
          );
          if (details) {
            usersWithStats.push({
              id: details.id,
              email: details.email,
              displayName: details.displayName,
              avatarUrl: details.avatarUrl,
              emailVerified: details.emailVerified,
              twoFactorEnabled: details.twoFactorEnabled,
              role: details.role,
              createdAt: details.createdAt,
              activeSanctions: details.activeSanctions,
              totalReports: details.totalReports,
            });
          }
        }

        return { users: usersWithStats, total, hasMore };
      })(),
      (): never => {
        throw new Error("Unexpected error getting admin users");
      }
    );
  }

  /**
   * Get a single user's details for admin panel.
   */
  static getAdminUserDetails(
    userId: number
  ): ResultAsync<AdminUser, ModerationError> {
    return ResultAsync.fromPromise(
      (async () => {
        const details = await moderationRepository.getUserWithDetails(userId);

        if (!details) {
          return err({ type: "USER_NOT_FOUND" as const });
        }

        return ok({
          id: details.id,
          email: details.email,
          displayName: details.displayName,
          avatarUrl: details.avatarUrl,
          emailVerified: details.emailVerified,
          twoFactorEnabled: details.twoFactorEnabled,
          role: details.role,
          createdAt: details.createdAt,
          activeSanctions: details.activeSanctions,
          totalReports: details.totalReports,
        });
      })(),
      () => ({ type: "USER_NOT_FOUND" as const })
    ).andThen((result) => result);
  }

  /**
   * Update a user's role (admin only).
   */
  static updateUserRole(
    adminId: number,
    targetUserId: number,
    newRole: UserRole,
    reason?: string
  ): ResultAsync<AdminUser, ModerationError> {
    return ResultAsync.fromPromise(
      (async () => {
        // Cannot modify own role
        if (adminId === targetUserId) {
          return err({ type: "CANNOT_MODIFY_SELF" as const });
        }

        const targetUser =
          await moderationRepository.getUserWithDetails(targetUserId);
        if (!targetUser) {
          return err({ type: "USER_NOT_FOUND" as const });
        }

        // Cannot modify another admin's role (unless you're a super admin, but we don't have that)
        if (targetUser.role === "admin") {
          return err({ type: "CANNOT_MODIFY_ADMIN" as const });
        }

        // Check if user already has a role record
        const existingRole =
          await moderationRepository.getUserRole(targetUserId);
        if (existingRole) {
          await moderationRepository.updateUserRole(
            targetUserId,
            newRole,
            adminId
          );
        } else {
          await moderationRepository.createUserRole(
            targetUserId,
            newRole,
            adminId
          );
        }

        // Log the action
        await moderationRepository.createAuditLogEntry({
          actorId: adminId,
          action: "role_changed",
          targetUserId,
          details: JSON.stringify({
            oldRole: targetUser.role,
            newRole,
            reason,
          }),
        });

        // Return updated user
        const updatedUser =
          await moderationRepository.getUserWithDetails(targetUserId);

        return ok({
          id: updatedUser!.id,
          email: updatedUser!.email,
          displayName: updatedUser!.displayName,
          avatarUrl: updatedUser!.avatarUrl,
          emailVerified: updatedUser!.emailVerified,
          twoFactorEnabled: updatedUser!.twoFactorEnabled,
          role: updatedUser!.role,
          createdAt: updatedUser!.createdAt,
          activeSanctions: updatedUser!.activeSanctions,
          totalReports: updatedUser!.totalReports,
        });
      })(),
      () => ({ type: "USER_NOT_FOUND" as const })
    ).andThen((result) => result);
  }

  /**
   * Delete a user (admin only).
   */
  static deleteUser(
    adminId: number,
    targetUserId: number,
    reason: string
  ): ResultAsync<void, ModerationError> {
    return ResultAsync.fromPromise(
      (async () => {
        // Cannot delete self
        if (adminId === targetUserId) {
          return err({ type: "CANNOT_MODIFY_SELF" as const });
        }

        const targetUser =
          await moderationRepository.getUserWithDetails(targetUserId);
        if (!targetUser) {
          return err({ type: "USER_NOT_FOUND" as const });
        }

        // Cannot delete another admin
        if (targetUser.role === "admin") {
          return err({ type: "CANNOT_MODIFY_ADMIN" as const });
        }

        // Log the action before deletion
        await moderationRepository.createAuditLogEntry({
          actorId: adminId,
          action: "user_deleted",
          targetUserId,
          details: JSON.stringify({
            email: targetUser.email,
            displayName: targetUser.displayName,
            reason,
          }),
        });

        // Delete the user
        await moderationRepository.deleteUser(targetUserId);

        return ok(undefined);
      })(),
      () => ({ type: "USER_NOT_FOUND" as const })
    ).andThen((result) => result);
  }

  /**
   * Get admin dashboard stats.
   */
  static getAdminStats(): ResultAsync<AdminStats, never> {
    return ResultAsync.fromPromise(
      moderationRepository.getAdminStats(),
      (): never => {
        throw new Error("Unexpected error getting admin stats");
      }
    );
  }
}

export { ModerationService };
