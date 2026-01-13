import { Elysia, t } from "elysia";
import { mkdir, unlink } from "node:fs/promises";
import { join } from "node:path";

import { authGuard } from "../../common/guards/auth.guard";
import { usersService } from "./users.service";

// =============================================================================
// CONSTANTS
// =============================================================================

const UPLOADS_DIR = join(process.cwd(), "uploads", "avatars");

// Ensure uploads directory exists
await mkdir(UPLOADS_DIR, { recursive: true });

// =============================================================================
// USERS CONTROLLER
// =============================================================================

export const usersController = new Elysia({ prefix: "/users" })
  // ===========================================================================
  // PROTECTED ROUTES (Authentication required)
  // ===========================================================================
  .use(authGuard)

  // ---------------------------------------------------------------------------
  // Get Current User Profile
  // ---------------------------------------------------------------------------
  .get("/me", async ({ user }) => {
    const result = await usersService.getProfile(user.id);

    if (result.isErr()) {
      return { user: null };
    }

    return { user: result.value };
  })

  // ---------------------------------------------------------------------------
  // Update Current User Profile
  // ---------------------------------------------------------------------------
  .patch(
    "/me",
    async ({ body, user, set }) => {
      const result = await usersService.updateProfile(user.id, body);

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
      body: t.Object({
        displayName: t.Optional(t.String({ minLength: 3, maxLength: 20 })),
      }),
    }
  )

  // ---------------------------------------------------------------------------
  // Upload Avatar
  // ---------------------------------------------------------------------------
  .post(
    "/me/avatar",
    async ({ body, user, set }) => {
      const { file } = body;

      // Validate file
      const validationResult = await usersService.validateAvatarFile(file);

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

      // Process and save the file
      const extension = "webp"; // We'll convert to webp
      const filename = `${user.id}.${extension}`;
      const filepath = join(UPLOADS_DIR, filename);

      // Delete old avatar if exists
      try {
        await unlink(filepath);
      } catch {
        // Ignore if file doesn't exist
      }

      // Read and process the image using sharp (if available)
      // For now, we'll save the original and let the client handle display
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Try to use sharp for image processing
      try {
        const sharp = await import("sharp");
        await sharp
          .default(buffer)
          .resize(256, 256, { fit: "cover" })
          .webp({ quality: 80 })
          .toFile(filepath);
      } catch {
        // If sharp is not available, save the original
        const { writeFile } = await import("node:fs/promises");
        await writeFile(filepath, buffer);
      }

      // Generate the avatar URL
      const avatarUrl = `/uploads/avatars/${filename}`;

      // Update the user's avatar URL
      const updateResult = await usersService.updateAvatarUrl(
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
      body: t.Object({
        file: t.File({
          type: ["image/jpeg", "image/png", "image/webp"],
          maxSize: 2 * 1024 * 1024, // 2MB
        }),
      }),
    }
  )

  // ---------------------------------------------------------------------------
  // Get Current User Stats
  // ---------------------------------------------------------------------------
  .get(
    "/me/stats",
    async ({ user, query }) => {
      const result = await usersService.getStats(user.id, query.gameType);

      if (result.isErr()) {
        return { stats: null };
      }

      return { stats: result.value };
    },
    {
      query: t.Object({
        gameType: t.Optional(t.String()),
      }),
    }
  )

  // ---------------------------------------------------------------------------
  // Get Current User Match History
  // ---------------------------------------------------------------------------
  .get(
    "/me/matches",
    async ({ user, query }) => {
      const result = await usersService.getMatchHistory(user.id, user.id, {
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
      query: t.Object({
        limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100, default: 10 })),
        offset: t.Optional(t.Numeric({ minimum: 0, default: 0 })),
        gameType: t.Optional(t.String()),
        result: t.Optional(t.Union([t.Literal("win"), t.Literal("loss")])),
      }),
    }
  )

  // ---------------------------------------------------------------------------
  // Get Current User Friends
  // ---------------------------------------------------------------------------
  .get("/me/friends", async ({ user }) => {
    const result = await usersService.getFriends(user.id);

    if (result.isErr()) {
      return { friends: [] };
    }

    return { friends: result.value };
  })

  // ---------------------------------------------------------------------------
  // Get Pending Friend Requests
  // ---------------------------------------------------------------------------
  .get("/me/friends/pending", async ({ user }) => {
    const result = await usersService.getPendingRequests(user.id);

    if (result.isErr()) {
      return { requests: [] };
    }

    return { requests: result.value };
  })

  // ---------------------------------------------------------------------------
  // Get Sent Friend Requests
  // ---------------------------------------------------------------------------
  .get("/me/friends/sent", async ({ user }) => {
    const result = await usersService.getSentRequests(user.id);

    if (result.isErr()) {
      return { requests: [] };
    }

    return { requests: result.value };
  })

  // ---------------------------------------------------------------------------
  // Search Users
  // ---------------------------------------------------------------------------
  .get(
    "/search",
    async ({ user, query }) => {
      const result = await usersService.searchUsers(
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
      query: t.Object({
        q: t.String({ minLength: 1 }),
        limit: t.Optional(t.Numeric({ minimum: 1, maximum: 50, default: 10 })),
      }),
    }
  )

  // ---------------------------------------------------------------------------
  // Get Public Profile by ID
  // ---------------------------------------------------------------------------
  .get(
    "/:id",
    async ({ params, user, set }) => {
      const userId = params.id;

      const result = await usersService.getPublicProfile(userId);

      if (result.isErr() || !result.value) {
        set.status = 404;
        return { message: "User not found" };
      }

      // Get friendship status
      const friendshipResult = await usersService.getFriendshipStatus(
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
      params: t.Object({
        id: t.Numeric(),
      }),
    }
  )

  // ---------------------------------------------------------------------------
  // Get User Stats by ID
  // ---------------------------------------------------------------------------
  .get(
    "/:id/stats",
    async ({ params, query, set }) => {
      const userId = params.id;

      // Check if user exists
      const userResult = await usersService.getPublicProfile(userId);
      if (userResult.isErr() || !userResult.value) {
        set.status = 404;
        return { message: "User not found" };
      }

      const result = await usersService.getStats(userId, query.gameType);

      if (result.isErr()) {
        return { stats: null };
      }

      return { stats: result.value };
    },
    {
      params: t.Object({
        id: t.Numeric(),
      }),
      query: t.Object({
        gameType: t.Optional(t.String()),
      }),
    }
  )

  // ---------------------------------------------------------------------------
  // Get User Match History by ID
  // ---------------------------------------------------------------------------
  .get(
    "/:id/matches",
    async ({ params, user, query, set }) => {
      const userId = params.id;

      // Check if user exists
      const userResult = await usersService.getPublicProfile(userId);
      if (userResult.isErr() || !userResult.value) {
        set.status = 404;
        return { message: "User not found" };
      }

      const result = await usersService.getMatchHistory(userId, user.id, {
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
      params: t.Object({
        id: t.Numeric(),
      }),
      query: t.Object({
        limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100, default: 10 })),
        offset: t.Optional(t.Numeric({ minimum: 0, default: 0 })),
        gameType: t.Optional(t.String()),
        result: t.Optional(t.Union([t.Literal("win"), t.Literal("loss")])),
      }),
    }
  )

  // ---------------------------------------------------------------------------
  // Send Friend Request
  // ---------------------------------------------------------------------------
  .post(
    "/:id/friend",
    async ({ params, user, set }) => {
      const targetId = params.id;

      const result = await usersService.sendFriendRequest(user.id, targetId);

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
      params: t.Object({
        id: t.Numeric(),
      }),
    }
  )

  // ---------------------------------------------------------------------------
  // Remove Friend
  // ---------------------------------------------------------------------------
  .delete(
    "/:id/friend",
    async ({ params, user, set }) => {
      const targetId = params.id;

      const result = await usersService.removeFriend(user.id, targetId);

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
      params: t.Object({
        id: t.Numeric(),
      }),
    }
  )

  // ---------------------------------------------------------------------------
  // Block User
  // ---------------------------------------------------------------------------
  .post(
    "/:id/block",
    async ({ params, user, set }) => {
      const targetId = params.id;

      const result = await usersService.blockUser(user.id, targetId);

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
      params: t.Object({
        id: t.Numeric(),
      }),
    }
  )

  // ---------------------------------------------------------------------------
  // Unblock User
  // ---------------------------------------------------------------------------
  .delete(
    "/:id/block",
    async ({ params, user, set }) => {
      const targetId = params.id;

      const result = await usersService.unblockUser(user.id, targetId);

      if (result.isErr()) {
        set.status = 404;
        return { message: "User not blocked" };
      }

      return { message: "User unblocked" };
    },
    {
      params: t.Object({
        id: t.Numeric(),
      }),
    }
  )

  // ---------------------------------------------------------------------------
  // Accept Friend Request
  // ---------------------------------------------------------------------------
  .post(
    "/friends/requests/:requestId/accept",
    async ({ params, user, set }) => {
      const result = await usersService.acceptFriendRequest(
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
      params: t.Object({
        requestId: t.Numeric(),
      }),
    }
  )

  // ---------------------------------------------------------------------------
  // Reject Friend Request
  // ---------------------------------------------------------------------------
  .post(
    "/friends/requests/:requestId/reject",
    async ({ params, user, set }) => {
      const result = await usersService.rejectFriendRequest(
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
      params: t.Object({
        requestId: t.Numeric(),
      }),
    }
  );
