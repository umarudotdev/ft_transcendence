import { err, ok, ResultAsync } from "neverthrow";

import type {
  AvatarUploadError,
  DailyStatsResponse,
  FriendshipError,
  MatchHistoryItem,
  ProfileUpdateError,
  PublicUser,
  UsernameChangeError,
  UsernameHistoryItem,
  UserProfile,
  UserStats,
} from "./users.model";

import { usersRepository } from "./users.repository";

abstract class UsersService {
  private static readonly DISPLAY_NAME_MIN_LENGTH = 1;
  private static readonly DISPLAY_NAME_MAX_LENGTH = 50;
  private static readonly USERNAME_MIN_LENGTH = 3;
  private static readonly USERNAME_MAX_LENGTH = 20;
  private static readonly USERNAME_PATTERN = /^[a-z0-9_]+$/;
  private static readonly USERNAME_COOLDOWN_DAYS = 30;
  private static readonly MAX_AVATAR_SIZE = 2 * 1024 * 1024;
  private static readonly ALLOWED_AVATAR_TYPES = [
    "image/jpeg",
    "image/png",
    "image/webp",
  ];

  static getProfile(userId: number): ResultAsync<UserProfile | null, never> {
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
          username: user.username,
          usernameChangedAt: user.usernameChangedAt,
          avatarUrl: user.avatarUrl,
          emailVerified: user.emailVerified,
          twoFactorEnabled: user.twoFactorEnabled,
          intraId: user.intraId,
          createdAt: user.createdAt,
        };
      })(),
      () => null as never
    );
  }

  static getPublicProfile(
    userId: number
  ): ResultAsync<PublicUser | null, never> {
    return ResultAsync.fromPromise(
      (async () => {
        const user = await usersRepository.findById(userId);

        if (!user) {
          return null;
        }

        return {
          id: user.id,
          displayName: user.displayName,
          username: user.username,
          avatarUrl: user.avatarUrl,
          createdAt: user.createdAt,
        };
      })(),
      () => null as never
    );
  }

  static updateProfile(
    userId: number,
    data: { displayName?: string }
  ): ResultAsync<UserProfile, ProfileUpdateError> {
    return ResultAsync.fromPromise(
      (async () => {
        const user = await usersRepository.findById(userId);

        if (!user) {
          return err({ type: "USER_NOT_FOUND" as const });
        }

        if (data.displayName !== undefined) {
          const displayName = data.displayName.trim();

          if (displayName.length < UsersService.DISPLAY_NAME_MIN_LENGTH) {
            return err({
              type: "INVALID_DISPLAY_NAME" as const,
              message: `Display name must be at least ${UsersService.DISPLAY_NAME_MIN_LENGTH} character`,
            });
          }

          if (displayName.length > UsersService.DISPLAY_NAME_MAX_LENGTH) {
            return err({
              type: "INVALID_DISPLAY_NAME" as const,
              message: `Display name must be at most ${UsersService.DISPLAY_NAME_MAX_LENGTH} characters`,
            });
          }
        }

        const updated = await usersRepository.updateProfile(userId, data);

        return ok({
          id: updated.id,
          email: updated.email,
          displayName: updated.displayName,
          username: updated.username,
          usernameChangedAt: updated.usernameChangedAt,
          avatarUrl: updated.avatarUrl,
          emailVerified: updated.emailVerified,
          twoFactorEnabled: updated.twoFactorEnabled,
          intraId: updated.intraId,
          createdAt: updated.createdAt,
        });
      })(),
      () => ({ type: "USER_NOT_FOUND" as const })
    ).andThen((result) => result);
  }

  static validateAvatarFile(
    file: File
  ): ResultAsync<{ valid: true }, AvatarUploadError> {
    return ResultAsync.fromPromise(
      (async () => {
        if (!UsersService.ALLOWED_AVATAR_TYPES.includes(file.type)) {
          return err({
            type: "INVALID_FILE_TYPE" as const,
            allowed: UsersService.ALLOWED_AVATAR_TYPES,
          });
        }

        if (file.size > UsersService.MAX_AVATAR_SIZE) {
          return err({
            type: "FILE_TOO_LARGE" as const,
            maxSize: UsersService.MAX_AVATAR_SIZE,
          });
        }

        return ok({ valid: true as const });
      })(),
      () => ({ type: "UPLOAD_FAILED" as const })
    ).andThen((result) => result);
  }

  static updateAvatarUrl(
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
          username: updated.username,
          usernameChangedAt: updated.usernameChangedAt,
          avatarUrl: updated.avatarUrl,
          emailVerified: updated.emailVerified,
          twoFactorEnabled: updated.twoFactorEnabled,
          intraId: updated.intraId,
          createdAt: updated.createdAt,
        });
      })(),
      () => ({ type: "UPLOAD_FAILED" as const })
    ).andThen((result) => result);
  }

  static removeAvatarUrl(userId: number): ResultAsync<void, AvatarUploadError> {
    return ResultAsync.fromPromise(
      (async () => {
        const user = await usersRepository.findById(userId);

        if (!user) {
          return err({ type: "USER_NOT_FOUND" as const });
        }

        await usersRepository.updateAvatarUrl(userId, null);

        return ok(undefined);
      })(),
      () => ({ type: "UPLOAD_FAILED" as const })
    ).andThen((result) => result);
  }

  static updateUsername(
    userId: number,
    username: string
  ): ResultAsync<UserProfile, UsernameChangeError> {
    return ResultAsync.fromPromise(
      (async () => {
        const user = await usersRepository.findById(userId);

        if (!user) {
          return err({ type: "USER_NOT_FOUND" as const });
        }

        const normalizedUsername = username.toLowerCase().trim();

        // Validate length
        if (normalizedUsername.length < UsersService.USERNAME_MIN_LENGTH) {
          return err({
            type: "INVALID_USERNAME" as const,
            message: `Username must be at least ${UsersService.USERNAME_MIN_LENGTH} characters`,
          });
        }

        if (normalizedUsername.length > UsersService.USERNAME_MAX_LENGTH) {
          return err({
            type: "INVALID_USERNAME" as const,
            message: `Username must be at most ${UsersService.USERNAME_MAX_LENGTH} characters`,
          });
        }

        // Validate format
        if (!UsersService.USERNAME_PATTERN.test(normalizedUsername)) {
          return err({
            type: "INVALID_USERNAME" as const,
            message:
              "Username can only contain lowercase letters, numbers, and underscores",
          });
        }

        // Check cooldown
        if (user.usernameChangedAt) {
          const cooldownEnd = new Date(
            user.usernameChangedAt.getTime() +
              UsersService.USERNAME_COOLDOWN_DAYS * 24 * 60 * 60 * 1000
          );
          if (new Date() < cooldownEnd) {
            return err({
              type: "COOLDOWN_ACTIVE" as const,
              canChangeAt: cooldownEnd,
            });
          }
        }

        // Check uniqueness (skip if same as current)
        if (normalizedUsername !== user.username) {
          const existing =
            await usersRepository.findByUsername(normalizedUsername);
          if (existing) {
            return err({ type: "USERNAME_TAKEN" as const });
          }
        }

        // Record history if changing
        if (user.username !== normalizedUsername) {
          await usersRepository.createUsernameHistoryEntry({
            userId,
            oldUsername: user.username,
            newUsername: normalizedUsername,
          });
        }

        const updated = await usersRepository.updateUsername(
          userId,
          normalizedUsername
        );

        return ok({
          id: updated.id,
          email: updated.email,
          displayName: updated.displayName,
          username: updated.username,
          usernameChangedAt: updated.usernameChangedAt,
          avatarUrl: updated.avatarUrl,
          emailVerified: updated.emailVerified,
          twoFactorEnabled: updated.twoFactorEnabled,
          intraId: updated.intraId,
          createdAt: updated.createdAt,
        });
      })(),
      () => ({ type: "USER_NOT_FOUND" as const })
    ).andThen((result) => result);
  }

  static getUsernameHistory(
    userId: number
  ): ResultAsync<UsernameHistoryItem[], never> {
    return ResultAsync.fromPromise(
      (async () => {
        const history = await usersRepository.getUsernameHistory(userId);
        return history.map((entry) => ({
          id: entry.id,
          oldUsername: entry.oldUsername,
          newUsername: entry.newUsername,
          changedAt: entry.changedAt,
        }));
      })(),
      (): never => {
        throw new Error("Unexpected error fetching username history");
      }
    );
  }

  static getMatchHistory(
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
          limit: limit + 1,
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

        const mappedMatches: MatchHistoryItem[] = matchesToReturn.map(
          (match) => {
            const isPlayer1 = match.player1Id === userId;
            const playerScore = isPlayer1
              ? match.player1Score
              : match.player2Score;
            const opponentScore = isPlayer1
              ? match.player2Score
              : match.player1Score;

            let opponent: {
              id: number | null;
              displayName: string;
              username: string | null;
              avatarUrl: string | null;
            };

            if (match.isAiGame) {
              opponent = {
                id: null,
                displayName: "AI Opponent",
                username: null,
                avatarUrl: null,
              };
            } else if (isPlayer1 && match.player2) {
              opponent = {
                id: match.player2.id,
                displayName: match.player2.displayName,
                username: match.player2.username,
                avatarUrl: match.player2.avatarUrl,
              };
            } else if (!isPlayer1 && match.player1) {
              opponent = {
                id: match.player1.id,
                displayName: match.player1.displayName,
                username: match.player1.username,
                avatarUrl: match.player1.avatarUrl,
              };
            } else {
              opponent = {
                id: null,
                displayName: "Unknown",
                username: null,
                avatarUrl: null,
              };
            }

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

        const filteredMatches = options.result
          ? mappedMatches.filter((m) => m.result === options.result)
          : mappedMatches;

        return { matches: filteredMatches, total, hasMore };
      })(),
      (): never => {
        throw new Error("Unexpected error fetching match history");
      }
    );
  }

  static getStats(
    userId: number,
    gameType?: string
  ): ResultAsync<UserStats, never> {
    return ResultAsync.fromPromise(
      usersRepository.getStats(userId, gameType),
      (): never => {
        throw new Error("Unexpected error fetching stats");
      }
    );
  }

  static getDailyStats(
    userId: number,
    days = 30
  ): ResultAsync<DailyStatsResponse, never> {
    return ResultAsync.fromPromise(
      usersRepository.getDailyStats(userId, days),
      (): never => {
        throw new Error("Unexpected error fetching daily stats");
      }
    );
  }

  static getFriends(userId: number): ResultAsync<
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
  }

  static getPendingRequests(userId: number): ResultAsync<
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
  }

  static getSentRequests(userId: number): ResultAsync<
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
  }

  static sendFriendRequest(
    userId: number,
    friendId: number
  ): ResultAsync<{ requestId: number }, FriendshipError> {
    return ResultAsync.fromPromise(
      (async () => {
        if (userId === friendId) {
          return err({ type: "CANNOT_FRIEND_SELF" as const });
        }

        const targetUser = await usersRepository.findById(friendId);
        if (!targetUser) {
          return err({ type: "USER_NOT_FOUND" as const });
        }

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
  }

  static acceptFriendRequest(
    userId: number,
    requestId: number
  ): ResultAsync<void, FriendshipError> {
    return ResultAsync.fromPromise(
      (async () => {
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
  }

  static rejectFriendRequest(
    userId: number,
    requestId: number
  ): ResultAsync<void, FriendshipError> {
    return ResultAsync.fromPromise(
      (async () => {
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
  }

  static removeFriend(
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
  }

  static blockUser(
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

        const existing = await usersRepository.getFriendship(userId, targetId);

        if (existing) {
          await usersRepository.updateFriendshipStatus(existing.id, "blocked");
        } else {
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
  }

  static unblockUser(
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
  }

  static getFriendshipStatus(
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
  }

  static searchUsers(
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
  }
}

export { UsersService };
