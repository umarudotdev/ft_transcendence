import { t } from "elysia";

import {
  badRequest,
  conflict,
  internalError,
  notFound,
  validationError,
} from "../../common/errors";

export const UsersModel = {
  updateProfile: t.Object({
    displayName: t.Optional(t.String({ minLength: 1, maxLength: 50 })),
  }),

  updateUsername: t.Object({
    username: t.String({
      minLength: 3,
      maxLength: 20,
      pattern: "^[a-z0-9_]+$",
    }),
  }),

  uploadAvatar: t.Object({
    file: t.File({
      type: ["image/jpeg", "image/png", "image/webp"],
      maxSize: 2 * 1024 * 1024, // 2MB
    }),
  }),

  userIdParam: t.Object({
    id: t.Numeric(),
  }),

  requestIdParam: t.Object({
    requestId: t.Numeric(),
  }),

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

  publicUser: t.Object({
    id: t.Number(),
    displayName: t.String(),
    username: t.String(),
    avatarUrl: t.Nullable(t.String()),
    createdAt: t.Date(),
  }),

  userProfile: t.Object({
    id: t.Number(),
    email: t.String(),
    displayName: t.String(),
    username: t.String(),
    usernameChangedAt: t.Nullable(t.Date()),
    avatarUrl: t.Nullable(t.String()),
    emailVerified: t.Boolean(),
    twoFactorEnabled: t.Boolean(),
    intraId: t.Nullable(t.Number()),
    createdAt: t.Date(),
  }),

  usernameHistoryItem: t.Object({
    id: t.Number(),
    oldUsername: t.String(),
    newUsername: t.String(),
    changedAt: t.Date(),
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
      username: t.Nullable(t.String()),
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
    username: t.String(),
    avatarUrl: t.Nullable(t.String()),
    since: t.Date(),
  }),

  pendingRequest: t.Object({
    requestId: t.Number(),
    from: t.Object({
      id: t.Number(),
      displayName: t.String(),
      username: t.String(),
      avatarUrl: t.Nullable(t.String()),
    }),
    createdAt: t.Date(),
  }),

  sentRequest: t.Object({
    requestId: t.Number(),
    to: t.Object({
      id: t.Number(),
      displayName: t.String(),
      username: t.String(),
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

  profileUpdateError: t.Union([
    t.Object({ type: t.Literal("USER_NOT_FOUND") }),
    t.Object({
      type: t.Literal("INVALID_DISPLAY_NAME"),
      message: t.String(),
    }),
  ]),

  usernameChangeError: t.Union([
    t.Object({ type: t.Literal("USER_NOT_FOUND") }),
    t.Object({
      type: t.Literal("INVALID_USERNAME"),
      message: t.String(),
    }),
    t.Object({ type: t.Literal("USERNAME_TAKEN") }),
    t.Object({
      type: t.Literal("COOLDOWN_ACTIVE"),
      canChangeAt: t.Date(),
    }),
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

export type UpdateProfileBody = (typeof UsersModel.updateProfile)["static"];
export type UpdateUsernameBody = (typeof UsersModel.updateUsername)["static"];
export type UploadAvatarBody = (typeof UsersModel.uploadAvatar)["static"];
export type UserIdParam = (typeof UsersModel.userIdParam)["static"];
export type RequestIdParam = (typeof UsersModel.requestIdParam)["static"];
export type StatsQuery = (typeof UsersModel.statsQuery)["static"];
export type MatchesQuery = (typeof UsersModel.matchesQuery)["static"];
export type SearchQuery = (typeof UsersModel.searchQuery)["static"];

export type PublicUser = (typeof UsersModel.publicUser)["static"];
export type UserProfile = (typeof UsersModel.userProfile)["static"];
export type UserStats = (typeof UsersModel.userStats)["static"];
export type MatchHistoryItem = (typeof UsersModel.matchHistoryItem)["static"];
export type FriendItem = (typeof UsersModel.friendItem)["static"];
export type PendingRequest = (typeof UsersModel.pendingRequest)["static"];
export type SentRequest = (typeof UsersModel.sentRequest)["static"];
export type FriendshipStatus = (typeof UsersModel.friendshipStatus)["static"];
export type UsernameHistoryItem =
  (typeof UsersModel.usernameHistoryItem)["static"];

export type ProfileUpdateError =
  (typeof UsersModel.profileUpdateError)["static"];
export type UsernameChangeError =
  (typeof UsersModel.usernameChangeError)["static"];
export type AvatarUploadError = (typeof UsersModel.avatarUploadError)["static"];
export type FriendshipError = (typeof UsersModel.friendshipError)["static"];

/**
 * Maps profile update errors to RFC 9457 Problem Details.
 */
export function mapProfileUpdateError(
  error: ProfileUpdateError,
  instance: string
) {
  switch (error.type) {
    case "USER_NOT_FOUND":
      return notFound("User not found", { instance });
    case "INVALID_DISPLAY_NAME":
      return validationError(
        error.message,
        [{ field: "displayName", message: error.message }],
        {
          instance,
        }
      );
  }
}

/**
 * Maps username change errors to RFC 9457 Problem Details.
 */
export function mapUsernameChangeError(
  error: UsernameChangeError,
  instance: string
) {
  switch (error.type) {
    case "USER_NOT_FOUND":
      return notFound("User not found", { instance });
    case "INVALID_USERNAME":
      return validationError(
        error.message,
        [{ field: "username", message: error.message }],
        { instance }
      );
    case "USERNAME_TAKEN":
      return conflict("Username already taken", { instance });
    case "COOLDOWN_ACTIVE":
      return badRequest(
        `Username can be changed again on ${error.canChangeAt.toISOString()}`,
        { instance }
      );
  }
}

/**
 * Maps avatar upload errors to RFC 9457 Problem Details.
 */
export function mapAvatarUploadError(
  error: AvatarUploadError,
  instance: string
) {
  switch (error.type) {
    case "USER_NOT_FOUND":
      return notFound("User not found", { instance });
    case "INVALID_FILE_TYPE":
      return validationError(
        `Invalid file type. Allowed: ${error.allowed.join(", ")}`,
        [
          {
            field: "file",
            message: `Allowed types: ${error.allowed.join(", ")}`,
          },
        ],
        { instance }
      );
    case "FILE_TOO_LARGE":
      return validationError(
        `File too large. Maximum size: ${error.maxSize} bytes`,
        [
          {
            field: "file",
            message: `Maximum size: ${Math.round(error.maxSize / 1024 / 1024)}MB`,
          },
        ],
        { instance }
      );
    case "UPLOAD_FAILED":
      return internalError("Failed to upload avatar", { instance });
  }
}

/**
 * Maps friendship errors to RFC 9457 Problem Details.
 */
export function mapFriendshipError(error: FriendshipError, instance: string) {
  switch (error.type) {
    case "USER_NOT_FOUND":
      return notFound("User not found", { instance });
    case "CANNOT_FRIEND_SELF":
      return badRequest("Cannot send friend request to yourself", { instance });
    case "ALREADY_FRIENDS":
      return conflict("Already friends with this user", { instance });
    case "REQUEST_PENDING":
      return conflict("Friend request already pending", { instance });
    case "USER_BLOCKED":
      return badRequest("Cannot interact with blocked user", { instance });
    case "NOT_FRIENDS":
      return badRequest("Not friends with this user", { instance });
    case "REQUEST_NOT_FOUND":
      return notFound("Friend request not found", { instance });
  }
}
