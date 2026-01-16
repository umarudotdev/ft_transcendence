import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  ilike,
  isNull,
  lt,
  or,
} from "drizzle-orm";

import { db } from "../../db";
import {
  type ReportReason,
  type ReportStatus,
  type SanctionType,
  type UserRole,
  moderationAuditLog,
  reports,
  sanctions,
  userRoles,
  users,
} from "../../db/schema";

export const moderationRepository = {
  // =========================================================================
  // Reports
  // =========================================================================

  async createReport(data: {
    reporterId: number;
    reportedUserId: number;
    reason: ReportReason;
    description?: string;
    matchId?: number;
  }) {
    const [report] = await db.insert(reports).values(data).returning();

    return report;
  },

  async getReportById(reportId: number) {
    return db.query.reports.findFirst({
      where: eq(reports.id, reportId),
    });
  },

  async getReports(options: {
    limit?: number;
    offset?: number;
    status?: ReportStatus;
    reason?: string;
  }) {
    const { limit = 20, offset = 0, status, reason } = options;

    const conditions: ReturnType<typeof eq>[] = [];
    if (status) {
      conditions.push(eq(reports.status, status));
    }
    if (reason) {
      conditions.push(eq(reports.reason, reason));
    }

    // Get reports with reporter and reported user info
    const reportList = await db
      .select({
        id: reports.id,
        reporterId: reports.reporterId,
        reportedUserId: reports.reportedUserId,
        matchId: reports.matchId,
        reason: reports.reason,
        description: reports.description,
        status: reports.status,
        resolvedBy: reports.resolvedBy,
        resolvedAt: reports.resolvedAt,
        resolution: reports.resolution,
        createdAt: reports.createdAt,
      })
      .from(reports)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(reports.createdAt))
      .limit(limit)
      .offset(offset);

    return reportList;
  },

  async getReportsCount(status?: ReportStatus, reason?: string) {
    const conditions: ReturnType<typeof eq>[] = [];
    if (status) {
      conditions.push(eq(reports.status, status));
    }
    if (reason) {
      conditions.push(eq(reports.reason, reason));
    }

    const [result] = await db
      .select({ count: count() })
      .from(reports)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    return result?.count ?? 0;
  },

  async resolveReport(
    reportId: number,
    data: {
      resolvedBy: number;
      resolution: string;
      status: ReportStatus;
    }
  ) {
    const [updated] = await db
      .update(reports)
      .set({
        resolvedBy: data.resolvedBy,
        resolvedAt: new Date(),
        resolution: data.resolution,
        status: data.status,
      })
      .where(eq(reports.id, reportId))
      .returning();

    return updated;
  },

  // =========================================================================
  // Sanctions
  // =========================================================================

  async createSanction(data: {
    userId: number;
    type: SanctionType;
    reason: string;
    issuedBy: number;
    expiresAt?: Date;
    reportId?: number;
  }) {
    const [sanction] = await db.insert(sanctions).values(data).returning();

    return sanction;
  },

  async getSanctionById(sanctionId: number) {
    return db.query.sanctions.findFirst({
      where: eq(sanctions.id, sanctionId),
    });
  },

  async getSanctions(options: {
    limit?: number;
    offset?: number;
    userId?: number;
    type?: SanctionType;
    isActive?: boolean;
  }) {
    const { limit = 20, offset = 0, userId, type, isActive } = options;

    const conditions: ReturnType<typeof eq>[] = [];
    if (userId) {
      conditions.push(eq(sanctions.userId, userId));
    }
    if (type) {
      conditions.push(eq(sanctions.type, type));
    }
    if (isActive !== undefined) {
      conditions.push(eq(sanctions.isActive, isActive));
    }

    return db.query.sanctions.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      orderBy: [desc(sanctions.createdAt)],
      limit,
      offset,
    });
  },

  async getSanctionsCount(
    userId?: number,
    type?: SanctionType,
    isActive?: boolean
  ) {
    const conditions: ReturnType<typeof eq>[] = [];
    if (userId) {
      conditions.push(eq(sanctions.userId, userId));
    }
    if (type) {
      conditions.push(eq(sanctions.type, type));
    }
    if (isActive !== undefined) {
      conditions.push(eq(sanctions.isActive, isActive));
    }

    const [result] = await db
      .select({ count: count() })
      .from(sanctions)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    return result?.count ?? 0;
  },

  async getActiveSanctions(userId: number) {
    const now = new Date();

    return db.query.sanctions.findMany({
      where: and(
        eq(sanctions.userId, userId),
        eq(sanctions.isActive, true),
        or(isNull(sanctions.expiresAt), gt(sanctions.expiresAt, now))
      ),
    });
  },

  async revokeSanction(sanctionId: number, revokedBy: number) {
    const [updated] = await db
      .update(sanctions)
      .set({
        isActive: false,
        revokedAt: new Date(),
        revokedBy,
      })
      .where(eq(sanctions.id, sanctionId))
      .returning();

    return updated;
  },

  async expireOldSanctions() {
    const now = new Date();

    await db
      .update(sanctions)
      .set({ isActive: false })
      .where(and(eq(sanctions.isActive, true), lt(sanctions.expiresAt, now)));
  },

  // =========================================================================
  // User Roles
  // =========================================================================

  async getUserRole(userId: number) {
    return db.query.userRoles.findFirst({
      where: eq(userRoles.userId, userId),
    });
  },

  async createUserRole(userId: number, role: UserRole, assignedBy?: number) {
    const [userRole] = await db
      .insert(userRoles)
      .values({
        userId,
        role,
        assignedBy,
      })
      .returning();

    return userRole;
  },

  async updateUserRole(userId: number, role: UserRole, assignedBy: number) {
    const [updated] = await db
      .update(userRoles)
      .set({
        role,
        assignedBy,
        updatedAt: new Date(),
      })
      .where(eq(userRoles.userId, userId))
      .returning();

    return updated;
  },

  // =========================================================================
  // Audit Log
  // =========================================================================

  async createAuditLogEntry(data: {
    actorId: number;
    action: string;
    targetUserId?: number;
    targetId?: number;
    targetType?: string;
    details?: string;
  }) {
    const [entry] = await db
      .insert(moderationAuditLog)
      .values(data)
      .returning();

    return entry;
  },

  async getAuditLog(options: {
    limit?: number;
    offset?: number;
    actorId?: number;
    targetUserId?: number;
    action?: string;
  }) {
    const { limit = 20, offset = 0, actorId, targetUserId, action } = options;

    const conditions: ReturnType<typeof eq>[] = [];
    if (actorId) {
      conditions.push(eq(moderationAuditLog.actorId, actorId));
    }
    if (targetUserId) {
      conditions.push(eq(moderationAuditLog.targetUserId, targetUserId));
    }
    if (action) {
      conditions.push(eq(moderationAuditLog.action, action));
    }

    return db.query.moderationAuditLog.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      orderBy: [desc(moderationAuditLog.createdAt)],
      limit,
      offset,
    });
  },

  async getAuditLogCount(
    actorId?: number,
    targetUserId?: number,
    action?: string
  ) {
    const conditions: ReturnType<typeof eq>[] = [];
    if (actorId) {
      conditions.push(eq(moderationAuditLog.actorId, actorId));
    }
    if (targetUserId) {
      conditions.push(eq(moderationAuditLog.targetUserId, targetUserId));
    }
    if (action) {
      conditions.push(eq(moderationAuditLog.action, action));
    }

    const [result] = await db
      .select({ count: count() })
      .from(moderationAuditLog)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    return result?.count ?? 0;
  },

  // =========================================================================
  // Helpers
  // =========================================================================

  async getUserById(userId: number) {
    return db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: {
        id: true,
        displayName: true,
      },
    });
  },

  // =========================================================================
  // Admin Panel
  // =========================================================================

  async getAdminUsers(options: {
    limit?: number;
    offset?: number;
    search?: string;
    role?: UserRole;
    sortBy?: "createdAt" | "displayName" | "email";
    sortOrder?: "asc" | "desc";
  }) {
    const {
      limit = 20,
      offset = 0,
      search,
      role,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = options;

    // Build search conditions
    const conditions: ReturnType<typeof eq>[] = [];

    // If role filter is specified, we need to join with userRoles
    // For users without a role record, they are considered "user" role

    const sortColumn = {
      createdAt: users.createdAt,
      displayName: users.displayName,
      email: users.email,
    }[sortBy];

    const orderFn = sortOrder === "asc" ? asc : desc;

    // Get users with their roles
    const query = db
      .select({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        emailVerified: users.emailVerified,
        twoFactorEnabled: users.twoFactorEnabled,
        createdAt: users.createdAt,
        role: userRoles.role,
      })
      .from(users)
      .leftJoin(userRoles, eq(users.id, userRoles.userId));

    // Add search filter
    if (search) {
      conditions.push(
        or(
          ilike(users.displayName, `%${search}%`),
          ilike(users.email, `%${search}%`)
        ) as ReturnType<typeof eq>
      );
    }

    // Add role filter
    if (role) {
      if (role === "user") {
        // Users with no role record or role = 'user'
        conditions.push(
          or(isNull(userRoles.role), eq(userRoles.role, "user")) as ReturnType<
            typeof eq
          >
        );
      } else {
        conditions.push(eq(userRoles.role, role));
      }
    }

    const userList = await query
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(orderFn(sortColumn))
      .limit(limit)
      .offset(offset);

    return userList.map((u) => ({
      ...u,
      role: (u.role ?? "user") as UserRole,
    }));
  },

  async getAdminUsersCount(options: { search?: string; role?: UserRole }) {
    const { search, role } = options;

    const conditions: ReturnType<typeof eq>[] = [];

    const query = db
      .select({ count: count() })
      .from(users)
      .leftJoin(userRoles, eq(users.id, userRoles.userId));

    if (search) {
      conditions.push(
        or(
          ilike(users.displayName, `%${search}%`),
          ilike(users.email, `%${search}%`)
        ) as ReturnType<typeof eq>
      );
    }

    if (role) {
      if (role === "user") {
        conditions.push(
          or(isNull(userRoles.role), eq(userRoles.role, "user")) as ReturnType<
            typeof eq
          >
        );
      } else {
        conditions.push(eq(userRoles.role, role));
      }
    }

    const [result] = await query.where(
      conditions.length > 0 ? and(...conditions) : undefined
    );

    return result?.count ?? 0;
  },

  async getUserWithDetails(userId: number) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) return null;

    const role = await this.getUserRole(userId);

    // Count active sanctions
    const [sanctionsResult] = await db
      .select({ count: count() })
      .from(sanctions)
      .where(and(eq(sanctions.userId, userId), eq(sanctions.isActive, true)));

    // Count reports against this user
    const [reportsResult] = await db
      .select({ count: count() })
      .from(reports)
      .where(eq(reports.reportedUserId, userId));

    return {
      ...user,
      role: (role?.role ?? "user") as UserRole,
      activeSanctions: sanctionsResult?.count ?? 0,
      totalReports: reportsResult?.count ?? 0,
    };
  },

  async deleteUser(userId: number) {
    // Cascade deletion is handled by the database schema
    await db.delete(users).where(eq(users.id, userId));
  },

  async getAdminStats() {
    // Total users
    const [usersResult] = await db.select({ count: count() }).from(users);

    // Moderators count
    const [modsResult] = await db
      .select({ count: count() })
      .from(userRoles)
      .where(eq(userRoles.role, "moderator"));

    // Admins count
    const [adminsResult] = await db
      .select({ count: count() })
      .from(userRoles)
      .where(eq(userRoles.role, "admin"));

    // Pending reports
    const [pendingReportsResult] = await db
      .select({ count: count() })
      .from(reports)
      .where(eq(reports.status, "pending"));

    // Active sanctions
    const [activeSanctionsResult] = await db
      .select({ count: count() })
      .from(sanctions)
      .where(eq(sanctions.isActive, true));

    // Recent audit logs (last 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [recentAuditResult] = await db
      .select({ count: count() })
      .from(moderationAuditLog)
      .where(gt(moderationAuditLog.createdAt, oneDayAgo));

    return {
      totalUsers: usersResult?.count ?? 0,
      totalModerators: modsResult?.count ?? 0,
      totalAdmins: adminsResult?.count ?? 0,
      pendingReports: pendingReportsResult?.count ?? 0,
      activeSanctions: activeSanctionsResult?.count ?? 0,
      recentAuditLogs: recentAuditResult?.count ?? 0,
    };
  },
};
