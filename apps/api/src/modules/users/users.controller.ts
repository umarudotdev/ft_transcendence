import { Elysia } from "elysia";
import { mkdir, unlink } from "node:fs/promises";
import { join } from "node:path";

import { badRequest, internalError, notFound } from "../../common/errors";
import { authGuard } from "../../common/guards/auth.macro";
import {
  UsersModel,
  mapAvatarUploadError,
  mapFriendshipError,
  mapProfileUpdateError,
  mapUsernameChangeError,
} from "./users.model";
import { UsersService } from "./users.service";

const UPLOADS_DIR = join(process.cwd(), "uploads", "avatars");

await mkdir(UPLOADS_DIR, { recursive: true });

export const usersController = new Elysia({ prefix: "/users" })
  .use(authGuard)
  .get("/me", async ({ user }) => {
    const result = await UsersService.getProfile(user.id);

    return result.match(
      (profile) => ({ user: profile }),
      () => ({ user: null })
    );
  })
  .patch(
    "/me",
    async ({ body, user, request, set }) => {
      const instance = new URL(request.url).pathname;
      const result = await UsersService.updateProfile(user.id, body);

      return result.match(
        (profile) => ({ user: profile }),
        (error) => {
          const problem = mapProfileUpdateError(error, instance);
          set.status = problem.status;
          set.headers["Content-Type"] = "application/problem+json";
          return problem;
        }
      );
    },
    {
      body: UsersModel.updateProfile,
    }
  )
  .post(
    "/me/avatar",
    async ({ body, user, request, set }) => {
      const instance = new URL(request.url).pathname;
      const { file } = body;

      const validationResult = await UsersService.validateAvatarFile(file);

      if (validationResult.isErr()) {
        const problem = mapAvatarUploadError(validationResult.error, instance);
        set.status = problem.status;
        set.headers["Content-Type"] = "application/problem+json";
        return problem;
      }

      const extension = "webp";
      const filename = `${user.id}.${extension}`;
      const filepath = join(UPLOADS_DIR, filename);

      try {
        await unlink(filepath);
      } catch {}

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      try {
        const sharp = await import("sharp");
        await sharp
          .default(buffer)
          .resize(256, 256, { fit: "cover" })
          .webp({ quality: 80 })
          .toFile(filepath);
      } catch {
        const { writeFile } = await import("node:fs/promises");
        await writeFile(filepath, buffer);
      }

      const avatarUrl = `/uploads/avatars/${filename}`;

      const updateResult = await UsersService.updateAvatarUrl(
        user.id,
        avatarUrl
      );

      return updateResult.match(
        () => ({
          message: "Avatar uploaded successfully",
          avatarUrl,
        }),
        () => {
          const problem = internalError("Failed to update avatar", {
            instance,
          });
          set.status = problem.status;
          set.headers["Content-Type"] = "application/problem+json";
          return problem;
        }
      );
    },
    {
      body: UsersModel.uploadAvatar,
    }
  )
  .delete("/me/avatar", async ({ user, request, set }) => {
    const instance = new URL(request.url).pathname;

    // Try to delete the file from disk
    const filename = `${user.id}.webp`;
    const filepath = join(UPLOADS_DIR, filename);

    try {
      await unlink(filepath);
    } catch {
      // File might not exist, that's fine
    }

    // Update database to remove avatar URL
    const result = await UsersService.removeAvatarUrl(user.id);

    return result.match(
      () => ({
        message: "Avatar removed successfully",
      }),
      () => {
        const problem = internalError("Failed to remove avatar", {
          instance,
        });
        set.status = problem.status;
        set.headers["Content-Type"] = "application/problem+json";
        return problem;
      }
    );
  })
  .patch(
    "/me/username",
    async ({ body, user, request, set }) => {
      const instance = new URL(request.url).pathname;
      const result = await UsersService.updateUsername(user.id, body.username);

      return result.match(
        (profile) => ({ user: profile }),
        (error) => {
          const problem = mapUsernameChangeError(error, instance);
          set.status = problem.status;
          set.headers["Content-Type"] = "application/problem+json";
          return problem;
        }
      );
    },
    {
      body: UsersModel.updateUsername,
    }
  )
  .get("/me/username/history", async ({ user }) => {
    const result = await UsersService.getUsernameHistory(user.id);

    return result.match(
      (history) => ({ history }),
      () => ({ history: [] })
    );
  })
  .get(
    "/me/stats",
    async ({ user, query }) => {
      const result = await UsersService.getStats(user.id, query.gameType);

      return result.match(
        (stats) => ({ stats }),
        () => ({ stats: null })
      );
    },
    {
      query: UsersModel.statsQuery,
    }
  )
  .get(
    "/me/matches",
    async ({ user, query }) => {
      const result = await UsersService.getMatchHistory(user.id, user.id, {
        limit: query.limit,
        offset: query.offset,
        gameType: query.gameType,
        result: query.result,
      });

      return result.match(
        (data) => data,
        () => ({ matches: [], total: 0, hasMore: false })
      );
    },
    {
      query: UsersModel.matchesQuery,
    }
  )
  .get("/me/friends", async ({ user }) => {
    const result = await UsersService.getFriends(user.id);

    return result.match(
      (friends) => ({ friends }),
      () => ({ friends: [] })
    );
  })
  .get("/me/friends/pending", async ({ user }) => {
    const result = await UsersService.getPendingRequests(user.id);

    return result.match(
      (requests) => ({ requests }),
      () => ({ requests: [] })
    );
  })
  .get("/me/friends/sent", async ({ user }) => {
    const result = await UsersService.getSentRequests(user.id);

    return result.match(
      (requests) => ({ requests }),
      () => ({ requests: [] })
    );
  })
  .get(
    "/search",
    async ({ user, query }) => {
      const result = await UsersService.searchUsers(
        query.q,
        user.id,
        query.limit
      );

      return result.match(
        (users) => ({ users }),
        () => ({ users: [] })
      );
    },
    {
      query: UsersModel.searchQuery,
    }
  )
  .get(
    "/:id",
    async ({ params, user, request, set }) => {
      const instance = new URL(request.url).pathname;
      const userId = params.id;

      const result = await UsersService.getPublicProfile(userId);

      if (result.isErr() || !result.value) {
        const problem = notFound("User not found", { instance });
        set.status = problem.status;
        set.headers["Content-Type"] = "application/problem+json";
        return problem;
      }

      const friendshipResult = await UsersService.getFriendshipStatus(
        user.id,
        userId
      );

      return {
        user: result.value,
        friendshipStatus: friendshipResult.isOk()
          ? friendshipResult.value.status
          : "none",
      };
    },
    {
      params: UsersModel.userIdParam,
    }
  )
  .get(
    "/:id/stats",
    async ({ params, query, request, set }) => {
      const instance = new URL(request.url).pathname;
      const userId = params.id;

      const userResult = await UsersService.getPublicProfile(userId);
      if (userResult.isErr() || !userResult.value) {
        const problem = notFound("User not found", { instance });
        set.status = problem.status;
        set.headers["Content-Type"] = "application/problem+json";
        return problem;
      }

      const result = await UsersService.getStats(userId, query.gameType);

      return result.match(
        (stats) => ({ stats }),
        () => ({ stats: null })
      );
    },
    {
      params: UsersModel.userIdParam,
      query: UsersModel.statsQuery,
    }
  )
  .get(
    "/:id/matches",
    async ({ params, user, query, request, set }) => {
      const instance = new URL(request.url).pathname;
      const userId = params.id;

      const userResult = await UsersService.getPublicProfile(userId);
      if (userResult.isErr() || !userResult.value) {
        const problem = notFound("User not found", { instance });
        set.status = problem.status;
        set.headers["Content-Type"] = "application/problem+json";
        return problem;
      }

      const result = await UsersService.getMatchHistory(userId, user.id, {
        limit: query.limit,
        offset: query.offset,
        gameType: query.gameType,
        result: query.result,
      });

      return result.match(
        (data) => data,
        () => ({ matches: [], total: 0, hasMore: false })
      );
    },
    {
      params: UsersModel.userIdParam,
      query: UsersModel.matchesQuery,
    }
  )
  .post(
    "/:id/friend",
    async ({ params, user, request, set }) => {
      const instance = new URL(request.url).pathname;
      const targetId = params.id;

      const result = await UsersService.sendFriendRequest(user.id, targetId);

      return result.match(
        ({ requestId }) => ({
          message: "Friend request sent",
          requestId,
        }),
        (error) => {
          const problem = mapFriendshipError(error, instance);
          set.status = problem.status;
          set.headers["Content-Type"] = "application/problem+json";
          return problem;
        }
      );
    },
    {
      params: UsersModel.userIdParam,
    }
  )
  .delete(
    "/:id/friend",
    async ({ params, user, request, set }) => {
      const instance = new URL(request.url).pathname;
      const targetId = params.id;

      const result = await UsersService.removeFriend(user.id, targetId);

      return result.match(
        () => ({ message: "Friend removed" }),
        (error) => {
          const problem = mapFriendshipError(error, instance);
          set.status = problem.status;
          set.headers["Content-Type"] = "application/problem+json";
          return problem;
        }
      );
    },
    {
      params: UsersModel.userIdParam,
    }
  )
  .post(
    "/:id/block",
    async ({ params, user, request, set }) => {
      const instance = new URL(request.url).pathname;
      const targetId = params.id;

      const result = await UsersService.blockUser(user.id, targetId);

      return result.match(
        () => ({ message: "User blocked" }),
        (error) => {
          // Map CANNOT_FRIEND_SELF to "Cannot block yourself" for this context
          if (error.type === "CANNOT_FRIEND_SELF") {
            const problem = badRequest("Cannot block yourself", { instance });
            set.status = problem.status;
            set.headers["Content-Type"] = "application/problem+json";
            return problem;
          }
          const problem = mapFriendshipError(error, instance);
          set.status = problem.status;
          set.headers["Content-Type"] = "application/problem+json";
          return problem;
        }
      );
    },
    {
      params: UsersModel.userIdParam,
    }
  )
  .delete(
    "/:id/block",
    async ({ params, user, request, set }) => {
      const instance = new URL(request.url).pathname;
      const targetId = params.id;

      const result = await UsersService.unblockUser(user.id, targetId);

      return result.match(
        () => ({ message: "User unblocked" }),
        () => {
          const problem = notFound("User not blocked", { instance });
          set.status = problem.status;
          set.headers["Content-Type"] = "application/problem+json";
          return problem;
        }
      );
    },
    {
      params: UsersModel.userIdParam,
    }
  )
  .post(
    "/friends/requests/:requestId/accept",
    async ({ params, user, request, set }) => {
      const instance = new URL(request.url).pathname;
      const result = await UsersService.acceptFriendRequest(
        user.id,
        params.requestId
      );

      return result.match(
        () => ({ message: "Friend request accepted" }),
        () => {
          const problem = notFound("Friend request not found", { instance });
          set.status = problem.status;
          set.headers["Content-Type"] = "application/problem+json";
          return problem;
        }
      );
    },
    {
      params: UsersModel.requestIdParam,
    }
  )
  .post(
    "/friends/requests/:requestId/reject",
    async ({ params, user, request, set }) => {
      const instance = new URL(request.url).pathname;
      const result = await UsersService.rejectFriendRequest(
        user.id,
        params.requestId
      );

      return result.match(
        () => ({ message: "Friend request rejected" }),
        () => {
          const problem = notFound("Friend request not found", { instance });
          set.status = problem.status;
          set.headers["Content-Type"] = "application/problem+json";
          return problem;
        }
      );
    },
    {
      params: UsersModel.requestIdParam,
    }
  );
