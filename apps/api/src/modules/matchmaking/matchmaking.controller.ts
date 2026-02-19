import { Elysia, t } from "elysia";

import {
  badRequest,
  conflict,
  notFound,
  unauthorized,
} from "../../common/errors/problem-details-helper";
import { AuthMacro } from "../../common/guards/auth.macro";
import { logger } from "../../common/logger";
import { env } from "../../env";
import { RankingsService } from "../rankings/rankings.service";
import { MatchmakingModel, type WSClientMessage } from "./matchmaking.model";
import { MatchmakingService } from "./matchmaking.service";

const matchmakingLogger = logger.child("matchmaking");

function mapMatchmakingError(error: { type: string }) {
  switch (error.type) {
    case "ALREADY_IN_QUEUE":
      return conflict("Already in matchmaking queue");
    case "NOT_IN_QUEUE":
      return notFound("Not in matchmaking queue");
    case "ROOM_CREATION_FAILED":
      return badRequest("Failed to create game room");
    default:
      return badRequest("Internal server error");
  }
}

// Initialize the matchmaking pairing loop
MatchmakingService.initialize();

export const matchmakingController = new Elysia({ prefix: "/matchmaking" })
  .use(AuthMacro)

  // Join matchmaking queue
  .post(
    "/queue",
    async ({ body, user }) => {
      const mode = body.mode ?? "ranked";

      // Get or create the user's rating
      const ratingResult = await RankingsService.getOrCreatePlayerRating(
        user.id
      );

      const ranking = ratingResult.match(
        (r) => r,
        () => null
      );

      const result = MatchmakingService.joinQueue(
        user.id,
        mode,
        ranking?.rating ?? 1000,
        user.displayName
      );

      return result.match(
        (data) => {
          const wsToken = MatchmakingService.generateWsToken(user.id);
          return { ...data, wsToken };
        },
        (error) => mapMatchmakingError(error)
      );
    },
    {
      isSignedIn: true,
      body: MatchmakingModel.joinQueue,
    }
  )

  // Leave matchmaking queue
  .delete(
    "/queue",
    ({ user }) => {
      const result = MatchmakingService.leaveQueue(user.id);

      return result.match(
        () => ({ success: true }),
        (error) => mapMatchmakingError(error)
      );
    },
    { isSignedIn: true }
  )

  // Get queue status
  .get(
    "/queue/status",
    ({ user }) => {
      return MatchmakingService.getQueueStatus(user.id);
    },
    { isSignedIn: true }
  )

  // WebSocket for real-time matchmaking updates
  .ws("/ws", {
    query: t.Object({
      token: t.String(),
    }),
    open(ws) {
      const token = ws.data.query.token;

      const userId = MatchmakingService.validateWsToken(token);

      if (userId === null) {
        matchmakingLogger.info({
          action: "ws_auth_failed",
          error: "Invalid or expired token",
        });
        ws.send(
          JSON.stringify({ type: "error", error: "Invalid or expired token" })
        );
        ws.close();
        return;
      }

      (ws.data as { userId?: number }).userId = userId;

      MatchmakingService.registerConnection(
        userId,
        ws.raw as unknown as WebSocket
      );

      matchmakingLogger.info({
        action: "ws_connected",
        userId,
      });
    },

    message(ws, message) {
      const userId = (ws.data as { userId?: number }).userId;
      if (!userId) return;

      const data = message as WSClientMessage;

      if (data.type === "cancel_queue") {
        MatchmakingService.leaveQueue(userId);
      }
    },

    close(ws) {
      const userId = (ws.data as { userId?: number }).userId;
      if (userId) {
        MatchmakingService.unregisterConnection(
          userId,
          ws.raw as unknown as WebSocket
        );
        matchmakingLogger.info({
          action: "ws_disconnected",
          userId,
        });
      }
    },
  })

  // --- Internal endpoints (game server → API) ---

  .group("/internal", (app) =>
    app
      .onBeforeHandle(({ request, set }) => {
        const authHeader = request.headers.get("Authorization");
        const expectedToken = `Bearer ${env.GAME_INTERNAL_SECRET}`;

        if (authHeader !== expectedToken) {
          set.status = 401;
          return unauthorized("Invalid internal secret");
        }
      })
      .post(
        "/matches/complete",
        async ({ body }) => {
          const result = await MatchmakingService.completeMatch(body);

          return result.match(
            (data) => data,
            (error) => mapMatchmakingError(error)
          );
        },
        { body: MatchmakingModel.matchCompletion }
      )
      .post(
        "/validate-join",
        ({ body, set }) => {
          const data = MatchmakingService.validateJoinToken(body.joinToken);

          if (!data) {
            set.status = 401;
            return unauthorized("Invalid or expired join token");
          }

          return {
            id: data.userId,
            displayName: data.displayName,
            matchSessionId: data.matchSessionId,
          };
        },
        {
          body: t.Object({
            joinToken: t.String(),
          }),
        }
      )
  );
