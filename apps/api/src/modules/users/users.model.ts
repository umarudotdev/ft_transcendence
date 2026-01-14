import { t } from "elysia";

// =============================================================================
// USERS MODEL - Single Source of Truth for Types
// =============================================================================

export const UsersModel = {
  // ---------------------------------------------------------------------------
  // Request Bodies
  // ---------------------------------------------------------------------------

  updateProfile: t.Object({
    displayName: t.Optional(t.String({ minLength: 3, maxLength: 20 })),
  }),

  uploadAvatar: t.Object({
    file: t.File({
      type: ["image/jpeg", "image/png", "image/webp"],
      maxSize: 2 * 1024 * 1024, // 2MB
    }),
  }),

  // ---------------------------------------------------------------------------
  // Params
  // ---------------------------------------------------------------------------

  userIdParam: t.Object({
    id: t.Numeric(),
  }),

  requestIdParam: t.Object({
    requestId: t.Numeric(),
  }),

  // ---------------------------------------------------------------------------
  // Query
  // ---------------------------------------------------------------------------

  statsQuery: t.Object({
    gameType: t.Optional(t.String()),
  }),

  matchesQuery: t.Object({
    limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100, default: 10 })),
    offset: t.Optional(t.Numeric({ minimum: 0, default: 0 })),
    gameType: t.Optional(t.String()),
    result: t.Optional(t.Union([t.Literal("win"), t.Literal("loss")])),
  }),

  searchQuery: t.Object({
    q: t.String({ minLength: 1 }),
    limit: t.Optional(t.Numeric({ minimum: 1, maximum: 50, default: 10 })),
  }),

  // ---------------------------------------------------------------------------
  // Response Types
  // ---------------------------------------------------------------------------

  publicUser: t.Object({
    id: t.Number(),
    displayName: t.String(),
    avatarUrl: t.Nullable(t.String()),
    createdAt: t.Date(),
  }),

  userProfile: t.Object({
    id: t.Number(),
    email: t.String(),
    displayName: t.String(),
    avatarUrl: t.Nullable(t.String()),
    emailVerified: t.Boolean(),
    twoFactorEnabled: t.Boolean(),
    intraId: t.Nullable(t.Number()),
    createdAt: t.Date(),
  }),

  userStats: t.Object({
    gamesPlayed: t.Number(),
    wins: t.Number(),
    losses: t.Number(),
    draws: t.Number(),
    winRate: t.Number(),
    averageDuration: t.Number(),
  }),

  matchHistoryItem: t.Object({
    id: t.Number(),
    opponent: t.Object({
      id: t.Nullable(t.Number()),
      displayName: t.String(),
      avatarUrl: t.Nullable(t.String()),
    }),
    playerScore: t.Number(),
    opponentScore: t.Number(),
    result: t.Union([t.Literal("win"), t.Literal("loss"), t.Literal("draw")]),
    gameType: t.String(),
    isAiGame: t.Boolean(),
    duration: t.Number(),
    createdAt: t.Date(),
  }),

  friendItem: t.Object({
    friendshipId: t.Number(),
    id: t.Number(),
    displayName: t.String(),
    avatarUrl: t.Nullable(t.String()),
    since: t.Date(),
  }),

  pendingRequest: t.Object({
    requestId: t.Number(),
    from: t.Object({
      id: t.Number(),
      displayName: t.String(),
      avatarUrl: t.Nullable(t.String()),
    }),
    createdAt: t.Date(),
  }),

  sentRequest: t.Object({
    requestId: t.Number(),
    to: t.Object({
      id: t.Number(),
      displayName: t.String(),
      avatarUrl: t.Nullable(t.String()),
    }),
    createdAt: t.Date(),
  }),

  friendshipStatus: t.Union([
    t.Object({ status: t.Literal("none") }),
    t.Object({ status: t.Literal("friends") }),
    t.Object({ status: t.Literal("pending_sent") }),
    t.Object({ status: t.Literal("pending_received") }),
    t.Object({ status: t.Literal("blocked") }),
    t.Object({ status: t.Literal("blocked_by") }),
  ]),

  // ---------------------------------------------------------------------------
  // Error Types
  // ---------------------------------------------------------------------------

  profileUpdateError: t.Union([
    t.Object({ type: t.Literal("USER_NOT_FOUND") }),
    t.Object({
      type: t.Literal("INVALID_DISPLAY_NAME"),
      message: t.String(),
    }),
    t.Object({ type: t.Literal("DISPLAY_NAME_TAKEN") }),
  ]),

  avatarUploadError: t.Union([
    t.Object({ type: t.Literal("USER_NOT_FOUND") }),
    t.Object({
      type: t.Literal("INVALID_FILE_TYPE"),
      allowed: t.Array(t.String()),
    }),
    t.Object({
      type: t.Literal("FILE_TOO_LARGE"),
      maxSize: t.Number(),
    }),
    t.Object({ type: t.Literal("UPLOAD_FAILED") }),
  ]),

  friendshipError: t.Union([
    t.Object({ type: t.Literal("USER_NOT_FOUND") }),
    t.Object({ type: t.Literal("CANNOT_FRIEND_SELF") }),
    t.Object({ type: t.Literal("ALREADY_FRIENDS") }),
    t.Object({ type: t.Literal("REQUEST_PENDING") }),
    t.Object({ type: t.Literal("USER_BLOCKED") }),
    t.Object({ type: t.Literal("NOT_FRIENDS") }),
    t.Object({ type: t.Literal("REQUEST_NOT_FOUND") }),
  ]),
};

// =============================================================================
// Derived Types
// =============================================================================

// Request Types
export type UpdateProfileBody = (typeof UsersModel.updateProfile)["static"];
export type UploadAvatarBody = (typeof UsersModel.uploadAvatar)["static"];
export type UserIdParam = (typeof UsersModel.userIdParam)["static"];
export type RequestIdParam = (typeof UsersModel.requestIdParam)["static"];
export type StatsQuery = (typeof UsersModel.statsQuery)["static"];
export type MatchesQuery = (typeof UsersModel.matchesQuery)["static"];
export type SearchQuery = (typeof UsersModel.searchQuery)["static"];

// Response Types
export type PublicUser = (typeof UsersModel.publicUser)["static"];
export type UserProfile = (typeof UsersModel.userProfile)["static"];
export type UserStats = (typeof UsersModel.userStats)["static"];
export type MatchHistoryItem = (typeof UsersModel.matchHistoryItem)["static"];
export type FriendItem = (typeof UsersModel.friendItem)["static"];
export type PendingRequest = (typeof UsersModel.pendingRequest)["static"];
export type SentRequest = (typeof UsersModel.sentRequest)["static"];
export type FriendshipStatus = (typeof UsersModel.friendshipStatus)["static"];

// Error Types
export type ProfileUpdateError =
  (typeof UsersModel.profileUpdateError)["static"];
export type AvatarUploadError = (typeof UsersModel.avatarUploadError)["static"];
export type FriendshipError = (typeof UsersModel.friendshipError)["static"];
