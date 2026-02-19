import { err, ok, type Result, ResultAsync } from "neverthrow";
import { randomUUID } from "node:crypto";

import type {
  MatchCompletionData,
  MatchmakingError,
  QueueEntry,
  WSServerMessage,
} from "./matchmaking.model";

import { logger } from "../../common/logger";
import { RankingsService } from "../rankings/rankings.service";
import { matchmakingRepository } from "./matchmaking.repository";

const matchmakingLogger = logger.child().withContext({ module: "matchmaking" });

const INITIAL_RATING_BAND = 200;
const RATING_BAND_EXPANSION = 50;
const RATING_BAND_EXPANSION_INTERVAL_S = 10;
const MAX_RATING_BAND = 500;
const PAIRING_INTERVAL_MS = 2000;
const ESTIMATED_WAIT_BASE_S = 15;

const WS_TOKEN_TTL_MS = 30_000;
const JOIN_TOKEN_TTL_MS = 60_000;
const TOKEN_SWEEP_INTERVAL_MS = 60_000;

interface JoinTokenData {
  userId: number;
  displayName: string;
  matchSessionId: string;
}

abstract class MatchmakingService {
  private static queue = new Map<number, QueueEntry>();
  private static connections = new Map<number, Set<WebSocket>>();
  private static pairingTimer: ReturnType<typeof setInterval> | null = null;
  private static pairingInProgress = false;
  private static tokenSweepTimer: ReturnType<typeof setInterval> | null = null;

  // Short-lived, single-use tokens
  private static wsTokens = new Map<
    string,
    { userId: number; expiresAt: number }
  >();
  private static joinTokens = new Map<
    string,
    { data: JoinTokenData; expiresAt: number }
  >();

  static initialize() {
    if (MatchmakingService.pairingTimer) return;

    MatchmakingService.pairingTimer = setInterval(
      () => MatchmakingService.pairingLoop(),
      PAIRING_INTERVAL_MS
    );

    MatchmakingService.tokenSweepTimer = setInterval(
      () => MatchmakingService.sweepExpiredTokens(),
      TOKEN_SWEEP_INTERVAL_MS
    );

    matchmakingLogger
      .withMetadata({ action: "initialized" })
      .info("Matchmaking service started");
  }

  static shutdown() {
    if (MatchmakingService.pairingTimer) {
      clearInterval(MatchmakingService.pairingTimer);
      MatchmakingService.pairingTimer = null;
    }
    if (MatchmakingService.tokenSweepTimer) {
      clearInterval(MatchmakingService.tokenSweepTimer);
      MatchmakingService.tokenSweepTimer = null;
    }
  }

  // --- Token management ---

  static generateWsToken(userId: number): string {
    const token = randomUUID();
    MatchmakingService.wsTokens.set(token, {
      userId,
      expiresAt: Date.now() + WS_TOKEN_TTL_MS,
    });
    return token;
  }

  static validateWsToken(token: string): number | null {
    const entry = MatchmakingService.wsTokens.get(token);
    if (!entry) return null;

    // Single-use: always delete
    MatchmakingService.wsTokens.delete(token);

    if (Date.now() > entry.expiresAt) return null;
    return entry.userId;
  }

  static generateJoinToken(
    userId: number,
    displayName: string,
    matchSessionId: string
  ): string {
    const token = randomUUID();
    MatchmakingService.joinTokens.set(token, {
      data: { userId, displayName, matchSessionId },
      expiresAt: Date.now() + JOIN_TOKEN_TTL_MS,
    });
    return token;
  }

  static validateJoinToken(token: string): JoinTokenData | null {
    const entry = MatchmakingService.joinTokens.get(token);
    if (!entry) return null;

    // Single-use: always delete
    MatchmakingService.joinTokens.delete(token);

    if (Date.now() > entry.expiresAt) return null;
    return entry.data;
  }

  // --- Session management ---

