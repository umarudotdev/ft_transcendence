import { type Client, Room } from "colyseus";
import { z } from "zod";

import { CANVAS_HEIGHT, CANVAS_WIDTH, TICK_RATE } from "../config";
import { logger } from "../logger";
import { type GamePhase, GameState } from "../schemas/GameState";
import { PlayerSchema } from "../schemas/PlayerSchema";
import { type AbilitySlot, activateAbility } from "../systems/abilities";
import { MAX_HP } from "../systems/constants";
import { runGameTick } from "../systems/gameLoop";
import { isSpellCardActive } from "../systems/spellcard";

const InputSchema = z.object({
  up: z.boolean(),
  down: z.boolean(),
  left: z.boolean(),
  right: z.boolean(),
  fire: z.boolean(),
  focus: z.boolean(),
  aimAngle: z.number(),
});

type InputState = z.infer<typeof InputSchema>;

const COUNTDOWN_SECONDS = 3;
const DUMMY_SESSION_ID = "__dummy__";

const playgroundLogger = logger
  .child()
  .withContext({ module: "playground-room" });

export class PlaygroundRoom extends Room<{ state: GameState }> {
  maxClients = 1;
  autoDispose = true;
  patchRate = 1000 / 20;

  state = new GameState();

  private playerSessionId: string | null = null;
  private countdownStarted = false;

  messages = {
    input: (client: Client, data: unknown) => {
      const parsed = InputSchema.safeParse(data);
      if (!parsed.success) return;
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

      if (
        isSpellCardActive(this.state) &&
        client.sessionId === this.state.spellCardDeclarer &&
        parsed.data.slot !== 3
      ) {
        return;
      }

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

        if (parsed.data.slot === 3 && isSpellCardActive(this.state)) {
          this.broadcast("spellCardDeclared", {
            declarerId: client.sessionId,
            endsAtTick: this.state.spellCardEndsAtTick,
          });
        }
      }
    },

