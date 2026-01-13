import { err, ok, ResultAsync } from "neverthrow";

import type {
  AvatarUploadError,
  FriendshipError,
  ProfileUpdateError,
} from "./users.errors";

import { usersRepository } from "./users.repository";

// =============================================================================
// CONSTANTS
// =============================================================================

const DISPLAY_NAME_MIN_LENGTH = 3;
const DISPLAY_NAME_MAX_LENGTH = 20;
const DISPLAY_NAME_PATTERN = /^[a-zA-Z0-9 ]+$/;

const MAX_AVATAR_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];

// =============================================================================
// Types
// =============================================================================

export interface PublicUser {
  id: number;
  displayName: string;
  avatarUrl: string | null;
  createdAt: Date;
}

export interface UserProfile extends PublicUser {
  email: string;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  intraId: number | null;
}

export interface UserStats {
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  averageDuration: number;
}

export interface MatchHistoryItem {
  id: number;
  opponent: {
    id: number | null;
    displayName: string;
    avatarUrl: string | null;
  };
  playerScore: number;
  opponentScore: number;
  result: "win" | "loss" | "draw";
  gameType: string;
  isAiGame: boolean;
  duration: number;
  createdAt: Date;
}

// =============================================================================
// USERS SERVICE
// =============================================================================

