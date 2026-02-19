import { Elysia, t } from "elysia";

import {
  badRequest,
  conflict,
  internalError,
  notFound,
  unauthorized,
} from "../../common/errors/problem-details-helper";
import { AuthMacro } from "../../common/guards/auth.macro";
import { logger } from "../../common/logger";
import { env } from "../../env";
import { RankingsService } from "../rankings/rankings.service";
import { MatchmakingModel, type WSClientMessage } from "./matchmaking.model";
import { matchmakingRepository } from "./matchmaking.repository";
import { MatchmakingService } from "./matchmaking.service";

const matchmakingLogger = logger.child().withContext({ module: "matchmaking" });

function mapMatchmakingError(error: { type: string }) {
  switch (error.type) {
    case "ALREADY_IN_QUEUE":
      return conflict("Already in matchmaking queue");
    case "NOT_IN_QUEUE":
      return notFound("Not in matchmaking queue");
    case "ALREADY_COMPLETED":
      return conflict("Match result already recorded");
    case "SESSION_NOT_FOUND":
      return notFound("Game session not found");
    case "ROOM_CREATION_FAILED":
      return badRequest("Failed to create game room");
    case "INTERNAL_ERROR":
      return internalError();
    default:
      return badRequest("Unknown error");
  }
}

// Initialize the matchmaking pairing loop
MatchmakingService.initialize();

export const matchmakingController = new Elysia({ prefix: "/matchmaking" })
  .use(AuthMacro)

  // Join matchmaking queue
  .post(
    "/queue",
    async ({ body, user, set }) => {
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
        (error) => {
          const problem = mapMatchmakingError(error);
          set.status = problem.status;
          return problem;
        }
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
    ({ user, set }) => {
      const result = MatchmakingService.leaveQueue(user.id);

      return result.match(
        () => ({ success: true }),
        (error) => {
          const problem = mapMatchmakingError(error);
          set.status = problem.status;
          return problem;
        }
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
        matchmakingLogger
          .withMetadata({ action: "ws_auth_failed" })
          .warn("WS auth failed: Invalid or expired token");
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

      matchmakingLogger
        .withMetadata({ action: "ws_connected", userId })
        .info("WS connected");
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

        // Auto-remove from queue when last WS connection drops
        if (MatchmakingService.getConnectionCount(userId) === 0) {
          const queueStatus = MatchmakingService.getQueueStatus(userId);
          if (queueStatus.inQueue) {
            MatchmakingService.leaveQueue(userId);
            matchmakingLogger
              .withMetadata({
                action: "ws_disconnect_queue_cleanup",
                userId,
              })
              .info("Removed disconnected player from queue");
          }
        }

        matchmakingLogger
          .withMetadata({ action: "ws_disconnected", userId })
          .info("WS disconnected");
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
        async ({ body, set }) => {
          const result = await MatchmakingService.completeMatch(body);

          return result.match(
            (data) => data,
            (error) => {
              const problem = mapMatchmakingError(error);
              set.status = problem.status;
              return problem;
            }
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
      .post(
        "/sessions/:sessionId/abandon",
        async ({ params, set }) => {
          const session = await matchmakingRepository.getGameSession(
            params.sessionId
          );
          if (!session) {
            set.status = 404;
            return notFound("Session not found");
          }
          if (session.state !== "finished" && session.state !== "abandoned") {
            await matchmakingRepository.updateGameSession(params.sessionId, {
              state: "abandoned",
              endedAt: new Date(),
            });
          }
          return { success: true };
        },
        {
          params: t.Object({ sessionId: t.String() }),
        }
      )
  );
