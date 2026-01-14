import { Elysia } from "elysia";
import { mkdir, unlink } from "node:fs/promises";
import { join } from "node:path";

import { authGuard } from "../../common/guards/auth.macro";
import { UsersModel } from "./users.model";
import { UsersService } from "./users.service";

const UPLOADS_DIR = join(process.cwd(), "uploads", "avatars");

await mkdir(UPLOADS_DIR, { recursive: true });

export const usersController = new Elysia({ prefix: "/users" })
  .use(authGuard)
  .get("/me", async ({ user }) => {
    const result = await UsersService.getProfile(user.id);

    if (result.isErr()) {
      return { user: null };
    }

    return { user: result.value };
  })
  .patch(
    "/me",
    async ({ body, user, set }) => {
      const result = await UsersService.updateProfile(user.id, body);

      if (result.isErr()) {
        const err = result.error;

        if (err.type === "USER_NOT_FOUND") {
          set.status = 404;
          return { message: "User not found" };
        }

        if (err.type === "INVALID_DISPLAY_NAME") {
          set.status = 400;
          return { message: err.message };
        }

        if (err.type === "DISPLAY_NAME_TAKEN") {
          set.status = 409;
          return { message: "Display name already taken" };
        }
      }

      return { user: result.isOk() ? result.value : null };
    },
    {
      body: UsersModel.updateProfile,
    }
  )
  .post(
    "/me/avatar",
    async ({ body, user, set }) => {
      const { file } = body;

      const validationResult = await UsersService.validateAvatarFile(file);

      if (validationResult.isErr()) {
        const err = validationResult.error;

        if (err.type === "INVALID_FILE_TYPE") {
          set.status = 400;
          return {
            message: "Invalid file type",
            allowed: err.allowed,
          };
        }

        if (err.type === "FILE_TOO_LARGE") {
          set.status = 400;
          return {
            message: "File too large",
            maxSize: err.maxSize,
          };
        }

        set.status = 500;
        return { message: "Upload failed" };
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

      if (updateResult.isErr()) {
        set.status = 500;
        return { message: "Failed to update avatar" };
      }

      return {
        message: "Avatar uploaded successfully",
        avatarUrl,
      };
    },
    {
      body: UsersModel.uploadAvatar,
    }
  )
  .get(
    "/me/stats",
    async ({ user, query }) => {
      const result = await UsersService.getStats(user.id, query.gameType);

      if (result.isErr()) {
        return { stats: null };
      }

      return { stats: result.value };
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

      if (result.isErr()) {
        return { matches: [], total: 0, hasMore: false };
      }

      return result.value;
    },
    {
      query: UsersModel.matchesQuery,
    }
  )
  .get("/me/friends", async ({ user }) => {
    const result = await UsersService.getFriends(user.id);

    if (result.isErr()) {
      return { friends: [] };
    }

    return { friends: result.value };
  })
  .get("/me/friends/pending", async ({ user }) => {
    const result = await UsersService.getPendingRequests(user.id);

    if (result.isErr()) {
      return { requests: [] };
    }

    return { requests: result.value };
  })
  .get("/me/friends/sent", async ({ user }) => {
    const result = await UsersService.getSentRequests(user.id);

    if (result.isErr()) {
      return { requests: [] };
    }

    return { requests: result.value };
  })
  .get(
    "/search",
    async ({ user, query }) => {
      const result = await UsersService.searchUsers(
        query.q,
        user.id,
        query.limit
      );

      if (result.isErr()) {
        return { users: [] };
      }

      return { users: result.value };
    },
    {
      query: UsersModel.searchQuery,
    }
  )
  .get(
    "/:id",
    async ({ params, user, set }) => {
      const userId = params.id;

      const result = await UsersService.getPublicProfile(userId);

      if (result.isErr() || !result.value) {
        set.status = 404;
        return { message: "User not found" };
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
    async ({ params, query, set }) => {
      const userId = params.id;

      const userResult = await UsersService.getPublicProfile(userId);
      if (userResult.isErr() || !userResult.value) {
        set.status = 404;
        return { message: "User not found" };
      }

      const result = await UsersService.getStats(userId, query.gameType);

      if (result.isErr()) {
        return { stats: null };
      }

      return { stats: result.value };
    },
    {
      params: UsersModel.userIdParam,
      query: UsersModel.statsQuery,
    }
  )
  .get(
    "/:id/matches",
    async ({ params, user, query, set }) => {
      const userId = params.id;

      const userResult = await UsersService.getPublicProfile(userId);
      if (userResult.isErr() || !userResult.value) {
        set.status = 404;
        return { message: "User not found" };
      }

      const result = await UsersService.getMatchHistory(userId, user.id, {
        limit: query.limit,
        offset: query.offset,
        gameType: query.gameType,
        result: query.result,
      });

      if (result.isErr()) {
        return { matches: [], total: 0, hasMore: false };
      }

      return result.value;
    },
    {
      params: UsersModel.userIdParam,
      query: UsersModel.matchesQuery,
    }
  )
  .post(
    "/:id/friend",
    async ({ params, user, set }) => {
      const targetId = params.id;

      const result = await UsersService.sendFriendRequest(user.id, targetId);

      if (result.isErr()) {
        const err = result.error;

        if (err.type === "USER_NOT_FOUND") {
          set.status = 404;
          return { message: "User not found" };
        }

        if (err.type === "CANNOT_FRIEND_SELF") {
          set.status = 400;
          return { message: "Cannot send friend request to yourself" };
        }

        if (err.type === "ALREADY_FRIENDS") {
          set.status = 409;
          return { message: "Already friends with this user" };
        }

        if (err.type === "REQUEST_PENDING") {
          set.status = 409;
          return { message: "Friend request already pending" };
        }

        if (err.type === "USER_BLOCKED") {
          set.status = 403;
          return { message: "Cannot send friend request" };
        }
      }

      return {
        message: "Friend request sent",
        requestId: result.isOk() ? result.value.requestId : null,
      };
    },
    {
      params: UsersModel.userIdParam,
    }
  )
  .delete(
    "/:id/friend",
    async ({ params, user, set }) => {
      const targetId = params.id;

      const result = await UsersService.removeFriend(user.id, targetId);

      if (result.isErr()) {
        const err = result.error;

        if (err.type === "NOT_FRIENDS") {
          set.status = 404;
          return { message: "Not friends with this user" };
        }
      }

      return { message: "Friend removed" };
    },
    {
      params: UsersModel.userIdParam,
    }
  )
  .post(
    "/:id/block",
    async ({ params, user, set }) => {
      const targetId = params.id;

      const result = await UsersService.blockUser(user.id, targetId);

      if (result.isErr()) {
        const err = result.error;

        if (err.type === "USER_NOT_FOUND") {
          set.status = 404;
          return { message: "User not found" };
        }

        if (err.type === "CANNOT_FRIEND_SELF") {
          set.status = 400;
          return { message: "Cannot block yourself" };
        }
      }

      return { message: "User blocked" };
    },
    {
      params: UsersModel.userIdParam,
    }
  )
  .delete(
    "/:id/block",
    async ({ params, user, set }) => {
      const targetId = params.id;

      const result = await UsersService.unblockUser(user.id, targetId);

      if (result.isErr()) {
        set.status = 404;
        return { message: "User not blocked" };
      }

      return { message: "User unblocked" };
    },
    {
      params: UsersModel.userIdParam,
    }
  )
  .post(
    "/friends/requests/:requestId/accept",
    async ({ params, user, set }) => {
      const result = await UsersService.acceptFriendRequest(
        user.id,
        params.requestId
      );

      if (result.isErr()) {
        set.status = 404;
        return { message: "Friend request not found" };
      }

      return { message: "Friend request accepted" };
    },
    {
      params: UsersModel.requestIdParam,
    }
  )
  .post(
    "/friends/requests/:requestId/reject",
    async ({ params, user, set }) => {
      const result = await UsersService.rejectFriendRequest(
        user.id,
        params.requestId
      );

      if (result.isErr()) {
        set.status = 404;
        return { message: "Friend request not found" };
      }

      return { message: "Friend request rejected" };
    },
    {
      params: UsersModel.requestIdParam,
    }
  );
