import { t } from "elysia";

export const MatchmakingModel = {
  joinQueue: t.Object({
    mode: t.Optional(
      t.Union([t.Literal("ranked"), t.Literal("casual")], {
        default: "ranked",
      })
    ),
  }),

  matchCompletion: t.Object({
    sessionId: t.String(),
    player1Id: t.Number(),
    player2Id: t.Number(),
    player1Score: t.Number(),
    player2Score: t.Number(),
    winnerId: t.Nullable(t.Number()),
    duration: t.Number(),
    gameType: t.String({ default: "bullet_hell" }),
    isAiGame: t.Boolean({ default: false }),
  }),
};

export type MatchCompletionData =
  (typeof MatchmakingModel.matchCompletion)["static"];

export type MatchmakingError =
  | { type: "ALREADY_IN_QUEUE" }
  | { type: "NOT_IN_QUEUE" }
  | { type: "MATCH_NOT_FOUND" }
  | { type: "SESSION_NOT_FOUND" }
  | { type: "ALREADY_COMPLETED" }
  | { type: "ROOM_CREATION_FAILED" }
  | { type: "INTERNAL_ERROR" };

export interface QueueEntry {
  userId: number;
  mode: string;
  rating: number;
  displayName: string;
  queuedAt: number;
}

export type WSServerMessage =
  | { type: "queue_joined"; position: number; estimatedWait: number }
  | { type: "queue_update"; position: number; estimatedWait: number }
  | {
      type: "match_found";
      matchSessionId: string;
      joinToken: string;
      opponent: {
        id: number;
        displayName: string;
        rating: number;
        tier: string;
      };
    }
  | {
      type: "match_complete";
      result: { won: boolean; ratingChange: number; newRating: number };
    }
  | { type: "error"; error: string };

export type WSClientMessage = { type: "cancel_queue" };
