import { type AuthContext, type Client, Room } from "colyseus";
import { z } from "zod";

import {
  API_URL,
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  GAME_INTERNAL_SECRET,
  MAX_PLAYERS,
  RECONNECT_TIMEOUT_SECONDS,
  TICK_RATE,
} from "../config";
import { logger } from "../logger";
import { type GamePhase, GameState } from "../schemas/GameState";
import { PlayerSchema } from "../schemas/PlayerSchema";
import {
  type AbilitySlot,
  activateAbility,
  chargeUltimate,
  cleanupExpiredEffects,
} from "../systems/abilities";
import { checkCollisions } from "../systems/collision";
import {
  applyDamage,
  checkGameOver,
  processFireInput,
} from "../systems/combat";
import { applyMovement } from "../systems/movement";

const InputSchema = z.object({
  up: z.boolean(),
  down: z.boolean(),
  left: z.boolean(),
  right: z.boolean(),
  fire: z.boolean(),
  focus: z.boolean(),
});

type InputState = z.infer<typeof InputSchema>;

const COUNTDOWN_SECONDS = 3;

const gameLogger = logger.child().withContext({ module: "game-room" });

export class GameRoom extends Room<{ state: GameState }> {
  maxClients = MAX_PLAYERS;
  autoDispose = true;
  patchRate = 1000 / 20; // 20Hz state sync to clients

  state = new GameState();

  private playerInputs = new Map<string, InputState>();
  private readyPlayers = new Set<string>();
  private gameStartTick = 0;
  private matchSessionId: string | null = null;

  messages = {
    input: (client: Client, data: unknown) => {
      const parsed = InputSchema.safeParse(data);
      if (!parsed.success) return;
      this.playerInputs.set(client.sessionId, parsed.data);
      this.applyInput(client.sessionId, parsed.data);
    },

    ability: (client: Client, data: unknown) => {
      const parsed = z
        .object({ slot: z.union([z.literal(1), z.literal(2), z.literal(3)]) })
        .safeParse(data);
      if (!parsed.success) return;
      if (this.state.phase !== "playing") return;

      const player = this.state.players.get(client.sessionId);
      if (!player || !player.connected) return;

      const activated = activateAbility(
        this.state,
        client.sessionId,
        player,
        parsed.data.slot as AbilitySlot
      );

      if (activated) {
        this.broadcast("abilityUsed", {
          playerId: client.sessionId,
          slot: parsed.data.slot,
        });
      }
    },

    ready: (client: Client) => {
      this.readyPlayers.add(client.sessionId);
      if (this.readyPlayers.size >= MAX_PLAYERS) {
        this.startCountdown();
      }
    },
  };