    ready: (_client: Client) => {
      // No-op — playground starts countdown on join
    },
  };

  async onAuth(_client: Client, options: Record<string, unknown>) {
    const userId = options.userId as number | undefined;
    const displayName =
      (options.displayName as string) ?? `Player ${userId ?? 0}`;

    if (userId == null) {
      throw new Error("Missing userId");
    }

    return { id: userId, displayName };
  }

  onCreate() {
    this.setSimulationInterval(
      (deltaTime) => this.update(deltaTime),
      1000 / TICK_RATE
    );

    playgroundLogger
      .withMetadata({ roomId: this.roomId })
      .info("Playground room created");
  }

  onJoin(
    client: Client,
    _options: Record<string, unknown>,
    auth: { id: number; displayName: string }
  ) {
    this.playerSessionId = client.sessionId;

    // Spawn human player at bottom
    const human = new PlayerSchema();
    human.playerIndex = 0;
    human.userId = auth.id;
    human.displayName = auth.displayName;
    human.connected = true;
    human.x = CANVAS_WIDTH / 2;
    human.y = CANVAS_HEIGHT - 60;
    human.aimAngle = 0;
    this.state.players.set(client.sessionId, human);

    client.send("assignPlayer", {
      sessionId: client.sessionId,
      playerIndex: 0,
    });

    // Spawn dummy at top
    this.spawnDummy();

    playgroundLogger
      .withMetadata({
        userId: auth.id,
        displayName: auth.displayName,
        roomId: this.roomId,
      })
      .info("Player joined playground");

    // Start countdown immediately
    this.startCountdown();
  }

  onLeave(client: Client) {
    playgroundLogger
      .withMetadata({ sessionId: client.sessionId, roomId: this.roomId })
      .info("Player left playground");

    this.state.players.delete(client.sessionId);
    this.state.players.delete(DUMMY_SESSION_ID);
    this.playerSessionId = null;
  }

  onDispose() {
    playgroundLogger
      .withMetadata({ roomId: this.roomId })
      .info("Playground room disposed");
  }

  private spawnDummy() {
    const dummy = new PlayerSchema();
    dummy.playerIndex = 1;
    dummy.userId = 0;
    dummy.displayName = "Target Dummy";
    dummy.connected = true;
    dummy.isFiring = false;
    dummy.x = CANVAS_WIDTH / 2;
    dummy.y = 60;
    dummy.aimAngle = Math.PI;
    // Keep bomb always on cooldown to prevent deathbomb window
    dummy.ability2LastUsedTick = this.state.tick;
    this.state.players.set(DUMMY_SESSION_ID, dummy);
  }

  private resetDummy() {
    const dummy = this.state.players.get(DUMMY_SESSION_ID);
    if (!dummy) return;

    dummy.hp = MAX_HP;
    dummy.lives = 3;
    dummy.invincibleUntil = 0;
    dummy.deathbombWindowUntil = 0;
    dummy.x = CANVAS_WIDTH / 2;
    dummy.y = 60;
    dummy.aimAngle = Math.PI;
    dummy.isFiring = false;
    dummy.velocityX = 0;
    dummy.velocityY = 0;
    // Re-lock bomb cooldown
    dummy.ability2LastUsedTick = this.state.tick;

    // Clear all bullets
    this.state.bullets.splice(0, this.state.bullets.length);

    // Clear spell card state if active
    this.state.spellCardDeclarer = "";
    this.state.spellCardEndsAtTick = 0;
    this.state.spellCardDefenderId = "";
    this.state.defenderLivesAtStart = 0;
  }

  private update(deltaTime: number) {
    const dt = deltaTime / 1000;

    if (this.state.phase === "countdown") {
      this.state.countdownTimer -= dt;
      if (this.state.countdownTimer <= 0) {
        this.setPhase("playing");
      }
      return;
    }

    if (this.state.phase !== "playing") return;

    const result = runGameTick(this.state, dt);

    // Broadcast hits
    for (const hit of result.hits) {
      const victim = this.state.players.get(hit.playerId);
      if (victim) {
        this.broadcast("hit", {
          playerId: hit.playerId,
          damage: hit.damage,
          hp: victim.hp,
          lives: victim.lives,
        });

        if (victim.deathbombWindowUntil > this.state.tick) {
          this.broadcast("deathbombWindow", {
            playerId: hit.playerId,
          });
        }
      }
    }

    // Broadcast grazes
    for (const graze of result.grazes) {
      this.broadcast("graze", {
        playerId: graze.playerId,
        x: graze.bulletX,
        y: graze.bulletY,
      });
    }

    // Broadcast spell card resolution
    if (result.spellCardResolution) {
      this.broadcast("spellCardResolution", {
        result: result.spellCardResolution,
      });
    }

    // Dummy defeated → reset dummy, keep player state
    if (result.winnerId) {
      this.resetDummy();
      this.broadcast("dummyReset", {});
    }
  }

  private applyInput(sessionId: string, input: InputState) {
    const player = this.state.players.get(sessionId);
    if (!player || !player.connected) return;

    player.velocityX = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    player.velocityY = (input.down ? 1 : 0) - (input.up ? 1 : 0);

    if (player.velocityX !== 0 && player.velocityY !== 0) {
      const factor = 1 / Math.sqrt(2);
      player.velocityX *= factor;
      player.velocityY *= factor;
    }

    player.isFiring = input.fire;
    player.isFocusing = input.focus;
    player.desiredAimAngle = input.aimAngle;
  }

  private startCountdown() {
    if (this.countdownStarted) return;
    this.countdownStarted = true;

    this.state.countdownTimer = COUNTDOWN_SECONDS;
    this.setPhase("countdown");
    this.broadcast("countdown", { seconds: COUNTDOWN_SECONDS });
  }

  private setPhase(phase: GamePhase) {
    this.state.phase = phase;
  }
}