  static abandonSession(
    sessionId: string
  ): ResultAsync<{ success: boolean }, MatchmakingError> {
    return ResultAsync.fromPromise(
      (async () => {
        const session = await matchmakingRepository.getGameSession(sessionId);
        if (!session) {
          return err({ type: "SESSION_NOT_FOUND" as const });
        }
        if (session.state !== "finished" && session.state !== "abandoned") {
          await matchmakingRepository.updateGameSession(sessionId, {
            state: "abandoned",
            endedAt: new Date(),
          });
        }
        return ok({ success: true });
      })(),
      () => ({ type: "INTERNAL_ERROR" as const })
    ).andThen((result) => result);
  }

  // --- Token sweep (fix: memory leak from unexpired tokens) ---

  private static sweepExpiredTokens() {
    const now = Date.now();

    for (const [token, entry] of MatchmakingService.wsTokens) {
      if (entry.expiresAt <= now) {
        MatchmakingService.wsTokens.delete(token);
      }
    }

    for (const [token, entry] of MatchmakingService.joinTokens) {
      if (entry.expiresAt <= now) {
        MatchmakingService.joinTokens.delete(token);
      }
    }
  }

  // --- Queue management ---

  static joinQueue(
    userId: number,
    mode: string,
    rating: number,
    displayName: string
  ): Result<{ position: number; estimatedWait: number }, MatchmakingError> {
    if (MatchmakingService.queue.has(userId)) {
      return err({ type: "ALREADY_IN_QUEUE" });
    }

    const entry: QueueEntry = {
      userId,
      mode,
      rating,
      displayName,
      queuedAt: Date.now(),
    };

    MatchmakingService.queue.set(userId, entry);

    // Persist to DB for crash recovery (fire and forget, but log errors)
    matchmakingRepository
      .addToQueue({ userId, mode, rating })
      .catch((error) => {
        matchmakingLogger
          .withMetadata({ action: "db_queue_add_failed", userId })
          .withError(error instanceof Error ? error : new Error(String(error)))
          .warn("Failed to persist player to DB queue");
      });

    const position = MatchmakingService.queue.size;
    const estimatedWait = ESTIMATED_WAIT_BASE_S;

    matchmakingLogger
      .withMetadata({ action: "queue_joined", userId, mode, rating, position })
      .info("Player joined queue");

    return ok({ position, estimatedWait });
  }

  static leaveQueue(userId: number): Result<void, MatchmakingError> {
    if (!MatchmakingService.queue.has(userId)) {
      return err({ type: "NOT_IN_QUEUE" });
    }

    MatchmakingService.queue.delete(userId);

    matchmakingRepository.removeFromQueue(userId).catch((error) => {
      matchmakingLogger
        .withMetadata({ action: "db_queue_remove_failed", userId })
        .withError(error instanceof Error ? error : new Error(String(error)))
        .warn("Failed to remove player from DB queue");
    });

    matchmakingLogger
      .withMetadata({ action: "queue_left", userId })
      .info("Player left queue");

    return ok(undefined);
  }

  static getQueueStatus(userId: number): {
    inQueue: boolean;
    position: number;
  } {
    if (!MatchmakingService.queue.has(userId)) {
      return { inQueue: false, position: 0 };
    }

    let position = 0;
    for (const [id] of MatchmakingService.queue) {
      position++;
      if (id === userId) break;
    }

    return { inQueue: true, position };
  }

  // --- Match completion (with idempotency guard) ---

