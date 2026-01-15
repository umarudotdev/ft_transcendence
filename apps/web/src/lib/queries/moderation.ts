import { api } from "$lib/api";
import { createApiError, type ApiError } from "$lib/errors";
import {
  createMutation,
  createQuery,
  useQueryClient,
} from "@tanstack/svelte-query";

export const moderationKeys = {
  all: ["moderation"] as const,
  status: () => [...moderationKeys.all, "status"] as const,
  reports: (params?: {
    limit?: number;
    offset?: number;
    status?: string;
    reason?: string;
  }) => [...moderationKeys.all, "reports", params] as const,
  sanctions: (params?: {
    limit?: number;
    offset?: number;
    userId?: number;
    type?: string;
    isActive?: boolean;
  }) => [...moderationKeys.all, "sanctions", params] as const,
  auditLog: (params?: {
    limit?: number;
    offset?: number;
    actorId?: number;
    targetUserId?: number;
    action?: string;
  }) => [...moderationKeys.all, "audit-log", params] as const,
  userHistory: (userId: number) =>
    [...moderationKeys.all, "users", userId, "history"] as const,
};

export type ReportReason =
  | "afk"
  | "cheating"
  | "harassment"
  | "inappropriate_name"
  | "other";

export type ReportStatus = "pending" | "reviewed" | "resolved" | "dismissed";

export type SanctionType = "warning" | "timeout" | "ban";

export type Resolution = "warning" | "timeout" | "ban" | "no_action";

export interface Report {
  id: number;
  reporterId: number;
  reporterName: string;
  reportedUserId: number;
  reportedUserName: string;
  matchId: number | null;
  reason: ReportReason;
  description: string | null;
  status: ReportStatus;
  resolvedBy: number | null;
  resolvedAt: Date | null;
  resolution: string | null;
  createdAt: Date;
}

export interface Sanction {
  id: number;
  userId: number;
  userName: string;
  type: SanctionType;
  reason: string;
  reportId: number | null;
  issuedBy: number;
  issuedByName: string;
  expiresAt: Date | null;
  isActive: boolean;
  revokedAt: Date | null;
  revokedBy: number | null;
  createdAt: Date;
}

export interface AuditLogEntry {
  id: number;
  actorId: number;
  actorName: string;
  action: string;
  targetUserId: number | null;
  targetUserName: string | null;
  targetId: number | null;
  targetType: string | null;
  details: string | null;
  createdAt: Date;
}

export interface SanctionStatus {
  isBanned: boolean;
  isTimedOut: boolean;
  activeUntil: Date | null;
  activeSanctions: number;
}

export interface CreateReportInput {
  reportedUserId: number;
  reason: ReportReason;
  description?: string;
  matchId?: number;
}

export interface ResolveReportInput {
  resolution: Resolution;
  sanctionDuration?: number;
  notes?: string;
}

export interface IssueSanctionInput {
  userId: number;
  type: SanctionType;
  reason: string;
  duration?: number;
  reportId?: number;
}

/**
 * Query to get current user's sanction status.
 */
export function createSanctionStatusQuery() {
  return createQuery<SanctionStatus, ApiError>(() => ({
    queryKey: moderationKeys.status(),
    queryFn: async () => {
      const response = await api.api.moderation.status.get({
        fetch: { credentials: "include" },
      });

      if (response.error) {
        throw createApiError(response.error.value);
      }

      return (response.data as { status: SanctionStatus }).status;
    },
  }));
}

/**
 * Mutation to submit a report.
 */
export function createSubmitReportMutation() {
  return createMutation<Report, ApiError, CreateReportInput>(() => ({
    mutationFn: async (input: CreateReportInput) => {
      const response = await api.api.moderation.reports.post(input, {
        fetch: { credentials: "include" },
      });

      if (response.error) {
        throw createApiError(response.error.value);
      }

      return (response.data as { report: Report }).report;
    },
  }));
}

// =========================================================================
// Admin/Moderator queries
// =========================================================================

/**
 * Query to get reports list (moderator/admin only).
 */
export function createReportsQuery(params?: {
  limit?: number;
  offset?: number;
  status?: ReportStatus;
  reason?: string;
}) {
  return createQuery<
    { reports: Report[]; total: number; hasMore: boolean },
    ApiError
  >(() => ({
    queryKey: moderationKeys.reports(params),
    queryFn: async () => {
      const response = await api.api.moderation.reports.get({
        query: params,
        fetch: { credentials: "include" },
      });

      if (response.error) {
        throw createApiError(response.error.value);
      }

      return response.data as {
        reports: Report[];
        total: number;
        hasMore: boolean;
      };
    },
  }));
}

/**
 * Mutation to resolve a report (moderator/admin only).
 */
