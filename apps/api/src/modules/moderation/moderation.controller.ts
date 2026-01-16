import { Elysia } from "elysia";

import { forbidden } from "../../common/errors";
import { authGuard } from "../../common/guards/auth.macro";
import { ModerationModel, mapModerationError } from "./moderation.model";
import { ModerationService } from "./moderation.service";

export const moderationController = new Elysia({ prefix: "/moderation" })
  .use(authGuard)

  // =========================================================================
  // User-facing endpoints
  // =========================================================================

  // Submit a report
  .post(
    "/reports",
    async ({ user, body, request, set }) => {
      const instance = new URL(request.url).pathname;
      const result = await ModerationService.createReport(
        user.id,
        body.reportedUserId,
        body.reason,
        body.description,
        body.matchId
      );

      return result.match(
        (report) => ({ report }),
        (error) => {
          const problem = mapModerationError(error, instance);
          set.status = problem.status;
          set.headers["Content-Type"] = "application/problem+json";
          return problem;
        }
      );
    },
    {
      body: ModerationModel.createReport,
    }
  )

  // Check sanction status (useful for frontend to show warnings)
  .get("/status", async ({ user }) => {
    const result = await ModerationService.getSanctionStatus(user.id);

    return result.match(
      (status) => ({ status }),
      () => ({
        status: {
          isBanned: false,
          isTimedOut: false,
          activeUntil: null,
          activeSanctions: 0,
        },
      })
    );
  })

  // =========================================================================
  // Moderator/Admin endpoints
  // =========================================================================

  // Get reports list
  .get(
    "/reports",
    async ({ user, query, request, set }) => {
      const instance = new URL(request.url).pathname;

      // Check permissions
      const hasPermission = await ModerationService.hasModeratorPermissions(
        user.id
      );
      if (hasPermission.isErr() || !hasPermission.value) {
        const problem = forbidden("Insufficient permissions", { instance });
        set.status = problem.status;
        set.headers["Content-Type"] = "application/problem+json";
        return problem;
      }

      const result = await ModerationService.getReports({
        limit: query.limit,
        offset: query.offset,
        status: query.status,
        reason: query.reason,
      });

      return result.match(
        (data) => data,
        () => ({ reports: [], total: 0, hasMore: false })
      );
    },
    {
      query: ModerationModel.reportsQuery,
    }
  )

  // Resolve a report
  .post(
    "/reports/:reportId/resolve",
    async ({ user, params, body, request, set }) => {
      const instance = new URL(request.url).pathname;

      // Check permissions
      const hasPermission = await ModerationService.hasModeratorPermissions(
        user.id
      );
      if (hasPermission.isErr() || !hasPermission.value) {
        const problem = forbidden("Insufficient permissions", { instance });
        set.status = problem.status;
        set.headers["Content-Type"] = "application/problem+json";
        return problem;
      }

      const result = await ModerationService.resolveReport(
        params.reportId,
        user.id,
        body.resolution,
        body.sanctionDuration,
        body.notes
      );

      return result.match(
        (report) => ({ report }),
        (error) => {
          const problem = mapModerationError(error, instance);
          set.status = problem.status;
          set.headers["Content-Type"] = "application/problem+json";
          return problem;
        }
      );
    },
    {
      params: ModerationModel.reportIdParam,
      body: ModerationModel.resolveReport,
    }
  )

  // Get sanctions list
  .get("/sanctions", async ({ user, request, set }) => {
    const instance = new URL(request.url).pathname;

    // Check permissions
    const hasPermission = await ModerationService.hasModeratorPermissions(
      user.id
    );
    if (hasPermission.isErr() || !hasPermission.value) {
      const problem = forbidden("Insufficient permissions", { instance });
      set.status = problem.status;
      set.headers["Content-Type"] = "application/problem+json";
      return problem;
    }

    const result = await ModerationService.getSanctions();

    return result.match(
      (data) => data,
      () => ({ sanctions: [], total: 0, hasMore: false })
    );
  })

  // Issue a sanction (admin only)
  .post(
    "/sanctions",
    async ({ user, body, request, set }) => {
      const instance = new URL(request.url).pathname;

      // Check admin permissions
      const hasPermission = await ModerationService.hasAdminPermissions(
        user.id
      );
      if (hasPermission.isErr() || !hasPermission.value) {
        const problem = forbidden("Insufficient permissions", { instance });
        set.status = problem.status;
        set.headers["Content-Type"] = "application/problem+json";
        return problem;
      }

      const result = await ModerationService.issueSanction(
        body.userId,
        body.type,
        body.reason,
        user.id,
        body.duration,
        body.reportId
      );

      return result.match(
        (sanction) => ({ sanction }),
        (error) => {
          const problem = mapModerationError(error, instance);
          set.status = problem.status;
          set.headers["Content-Type"] = "application/problem+json";
          return problem;
        }
      );
    },
    {
      body: ModerationModel.issueSanction,
    }
  )

  // Revoke a sanction (admin only)
  .post(
    "/sanctions/:sanctionId/revoke",
    async ({ user, params, request, set }) => {
      const instance = new URL(request.url).pathname;

      // Check admin permissions
      const hasPermission = await ModerationService.hasAdminPermissions(
        user.id
      );
      if (hasPermission.isErr() || !hasPermission.value) {
        const problem = forbidden("Insufficient permissions", { instance });
        set.status = problem.status;
        set.headers["Content-Type"] = "application/problem+json";
        return problem;
      }

      const result = await ModerationService.revokeSanction(
        params.sanctionId,
        user.id
      );

      return result.match(
        (sanction) => ({ sanction }),
        (error) => {
          const problem = mapModerationError(error, instance);
          set.status = problem.status;
          set.headers["Content-Type"] = "application/problem+json";
          return problem;
        }
      );
    },
    {
      params: ModerationModel.sanctionIdParam,
    }
  )

  // Get audit log (admin only)
  .get(
    "/audit-log",
    async ({ user, query, request, set }) => {
      const instance = new URL(request.url).pathname;

      // Check admin permissions
      const hasPermission = await ModerationService.hasAdminPermissions(
        user.id
      );
      if (hasPermission.isErr() || !hasPermission.value) {
        const problem = forbidden("Insufficient permissions", { instance });
        set.status = problem.status;
        set.headers["Content-Type"] = "application/problem+json";
        return problem;
      }

      const result = await ModerationService.getAuditLog({
        limit: query.limit,
        offset: query.offset,
        actorId: query.actorId,
        targetUserId: query.targetUserId,
        action: query.action,
      });

      return result.match(
        (data) => data,
        () => ({ entries: [], total: 0, hasMore: false })
      );
    },
    {
      query: ModerationModel.auditLogQuery,
    }
  )

  // Get user's moderation history (admin only)
  .get(
    "/users/:id/history",
    async ({ user, params, request, set }) => {
      const instance = new URL(request.url).pathname;

      // Check admin permissions
      const hasPermission = await ModerationService.hasAdminPermissions(
        user.id
      );
      if (hasPermission.isErr() || !hasPermission.value) {
        const problem = forbidden("Insufficient permissions", { instance });
        set.status = problem.status;
        set.headers["Content-Type"] = "application/problem+json";
        return problem;
      }

      const sanctionsResult = await ModerationService.getSanctions({
        userId: params.id,
      });

      return sanctionsResult.match(
        (data) => ({ sanctions: data.sanctions }),
        () => ({ sanctions: [] })
      );
    },
    {
      params: ModerationModel.userIdParam,
    }
  )

  // =========================================================================
  // Admin Panel endpoints
  // =========================================================================

  // Get admin dashboard stats
  .get("/admin/dashboard", async ({ user, request, set }) => {
    const instance = new URL(request.url).pathname;

    // Check admin permissions
    const hasPermission = await ModerationService.hasAdminPermissions(user.id);
    if (hasPermission.isErr() || !hasPermission.value) {
      const problem = forbidden("Insufficient permissions", { instance });
      set.status = problem.status;
      set.headers["Content-Type"] = "application/problem+json";
      return problem;
    }

    const result = await ModerationService.getAdminStats();

    return result.match(
      (stats) => ({ stats }),
      () => ({
        stats: {
          totalUsers: 0,
          totalModerators: 0,
          totalAdmins: 0,
          pendingReports: 0,
          activeSanctions: 0,
          recentAuditLogs: 0,
        },
      })
    );
  })

  // Get users list for admin panel
  .get(
    "/admin/users",
    async ({ user, query, request, set }) => {
      const instance = new URL(request.url).pathname;

      // Check admin permissions
      const hasPermission = await ModerationService.hasAdminPermissions(
        user.id
      );
      if (hasPermission.isErr() || !hasPermission.value) {
        const problem = forbidden("Insufficient permissions", { instance });
        set.status = problem.status;
        set.headers["Content-Type"] = "application/problem+json";
        return problem;
      }

      const result = await ModerationService.getAdminUsers({
        limit: query.limit,
        offset: query.offset,
        search: query.search,
        role: query.role,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
      });

      return result.match(
        (data) => data,
        () => ({ users: [], total: 0, hasMore: false })
      );
    },
    {
      query: ModerationModel.adminUsersQuery,
    }
  )

  // Get single user details for admin panel
  .get(
    "/admin/users/:id",
    async ({ user, params, request, set }) => {
      const instance = new URL(request.url).pathname;

      // Check admin permissions
      const hasPermission = await ModerationService.hasAdminPermissions(
        user.id
      );
      if (hasPermission.isErr() || !hasPermission.value) {
        const problem = forbidden("Insufficient permissions", { instance });
        set.status = problem.status;
        set.headers["Content-Type"] = "application/problem+json";
        return problem;
      }

      const result = await ModerationService.getAdminUserDetails(params.id);

      return result.match(
        (adminUser) => ({ user: adminUser }),
        (error) => {
          const problem = mapModerationError(error, instance);
          set.status = problem.status;
          set.headers["Content-Type"] = "application/problem+json";
          return problem;
        }
      );
    },
    {
      params: ModerationModel.userIdParam,
    }
  )

  // Update user role
  .patch(
    "/admin/users/role",
    async ({ user, body, request, set }) => {
      const instance = new URL(request.url).pathname;

      // Check admin permissions
      const hasPermission = await ModerationService.hasAdminPermissions(
        user.id
      );
      if (hasPermission.isErr() || !hasPermission.value) {
        const problem = forbidden("Insufficient permissions", { instance });
        set.status = problem.status;
        set.headers["Content-Type"] = "application/problem+json";
        return problem;
      }

      const result = await ModerationService.updateUserRole(
        user.id,
        body.userId,
        body.role,
        body.reason
      );

      return result.match(
        (adminUser) => ({ user: adminUser }),
        (error) => {
          const problem = mapModerationError(error, instance);
          set.status = problem.status;
          set.headers["Content-Type"] = "application/problem+json";
          return problem;
        }
      );
    },
    {
      body: ModerationModel.adminUpdateRole,
    }
  )

  // Delete user
  .delete(
    "/admin/users",
    async ({ user, body, request, set }) => {
      const instance = new URL(request.url).pathname;

      // Check admin permissions
      const hasPermission = await ModerationService.hasAdminPermissions(
        user.id
      );
      if (hasPermission.isErr() || !hasPermission.value) {
        const problem = forbidden("Insufficient permissions", { instance });
        set.status = problem.status;
        set.headers["Content-Type"] = "application/problem+json";
        return problem;
      }

      const result = await ModerationService.deleteUser(
        user.id,
        body.userId,
        body.reason
      );

      return result.match(
        () => ({ message: "User deleted successfully" }),
        (error) => {
          const problem = mapModerationError(error, instance);
          set.status = problem.status;
          set.headers["Content-Type"] = "application/problem+json";
          return problem;
        }
      );
    },
    {
      body: ModerationModel.adminDeleteUser,
    }
  );