  async onAuth(
    _client: Client,
    options: Record<string, unknown>,
    _context: AuthContext
  ) {
    const joinToken = options.joinToken as string | undefined;

    // In development, accept a userId from options for testing
    if (!joinToken && process.env.NODE_ENV === "development") {
      const userId = options.userId as number | undefined;
      const displayName =
        (options.displayName as string) ?? `Player ${userId ?? 0}`;
      return { id: userId ?? 0, displayName };
    }

    if (!joinToken) {
      gameLogger.warn("Auth failed: Missing join token");
      throw new Error("Missing join token");
    }

    // Validate join token against API
    const url = `${API_URL}/api/matchmaking/internal/validate-join`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GAME_INTERNAL_SECRET}`,
      },
      body: JSON.stringify({ joinToken }),
    });

    if (!response.ok) {
      gameLogger.warn("Auth failed: Invalid join token");
      throw new Error("Invalid join token");
    }

    const auth = (await response.json()) as {
      id: number;
      displayName: string;
    };

    gameLogger
      .withMetadata({ userId: auth.id, displayName: auth.displayName })
      .info("Player authenticated");

    return auth;
  }

  onCreate(options: Record<string, unknown>) {
    this.matchSessionId = (options.matchSessionId as string) ?? null;

    this.setSimulationInterval(
      (deltaTime) => this.update(deltaTime),
      1000 / TICK_RATE
    );

    this.setMetadata({
      mode: options.mode ?? "ranked",
    });

    gameLogger
      .withMetadata({
        roomId: this.roomId,
        matchSessionId: this.matchSessionId,
        mode: options.mode ?? "ranked",
      })
      .info("Room created");
  }

  onJoin(
    client: Client,
    _options: Record<string, unknown>,
    auth: { id: number; displayName: string }
  ) {
    const player = new PlayerSchema();
    const index = this.state.players.size;

    player.playerIndex = index;
    player.userId = auth.id;
    player.displayName = auth.displayName;
    player.connected = true;

    // Player 1 spawns at bottom, Player 2 at top
    player.x = CANVAS_WIDTH / 2;
    player.y = index === 0 ? CANVAS_HEIGHT - 60 : 60;

    this.state.players.set(client.sessionId, player);

    client.send("assignPlayer", {
      sessionId: client.sessionId,
      playerIndex: index,
    });

    gameLogger
      .withMetadata({
        userId: auth.id,
        displayName: auth.displayName,
        playerIndex: index,
        roomId: this.roomId,
      })
      .info("Player joined");

    // Auto-ready when both players join (for testing; real flow uses "ready" message)
    if (
      this.state.players.size >= MAX_PLAYERS &&
      this.state.phase === "waiting"
    ) {
      this.readyPlayers.add(client.sessionId);
      if (this.readyPlayers.size >= MAX_PLAYERS) {
        this.startCountdown();
      }
    }
  }

  onDrop(client: Client, _code: number) {
    const player = this.state.players.get(client.sessionId);
    if (player) {
      player.connected = false;
    }
    gameLogger
      .withMetadata({
        sessionId: client.sessionId,
        userId: player?.userId,
        roomId: this.roomId,
      })
      .info("Player dropped");
    this.allowReconnection(client, RECONNECT_TIMEOUT_SECONDS).catch(() => {});
  }

  onReconnect(client: Client) {
    const player = this.state.players.get(client.sessionId);
    if (player) {
      player.connected = true;
    }
    gameLogger
      .withMetadata({
        sessionId: client.sessionId,
        userId: player?.userId,
        roomId: this.roomId,
      })
      .info("Player reconnected");
  }

  onLeave(client: Client, _code: number) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;

    gameLogger
      .withMetadata({
        sessionId: client.sessionId,
        userId: player.userId,
        roomId: this.roomId,
      })
      .info("Player left");

    this.playerInputs.delete(client.sessionId);
    this.readyPlayers.delete(client.sessionId);

    // If game is in progress and a player leaves permanently, the other wins
    // Check before deleting so reportMatchResult can read both players
    if (this.state.phase === "playing" && this.state.players.size === 2) {
      for (const [otherId] of this.state.players) {
        if (otherId !== client.sessionId) {
          this.endGame(otherId);
          break;
        }
      }
    }

    this.state.players.delete(client.sessionId);

    // If no players left, mark as abandoned
    if (this.state.players.size === 0 && this.state.phase !== "finished") {
      this.setPhase("abandoned");
    }
  }

  async onDispose() {
    gameLogger
      .withMetadata({
        roomId: this.roomId,
        matchSessionId: this.matchSessionId,
      })
      .info("Room disposed");
  }

  private update(deltaTime: number) {
    const dt = deltaTime / 1000; // Convert ms to seconds

    if (this.state.phase === "countdown") {
      this.state.countdownTimer -= dt;
      if (this.state.countdownTimer <= 0) {
        this.setPhase("playing");
      }
      return;
    }

    if (this.state.phase !== "playing") return;

    this.state.tick++;

    // 1. Process fire input → spawn bullets
    processFireInput(this.state);

    // 2. Move players and bullets
    applyMovement(this.state, dt);

    // 3. Check bullet-player collisions
    const hits = checkCollisions(this.state);

    // 4. Apply damage from hits and charge ultimate
    if (hits.length > 0) {
      applyDamage(this.state, hits);

      for (const hit of hits) {
        const victim = this.state.players.get(hit.playerId);
        if (victim) {
          this.broadcast("hit", {
            playerId: hit.playerId,
            damage: hit.damage,
            hp: victim.hp,
            lives: victim.lives,
          });
        }

        // Charge the shooter's ultimate
        const shooter = [...this.state.players.entries()].find(
          ([id]) => id !== hit.playerId
        );
        if (shooter) {
          chargeUltimate(shooter[1], hit.damage);
        }
      }
    }

    // 5. Cleanup expired effects
    cleanupExpiredEffects(this.state);

    // 6. Check for game over
    const winnerId = checkGameOver(this.state);
    if (winnerId) {
      this.endGame(winnerId);
    }
  }

  private applyInput(sessionId: string, input: InputState) {
    const player = this.state.players.get(sessionId);
    if (!player || !player.connected) return;

    player.velocityX = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    player.velocityY = (input.down ? 1 : 0) - (input.up ? 1 : 0);

    // Normalize diagonal movement
    if (player.velocityX !== 0 && player.velocityY !== 0) {
      const factor = 1 / Math.sqrt(2);
      player.velocityX *= factor;
      player.velocityY *= factor;
    }

    player.isFiring = input.fire;
    player.isFocusing = input.focus;
  }

  private startCountdown() {
    this.state.countdownTimer = COUNTDOWN_SECONDS;
    this.setPhase("countdown");
    this.broadcast("countdown", { seconds: COUNTDOWN_SECONDS });
    this.gameStartTick = this.state.tick + COUNTDOWN_SECONDS * TICK_RATE;
  }

  private endGame(winnerId: string) {
    this.state.winnerId = winnerId;
    this.setPhase("finished");

    const winner = this.state.players.get(winnerId);
    if (winner) {
      winner.score++;
    }

    this.broadcast("gameOver", {
      winnerId,
      winnerName: winner?.displayName ?? "Unknown",
    });

    const durationTicks = this.state.tick - this.gameStartTick;
    gameLogger
      .withMetadata({
        roomId: this.roomId,
        winnerId,
        winnerName: winner?.displayName ?? "Unknown",
        durationTicks,
      })
      .info("Game ended");

    // Report match result to API
    this.reportMatchResult(winnerId);
  }

  private async reportMatchResult(winnerId: string) {
    if (!this.matchSessionId) return;

    const players = [...this.state.players.entries()];
    if (players.length < 2) return;

    const [_p1SessionId, p1] = players[0];
    const [_p2SessionId, p2] = players[1];

    const winnerPlayer = this.state.players.get(winnerId);
    const durationTicks = this.state.tick - this.gameStartTick;
    const durationSeconds = Math.max(1, Math.round(durationTicks / TICK_RATE));

    try {
      await fetch(`${API_URL}/api/matchmaking/internal/matches/complete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${GAME_INTERNAL_SECRET}`,
        },
        body: JSON.stringify({
          sessionId: this.matchSessionId,
          player1Id: p1.userId,
          player2Id: p2.userId,
          player1Score: p1.score,
          player2Score: p2.score,
          winnerId: winnerPlayer?.userId ?? null,
          duration: durationSeconds,
          gameType: "bullet_hell",
          isAiGame: false,
        }),
      });
    } catch (error) {
      gameLogger
        .withMetadata({
          roomId: this.roomId,
          matchSessionId: this.matchSessionId,
        })
        .withError(error instanceof Error ? error : new Error(String(error)))
        .error("Failed to report match result");
    }
  }

  private setPhase(phase: GamePhase) {
    this.state.phase = phase;
  }
}