export function createResolveReportMutation() {
  const queryClient = useQueryClient();

  return createMutation<
    Report,
    ApiError,
    { reportId: number; data: ResolveReportInput }
  >(() => ({
    mutationFn: async ({ reportId, data }) => {
      const response = await api.api.moderation
        .reports({ reportId })
        .resolve.post(data, {
          fetch: { credentials: "include" },
        });

      if (response.error) {
        throw createApiError(response.error.value);
      }

      return (response.data as { report: Report }).report;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: moderationKeys.reports() });
    },
  }));
}

/**
 * Query to get sanctions list (moderator/admin only).
 */
export function createSanctionsQuery(params?: {
  limit?: number;
  offset?: number;
  userId?: number;
  type?: SanctionType;
  isActive?: boolean;
}) {
  return createQuery<
    { sanctions: Sanction[]; total: number; hasMore: boolean },
    ApiError
  >(() => ({
    queryKey: moderationKeys.sanctions(params),
    queryFn: async () => {
      const response = await api.api.moderation.sanctions.get({
        fetch: { credentials: "include" },
      });

      if (response.error) {
        throw createApiError(response.error.value);
      }

      return response.data as {
        sanctions: Sanction[];
        total: number;
        hasMore: boolean;
      };
    },
  }));
}

/**
 * Mutation to issue a sanction (admin only).
 */
export function createIssueSanctionMutation() {
  const queryClient = useQueryClient();

  return createMutation<Sanction, ApiError, IssueSanctionInput>(() => ({
    mutationFn: async (input: IssueSanctionInput) => {
      const response = await api.api.moderation.sanctions.post(input, {
        fetch: { credentials: "include" },
      });

      if (response.error) {
        throw createApiError(response.error.value);
      }

      return (response.data as { sanction: Sanction }).sanction;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: moderationKeys.sanctions() });
    },
  }));
}

/**
 * Mutation to revoke a sanction (admin only).
 */
export function createRevokeSanctionMutation() {
  const queryClient = useQueryClient();

  return createMutation<Sanction, ApiError, number>(() => ({
    mutationFn: async (sanctionId: number) => {
      const response = await api.api.moderation
        .sanctions({ sanctionId })
        .revoke.post(undefined, {
          fetch: { credentials: "include" },
        });

      if (response.error) {
        throw createApiError(response.error.value);
      }

      return (response.data as { sanction: Sanction }).sanction;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: moderationKeys.sanctions() });
    },
  }));
}

/**
 * Query to get audit log (admin only).
 */
export function createAuditLogQuery(params?: {
  limit?: number;
  offset?: number;
  actorId?: number;
  targetUserId?: number;
  action?: string;
}) {
  return createQuery<
    { entries: AuditLogEntry[]; total: number; hasMore: boolean },
    ApiError
  >(() => ({
    queryKey: moderationKeys.auditLog(params),
    queryFn: async () => {
      const response = await api.api.moderation["audit-log"].get({
        query: params,
        fetch: { credentials: "include" },
      });

      if (response.error) {
        throw createApiError(response.error.value);
      }

      return response.data as {
        entries: AuditLogEntry[];
        total: number;
        hasMore: boolean;
      };
    },
  }));
}

/**
 * Query to get a user's moderation history (admin only).
 */
export function createUserHistoryQuery(userId: number) {
  return createQuery<{ sanctions: Sanction[] }, ApiError>(() => ({
    queryKey: moderationKeys.userHistory(userId),
    queryFn: async () => {
      const response = await api.api.moderation
        .users({ id: userId })
        .history.get({
          fetch: { credentials: "include" },
        });

      if (response.error) {
        throw createApiError(response.error.value);
      }

      return response.data as { sanctions: Sanction[] };
    },
  }));
}

/**
 * Get display text for report reason.
 */
export function getReasonText(reason: ReportReason): string {
  const reasons: Record<ReportReason, string> = {
    afk: "AFK / Left Game",
    cheating: "Cheating",
    harassment: "Harassment",
    inappropriate_name: "Inappropriate Name",
    other: "Other",
  };
  return reasons[reason];
}

/**
 * Get display text for report status.
 */
export function getStatusText(status: ReportStatus): string {
  const statuses: Record<ReportStatus, string> = {
    pending: "Pending",
    reviewed: "Reviewed",
    resolved: "Resolved",
    dismissed: "Dismissed",
  };
  return statuses[status];
}

/**
 * Get color classes for report status.
 */
export function getStatusColor(status: ReportStatus): string {
  switch (status) {
    case "pending":
      return "text-yellow-600 bg-yellow-100";
    case "reviewed":
      return "text-blue-600 bg-blue-100";
    case "resolved":
      return "text-green-600 bg-green-100";
    case "dismissed":
      return "text-slate-600 bg-slate-100";
  }
}

/**
 * Get color classes for sanction type.
 */
export function getSanctionColor(type: SanctionType): string {
  switch (type) {
    case "warning":
      return "text-yellow-600 bg-yellow-100";
    case "timeout":
      return "text-orange-600 bg-orange-100";
    case "ban":
      return "text-red-600 bg-red-100";
  }
}