  static completeMatch(
    data: MatchCompletionData
  ): ResultAsync<
    { matchId: number; player1Change: number; player2Change: number },
    MatchmakingError
  > {
    return ResultAsync.fromPromise(
      (async () => {
        // Atomically finish the session and create the match record in one
        // transaction. This prevents lost results when createMatch fails
        // after the session is already marked "finished" (retries would
        // see ALREADY_COMPLETED with no match record).
        const result = await matchmakingRepository.completeGameSession(
          data.sessionId,
          {
            player1Id: data.player1Id,
            player2Id: data.player2Id,
            player1Score: data.player1Score,
            player2Score: data.player2Score,
            winnerId: data.winnerId,
            gameType: data.gameType,
            isAiGame: data.isAiGame,
            duration: data.duration,
          }
        );

        if (!result) {
          // Either session doesn't exist or is already in a terminal state
          const existing = await matchmakingRepository.getGameSession(
            data.sessionId
          );
          if (!existing) {
            return err({ type: "SESSION_NOT_FOUND" as const });
          }
          return err({ type: "ALREADY_COMPLETED" as const });
        }

        const { match } = result;

        // Update Elo ratings
        const ratingResult = await RankingsService.updateRatingsAfterMatch(
          match.id,
          data.player1Id,
          data.player2Id,
          data.winnerId
        );

        const ratingChanges = ratingResult.match(
          (changes) => changes,
          () => ({ player1Change: 0, player2Change: 0 })
        );

        matchmakingLogger
          .withMetadata({
            action: "match_completed",
            matchId: match.id,
            winnerId: data.winnerId,
            player1Change: ratingChanges.player1Change,
            player2Change: ratingChanges.player2Change,
          })
          .info("Match completed");

        // Notify players via WS (best-effort, log failures)
        await Promise.all([
          MatchmakingService.notifyMatchComplete(
            data.player1Id,
            data.winnerId === data.player1Id,
            ratingChanges.player1Change
          ).catch((notifyError) => {
            matchmakingLogger
              .withMetadata({
                action: "notify_failed",
                userId: data.player1Id,
              })
              .withError(
                notifyError instanceof Error
                  ? notifyError
                  : new Error(String(notifyError))
              )
              .warn("Failed to notify player of match completion");
          }),
          MatchmakingService.notifyMatchComplete(
            data.player2Id,
            data.winnerId === data.player2Id,
            ratingChanges.player2Change
          ).catch((notifyError) => {
            matchmakingLogger
              .withMetadata({
                action: "notify_failed",
                userId: data.player2Id,
              })
              .withError(
                notifyError instanceof Error
                  ? notifyError
                  : new Error(String(notifyError))
              )
              .warn("Failed to notify player of match completion");
          }),
        ]);

        return ok({
          matchId: match.id,
          ...ratingChanges,
        });
      })(),
      () => ({ type: "INTERNAL_ERROR" as const })
    ).andThen((result) => result);
  }

  // --- WebSocket connection management ---

  static registerConnection(userId: number, ws: WebSocket) {
    let set = MatchmakingService.connections.get(userId);
    if (!set) {
      set = new Set();
      MatchmakingService.connections.set(userId, set);
    }
    set.add(ws);
  }

  static unregisterConnection(userId: number, ws: WebSocket) {
    const set = MatchmakingService.connections.get(userId);
    if (set) {
      set.delete(ws);
      if (set.size === 0) {
        MatchmakingService.connections.delete(userId);
      }
    }
  }

  static getConnectionCount(userId: number): number {
    return MatchmakingService.connections.get(userId)?.size ?? 0;
  }

  private static sendToUser(userId: number, message: WSServerMessage) {
    const set = MatchmakingService.connections.get(userId);
    if (!set) return;

    const payload = JSON.stringify(message);
    for (const ws of set) {
      try {
        ws.send(payload);
      } catch {
        // Connection might be closed
      }
    }
  }

  private static async notifyMatchComplete(
    userId: number,
    won: boolean,
    ratingChange: number
  ) {
    const result = await RankingsService.getUserRanking(userId);

    result.match(
      (ranking) => {
        MatchmakingService.sendToUser(userId, {
          type: "match_complete",
          result: {
            won,
            ratingChange,
            newRating: ranking?.rating ?? 1000,
          },
        });
      },
      () => {}
    );
  }

  // --- Pairing loop (with mutex and WS-connected filter) ---