export const usersService = {
  // ---------------------------------------------------------------------------
  // Profile
  // ---------------------------------------------------------------------------

  getProfile(userId: number): ResultAsync<UserProfile | null, never> {
    return ResultAsync.fromPromise(
      (async () => {
        const user = await usersRepository.findById(userId);

        if (!user) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          emailVerified: user.emailVerified,
          twoFactorEnabled: user.twoFactorEnabled,
          intraId: user.intraId,
          createdAt: user.createdAt,
        };
      })(),
      () => null as never
    );
  },

  getPublicProfile(userId: number): ResultAsync<PublicUser | null, never> {
    return ResultAsync.fromPromise(
      (async () => {
        const user = await usersRepository.findById(userId);

        if (!user) {
          return null;
        }

        return {
          id: user.id,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          createdAt: user.createdAt,
        };
      })(),
      () => null as never
    );
  },

  updateProfile(
    userId: number,
    data: { displayName?: string }
  ): ResultAsync<UserProfile, ProfileUpdateError> {
    return ResultAsync.fromPromise(
      (async () => {
        const user = await usersRepository.findById(userId);

        if (!user) {
          return err({ type: "USER_NOT_FOUND" as const });
        }

        // Validate display name if provided
        if (data.displayName !== undefined) {
          const displayName = data.displayName.trim();

          if (displayName.length < DISPLAY_NAME_MIN_LENGTH) {
            return err({
              type: "INVALID_DISPLAY_NAME" as const,
              message: `Display name must be at least ${DISPLAY_NAME_MIN_LENGTH} characters`,
            });
          }

          if (displayName.length > DISPLAY_NAME_MAX_LENGTH) {
            return err({
              type: "INVALID_DISPLAY_NAME" as const,
              message: `Display name must be at most ${DISPLAY_NAME_MAX_LENGTH} characters`,
            });
          }

          if (!DISPLAY_NAME_PATTERN.test(displayName)) {
            return err({
              type: "INVALID_DISPLAY_NAME" as const,
              message:
                "Display name can only contain letters, numbers, and spaces",
            });
          }

          // Check if display name is taken (case-insensitive)
          const existing = await usersRepository.findByDisplayName(displayName);
          if (existing && existing.id !== userId) {
            return err({ type: "DISPLAY_NAME_TAKEN" as const });
          }
        }

        const updated = await usersRepository.updateProfile(userId, data);

        return ok({
          id: updated.id,
          email: updated.email,
          displayName: updated.displayName,
          avatarUrl: updated.avatarUrl,
          emailVerified: updated.emailVerified,
          twoFactorEnabled: updated.twoFactorEnabled,
          intraId: updated.intraId,
          createdAt: updated.createdAt,
        });
      })(),
      () => ({ type: "USER_NOT_FOUND" as const })
    ).andThen((result) => result);
  },

  // ---------------------------------------------------------------------------
  // Avatar
  // ---------------------------------------------------------------------------

  validateAvatarFile(
    file: File
  ): ResultAsync<{ valid: true }, AvatarUploadError> {
    return ResultAsync.fromPromise(
      (async () => {
        // Check file type
        if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
          return err({
            type: "INVALID_FILE_TYPE" as const,
            allowed: ALLOWED_AVATAR_TYPES,
          });
        }

        // Check file size
        if (file.size > MAX_AVATAR_SIZE) {
          return err({
            type: "FILE_TOO_LARGE" as const,
            maxSize: MAX_AVATAR_SIZE,
          });
        }

        return ok({ valid: true as const });
      })(),
      () => ({ type: "UPLOAD_FAILED" as const })
    ).andThen((result) => result);
  },

  updateAvatarUrl(
    userId: number,
    avatarUrl: string
  ): ResultAsync<UserProfile, AvatarUploadError> {
    return ResultAsync.fromPromise(
      (async () => {
        const user = await usersRepository.findById(userId);

        if (!user) {
          return err({ type: "USER_NOT_FOUND" as const });
        }

        const updated = await usersRepository.updateAvatarUrl(
          userId,
          avatarUrl
        );

        return ok({
          id: updated.id,
          email: updated.email,
          displayName: updated.displayName,
          avatarUrl: updated.avatarUrl,
          emailVerified: updated.emailVerified,
          twoFactorEnabled: updated.twoFactorEnabled,
          intraId: updated.intraId,
          createdAt: updated.createdAt,
        });
      })(),
      () => ({ type: "UPLOAD_FAILED" as const })
    ).andThen((result) => result);
  },

  // ---------------------------------------------------------------------------
  // Match History
  // ---------------------------------------------------------------------------

  getMatchHistory(
    userId: number,
    viewerId: number,
    options: {
      limit?: number;
      offset?: number;
      gameType?: string;
      result?: "win" | "loss";
    } = {}
  ): ResultAsync<
    { matches: MatchHistoryItem[]; total: number; hasMore: boolean },
    never
  > {
    return ResultAsync.fromPromise(
      (async () => {
        const { limit = 10, offset = 0, gameType } = options;

        const rawMatches = await usersRepository.getMatchHistory(userId, {
          limit: limit + 1, // Fetch one extra to check hasMore
          offset,
          gameType,
        });

        const total = await usersRepository.getMatchHistoryCount(
          userId,
          gameType
        );

        const hasMore = rawMatches.length > limit;
        const matchesToReturn = hasMore
          ? rawMatches.slice(0, limit)
          : rawMatches;

        // Transform matches to MatchHistoryItem format
        const mappedMatches: MatchHistoryItem[] = matchesToReturn.map(
          (match) => {
            const isPlayer1 = match.player1Id === userId;
            const playerScore = isPlayer1
              ? match.player1Score
              : match.player2Score;
            const opponentScore = isPlayer1
              ? match.player2Score
              : match.player1Score;

            // Determine opponent
            let opponent: {
              id: number | null;
              displayName: string;
              avatarUrl: string | null;
            };

            if (match.isAiGame) {
              opponent = {
                id: null,
                displayName: "AI Opponent",
                avatarUrl: null,
              };
            } else if (isPlayer1 && match.player2) {
              opponent = {
                id: match.player2.id,
                displayName: match.player2.displayName,
                avatarUrl: match.player2.avatarUrl,
              };
            } else if (!isPlayer1 && match.player1) {
              opponent = {
                id: match.player1.id,
                displayName: match.player1.displayName,
                avatarUrl: match.player1.avatarUrl,
              };
            } else {
              opponent = { id: null, displayName: "Unknown", avatarUrl: null };
            }

            // Determine result
            let result: "win" | "loss" | "draw";
            if (match.winnerId === null) {
              result = "draw";
            } else if (match.winnerId === userId) {
              result = "win";
            } else {
              result = "loss";
            }

            return {
              id: match.id,
              opponent,
              playerScore,
              opponentScore,
              result,
              gameType: match.gameType,
              isAiGame: match.isAiGame,
              duration: match.duration,
              createdAt: match.createdAt,
            };
          }
        );

        // Filter by result if specified
        const filteredMatches = options.result
          ? mappedMatches.filter((m) => m.result === options.result)
          : mappedMatches;

        return { matches: filteredMatches, total, hasMore };
      })(),
      (): never => {
        throw new Error("Unexpected error fetching match history");
      }
    );
  },

  // ---------------------------------------------------------------------------
  // Statistics
  // ---------------------------------------------------------------------------

  getStats(userId: number, gameType?: string): ResultAsync<UserStats, never> {
    return ResultAsync.fromPromise(
      usersRepository.getStats(userId, gameType),
      (): never => {
        throw new Error("Unexpected error fetching stats");
      }
    );
  },

  // ---------------------------------------------------------------------------
  // Friends
  // ---------------------------------------------------------------------------

  getFriends(userId: number): ResultAsync<
    Array<{
      friendshipId: number;
      id: number;
      displayName: string;
      avatarUrl: string | null;
      since: Date;
    }>,
    never
  > {
    return ResultAsync.fromPromise(
      usersRepository.getFriends(userId),
      (): never => {
        throw new Error("Unexpected error fetching friends");
      }
    );
  },

  getPendingRequests(userId: number): ResultAsync<
    Array<{
      requestId: number;
      from: { id: number; displayName: string; avatarUrl: string | null };
      createdAt: Date;
    }>,
    never
  > {
    return ResultAsync.fromPromise(
      usersRepository.getPendingRequests(userId),
      (): never => {
        throw new Error("Unexpected error fetching pending requests");
      }
    );
  },

  getSentRequests(userId: number): ResultAsync<
    Array<{
      requestId: number;
      to: { id: number; displayName: string; avatarUrl: string | null };
      createdAt: Date;
    }>,
    never
  > {
    return ResultAsync.fromPromise(
      usersRepository.getSentRequests(userId),
      (): never => {
        throw new Error("Unexpected error fetching sent requests");
      }
    );
  },

  sendFriendRequest(
    userId: number,
    friendId: number
  ): ResultAsync<{ requestId: number }, FriendshipError> {
    return ResultAsync.fromPromise(
      (async () => {
        // Cannot friend yourself
        if (userId === friendId) {
          return err({ type: "CANNOT_FRIEND_SELF" as const });
        }

        // Check if target user exists
        const targetUser = await usersRepository.findById(friendId);
        if (!targetUser) {
          return err({ type: "USER_NOT_FOUND" as const });
        }

        // Check existing friendship
        const existing = await usersRepository.getFriendship(userId, friendId);

        if (existing) {
          if (existing.status === "accepted") {
            return err({ type: "ALREADY_FRIENDS" as const });
          }
          if (existing.status === "pending") {
            return err({ type: "REQUEST_PENDING" as const });
          }
          if (existing.status === "blocked") {
            return err({ type: "USER_BLOCKED" as const });
          }
        }

        const request = await usersRepository.createFriendRequest(
          userId,
          friendId
        );

        return ok({ requestId: request.id });
      })(),
      () => ({ type: "USER_NOT_FOUND" as const })
    ).andThen((result) => result);
  },

  acceptFriendRequest(
    userId: number,
    requestId: number
  ): ResultAsync<void, FriendshipError> {
    return ResultAsync.fromPromise(
      (async () => {
        // Find the request - must be directed at current user
        const requests = await usersRepository.getPendingRequests(userId);
        const request = requests.find((r) => r.requestId === requestId);

        if (!request) {
          return err({ type: "REQUEST_NOT_FOUND" as const });
        }

        await usersRepository.updateFriendshipStatus(requestId, "accepted");

        return ok(undefined);
      })(),
      () => ({ type: "REQUEST_NOT_FOUND" as const })
    ).andThen((result) => result);
  },

  rejectFriendRequest(
    userId: number,
    requestId: number
  ): ResultAsync<void, FriendshipError> {
    return ResultAsync.fromPromise(
      (async () => {
        // Find the request - must be directed at current user
        const requests = await usersRepository.getPendingRequests(userId);
        const request = requests.find((r) => r.requestId === requestId);

        if (!request) {
          return err({ type: "REQUEST_NOT_FOUND" as const });
        }

        await usersRepository.deleteFriendship(requestId);

        return ok(undefined);
      })(),
      () => ({ type: "REQUEST_NOT_FOUND" as const })
    ).andThen((result) => result);
  },

  removeFriend(
    userId: number,
    friendId: number
  ): ResultAsync<void, FriendshipError> {
    return ResultAsync.fromPromise(
      (async () => {
        const friendship = await usersRepository.getFriendship(
          userId,
          friendId
        );

        if (!friendship || friendship.status !== "accepted") {
          return err({ type: "NOT_FRIENDS" as const });
        }

        await usersRepository.deleteFriendship(friendship.id);

        return ok(undefined);
      })(),
      () => ({ type: "NOT_FRIENDS" as const })
    ).andThen((result) => result);
  },

  blockUser(
    userId: number,
    targetId: number
  ): ResultAsync<void, FriendshipError> {
    return ResultAsync.fromPromise(
      (async () => {
        if (userId === targetId) {
          return err({ type: "CANNOT_FRIEND_SELF" as const });
        }

        const targetUser = await usersRepository.findById(targetId);
        if (!targetUser) {
          return err({ type: "USER_NOT_FOUND" as const });
        }

        // Check for existing relationship
        const existing = await usersRepository.getFriendship(userId, targetId);

        if (existing) {
          // Update to blocked
          await usersRepository.updateFriendshipStatus(existing.id, "blocked");
        } else {
          // Create blocked relationship
          await usersRepository.createFriendRequest(userId, targetId);
          const newRelation = await usersRepository.getFriendship(
            userId,
            targetId
          );
          if (newRelation) {
            await usersRepository.updateFriendshipStatus(
              newRelation.id,
              "blocked"
            );
          }
        }

        return ok(undefined);
      })(),
      () => ({ type: "USER_NOT_FOUND" as const })
    ).andThen((result) => result);
  },

  unblockUser(
    userId: number,
    targetId: number
  ): ResultAsync<void, FriendshipError> {
    return ResultAsync.fromPromise(
      (async () => {
        const friendship = await usersRepository.getFriendship(
          userId,
          targetId
        );

        if (
          !friendship ||
          friendship.status !== "blocked" ||
          friendship.userId !== userId
        ) {
          return err({ type: "USER_NOT_FOUND" as const });
        }

        await usersRepository.deleteFriendship(friendship.id);

        return ok(undefined);
      })(),
      () => ({ type: "USER_NOT_FOUND" as const })
    ).andThen((result) => result);
  },

  getFriendshipStatus(
    userId: number,
    targetId: number
  ): ResultAsync<
    | { status: "none" }
    | { status: "friends" }
    | { status: "pending_sent" }
    | { status: "pending_received" }
    | { status: "blocked" }
    | { status: "blocked_by" },
    never
  > {
    return ResultAsync.fromPromise(
      (async () => {
        const friendship = await usersRepository.getFriendship(
          userId,
          targetId
        );

        if (!friendship) {
          return { status: "none" as const };
        }

        if (friendship.status === "accepted") {
          return { status: "friends" as const };
        }

        if (friendship.status === "pending") {
          if (friendship.userId === userId) {
            return { status: "pending_sent" as const };
          }
          return { status: "pending_received" as const };
        }

        if (friendship.status === "blocked") {
          if (friendship.userId === userId) {
            return { status: "blocked" as const };
          }
          return { status: "blocked_by" as const };
        }

        return { status: "none" as const };
      })(),
      (): never => {
        throw new Error("Unexpected error checking friendship status");
      }
    );
  },

  // ---------------------------------------------------------------------------
  // Search
  // ---------------------------------------------------------------------------

  searchUsers(
    query: string,
    currentUserId: number,
    limit = 10
  ): ResultAsync<
    Array<{ id: number; displayName: string; avatarUrl: string | null }>,
    never
  > {
    return ResultAsync.fromPromise(
      usersRepository.searchUsers(query, currentUserId, limit),
      (): never => {
        throw new Error("Unexpected error searching users");
      }
    );
  },
};