  private static async pairingLoop() {
    // Prevent concurrent executions if createMatchFromPair takes >2s
    if (MatchmakingService.pairingInProgress) return;
    MatchmakingService.pairingInProgress = true;

    try {
      const entries = [...MatchmakingService.queue.values()];
      if (entries.length < 2) return;

      // Only pair players who have an active WS connection
      const connectedEntries = entries.filter(
        (e) => (MatchmakingService.connections.get(e.userId)?.size ?? 0) > 0
      );
      if (connectedEntries.length < 2) return;

      const paired = new Set<number>();

      // Sort by queue time (FIFO)
      connectedEntries.sort((a, b) => a.queuedAt - b.queuedAt);

      for (let i = 0; i < connectedEntries.length; i++) {
        const player1 = connectedEntries[i];
        if (paired.has(player1.userId)) continue;

        const secondsInQueue = (Date.now() - player1.queuedAt) / 1000;
        const ratingBand = Math.min(
          INITIAL_RATING_BAND +
            Math.floor(secondsInQueue / RATING_BAND_EXPANSION_INTERVAL_S) *
              RATING_BAND_EXPANSION,
          MAX_RATING_BAND
        );

        for (let j = i + 1; j < connectedEntries.length; j++) {
          const player2 = connectedEntries[j];
          if (paired.has(player2.userId)) continue;
          if (player1.mode !== player2.mode) continue;

          const ratingDiff = Math.abs(player1.rating - player2.rating);
          if (ratingDiff <= ratingBand) {
            paired.add(player1.userId);
            paired.add(player2.userId);

            await MatchmakingService.createMatchFromPair(player1, player2);
            break;
          }
        }
      }
    } finally {
      MatchmakingService.pairingInProgress = false;
    }
  }

  private static async createMatchFromPair(
    player1: QueueEntry,
    player2: QueueEntry
  ) {
    try {
      // Create game session in DB
      const session = await matchmakingRepository.createGameSession({
        mode: player1.mode,
        state: "waiting",
      });

      const matchSessionId = session.id;

      // Remove both from queue
      MatchmakingService.queue.delete(player1.userId);
      MatchmakingService.queue.delete(player2.userId);
      matchmakingRepository.removeFromQueue(player1.userId).catch((error) => {
        matchmakingLogger
          .withMetadata({
            action: "db_queue_remove_failed",
            userId: player1.userId,
          })
          .withError(error instanceof Error ? error : new Error(String(error)))
          .warn("Failed to remove matched player from DB queue");
      });
      matchmakingRepository.removeFromQueue(player2.userId).catch((error) => {
        matchmakingLogger
          .withMetadata({
            action: "db_queue_remove_failed",
            userId: player2.userId,
          })
          .withError(error instanceof Error ? error : new Error(String(error)))
          .warn("Failed to remove matched player from DB queue");
      });

      // Generate single-use join tokens for each player
      const p1JoinToken = MatchmakingService.generateJoinToken(
        player1.userId,
        player1.displayName,
        matchSessionId
      );
      const p2JoinToken = MatchmakingService.generateJoinToken(
        player2.userId,
        player2.displayName,
        matchSessionId
      );

      // Get tier info for opponent display
      const p1Tier = RankingsService.getTierFromRating(player1.rating);
      const p2Tier = RankingsService.getTierFromRating(player2.rating);

      // Notify both players with their join tokens
      MatchmakingService.sendToUser(player1.userId, {
        type: "match_found",
        matchSessionId,
        joinToken: p1JoinToken,
        opponent: {
          id: player2.userId,
          displayName: player2.displayName,
          rating: player2.rating,
          tier: p2Tier,
        },
      });

      MatchmakingService.sendToUser(player2.userId, {
        type: "match_found",
        matchSessionId,
        joinToken: p2JoinToken,
        opponent: {
          id: player1.userId,
          displayName: player1.displayName,
          rating: player1.rating,
          tier: p1Tier,
        },
      });

      matchmakingLogger
        .withMetadata({
          action: "match_created",
          matchSessionId,
          player1: player1.userId,
          player2: player2.userId,
          ratingDiff: Math.abs(player1.rating - player2.rating),
        })
        .info("Match created");
    } catch (error) {
      matchmakingLogger
        .withMetadata({ action: "pairing_error" })
        .withError(error instanceof Error ? error : new Error(String(error)))
        .error("Pairing error");
    }
  }
}

export { MatchmakingService };
