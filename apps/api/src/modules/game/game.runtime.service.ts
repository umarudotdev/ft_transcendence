import {
  applyShipCollisionDamage,
  createInitialShipState,
  createWaveArray,
  findShipAsteroidHit,
  GAME_CONST,
  GAMEPLAY_CONST,
  normalizeAimAngle,
  resolveProjectileAsteroidCollisions,
  spawnProjectilesFromAim,
  stepAsteroidHitLifecycle,
  stepAsteroids,
  stepProjectiles,
  stepShipInvincibilityState,
  stepShipOrientationState,
  createAsteroidWave,
  DEFAULT_GAMEPLAY,
  type ClientMessage,
  type GameState,
  type InputState,
  type ServerMessage,
} from "@ft/supercluster";

import { logger } from "../../common/logger";

type SessionStatus = "connected" | "ready" | "playing" | "ended";

interface ClientSessionState {
  status: SessionStatus;
  lastSeq: number;
  keys: InputState;
  aimAngle: number;
  firePressed: boolean;
}

const DEFAULT_KEYS: InputState = {
  forward: false,
  backward: false,
  left: false,
  right: false,
};

function createInitialGameState(): GameState {
  return {
    tick: 0,
    ship: createInitialShipState(),
    projectiles: [],
    asteroids: [],
    score: 0,
    wave: 1,
    gameStatus: "waiting",
  };
}

function createInitialSession(): ClientSessionState {
  return {
    status: "connected",
    lastSeq: 0,
    keys: { ...DEFAULT_KEYS },
    aimAngle: 0,
    firePressed: false,
  };
}

function isInputState(value: unknown): value is InputState {
  if (!value || typeof value !== "object") return false;
  const maybe = value as Record<string, unknown>;
  return (
    typeof maybe.forward === "boolean" &&
    typeof maybe.backward === "boolean" &&
    typeof maybe.left === "boolean" &&
    typeof maybe.right === "boolean"
  );
}

function isClientMessage(value: unknown): value is ClientMessage {
  if (!value || typeof value !== "object") return false;
  const message = value as Record<string, unknown>;
  if (typeof message.type !== "string") return false;

  switch (message.type) {
    case "ready":
      return true;
    case "input":
      return (
        Number.isInteger(message.seq) &&
        Number.isInteger(message.tick) &&
        isInputState(message.keys)
      );
    case "aim":
      return Number.isInteger(message.seq) && Number.isFinite(message.angle);
    case "shoot_start":
    case "shoot_stop":
      return Number.isInteger(message.seq);
    default:
      return false;
  }
}

export class GameRuntimeService {
  private static clients = new Set<WebSocket>();
  private static sessions = new Map<WebSocket, ClientSessionState>();
  private static controllingClient: WebSocket | null = null;
  private static state: GameState = createInitialGameState();
  private static lastProcessedInputSeq = 0;
  private static nextProjectileId = 0;
  private static nextAsteroidId = 0;
  private static shootCooldownTicks = 0;
  private static readonly asteroidHitDelayTicks = Math.max(
    1,
    Math.round(GAMEPLAY_CONST.HIT_DELAY_SEC * GAME_CONST.TICK_RATE)
  );

  private static timer: ReturnType<typeof setInterval> | null = null;
  private static readonly tickIntervalMs = 1000 / GAME_CONST.TICK_RATE;

  static start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => this.tick(), this.tickIntervalMs);
    logger.info({
      module: "supercluster-runtime",
      action: "started",
      message: "SuperCluster runtime started",
    });
  }

  static stop(): void {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
    logger.info({
      module: "supercluster-runtime",
      action: "stopped",
      message: "SuperCluster runtime stopped",
    });
  }

  static registerClient(ws: WebSocket): void {
    this.clients.add(ws);
    this.sessions.set(ws, createInitialSession());
    if (this.controllingClient === null) {
      this.controllingClient = ws;
    }
    this.sendStateTo(ws);
  }

  static unregisterClient(ws: WebSocket): void {
    this.clients.delete(ws);
    this.sessions.delete(ws);

    if (this.controllingClient === ws) {
      const next = this.clients.values().next();
      this.controllingClient = next.done ? null : (next.value as WebSocket);
      if (this.controllingClient === null) {
        this.state.gameStatus = "waiting";
      }
    }
  }

  static handleClientMessage(ws: WebSocket, rawMessage: unknown): void {
    if (!isClientMessage(rawMessage)) return;
    const message = rawMessage;

    const session = this.sessions.get(ws);
    if (!session) return;

    if ("seq" in message) {
      if (message.seq <= session.lastSeq) return;
      session.lastSeq = message.seq;
      this.lastProcessedInputSeq = message.seq;
    }

    switch (message.type) {
      case "ready":
        this.state = createInitialGameState();
        this.nextProjectileId = 0;
        this.shootCooldownTicks = 0;
        const wave = createWaveArray(DEFAULT_GAMEPLAY.asteroidWave);
        const asteroidSpawn = createAsteroidWave(this.nextAsteroidId, wave);
        this.state.asteroids = asteroidSpawn.asteroids;
        this.nextAsteroidId = asteroidSpawn.nextAsteroidId;
        this.state.gameStatus = "playing";
        session.status = "playing";
        this.controllingClient = ws;
        this.lastProcessedInputSeq = 0;
        this.broadcastState();
        return;

      case "input":
        session.keys = { ...message.keys };
        break;

      case "aim":
        session.aimAngle = normalizeAimAngle(message.angle);
        if (this.controllingClient === ws) {
          this.state.ship.aimAngle = session.aimAngle;
        }
        break;

      case "shoot_start":
        session.firePressed = true;
        break;
      case "shoot_stop":
        session.firePressed = false;
        break;
    }

    this.sendStateTo(ws);
  }

  private static tick(): void {
    if (this.state.gameStatus !== "playing") return;

    const controller = this.controllingClient;
    if (controller) {
      const controllingSession = this.sessions.get(controller);
      if (controllingSession) {
        const stepped = stepShipOrientationState(
          this.state.ship.orientation,
          controllingSession.keys,
          1,
          GAME_CONST.SHIP_SPEED
        );
        this.state.ship.orientation = stepped.orientation;

        if (this.shootCooldownTicks > 0) {
          this.shootCooldownTicks -= 1;
        }

        if (controllingSession.firePressed && this.shootCooldownTicks <= 0) {
          const spawned = spawnProjectilesFromAim(
            this.nextProjectileId,
            this.state.ship.aimAngle,
            DEFAULT_GAMEPLAY.projectileRayCount
          );
          this.nextProjectileId = spawned.nextProjectileId;
          this.state.projectiles.push(...spawned.projectiles);
          this.shootCooldownTicks = DEFAULT_GAMEPLAY.projectileCooldown;
        }
      }
    }

    const activeKeys = controller
      ? (this.sessions.get(controller)?.keys ?? { ...DEFAULT_KEYS })
      : { ...DEFAULT_KEYS };
    this.state.projectiles = stepProjectiles(this.state.projectiles, 1);
    this.state.asteroids = stepAsteroids(
      this.state.asteroids,
      activeKeys,
      1,
      GAME_CONST.SHIP_SPEED
    );
    this.resolveCollisions();
    this.resolveAsteroidHitLifecycle();
    this.resolveShipCollision();
    this.state.ship = stepShipInvincibilityState(this.state.ship);

    this.state.tick += 1;
    this.broadcastState();
  }

  private static resolveCollisions(): void {
    const resolution = resolveProjectileAsteroidCollisions(
      this.state.projectiles,
      this.state.asteroids,
      this.asteroidHitDelayTicks
    );
    this.state.projectiles = resolution.projectiles;
    this.state.asteroids = resolution.asteroids;

    for (const event of resolution.events) {
      if (event.type !== "asteroid_damaged" || event.asteroidId === undefined) {
        continue;
      }
      const points = event.points ?? 0;
      this.broadcastMessage({
        type: "hit",
        targetId: event.asteroidId,
        points,
      });
      this.state.score += points;
    }
  }

  private static resolveAsteroidHitLifecycle(): void {
    const stepped = stepAsteroidHitLifecycle(
      this.state.asteroids,
      this.nextAsteroidId
    );
    this.state.asteroids = stepped.asteroids;
    this.nextAsteroidId = stepped.nextAsteroidId;
  }

  private static resolveShipCollision(): void {
    const hitDetected =
      findShipAsteroidHit(this.state.ship, this.state.asteroids) !== null;
    const damageResult = applyShipCollisionDamage(
      this.state.ship,
      hitDetected,
      Math.round(DEFAULT_GAMEPLAY.invincibleTimer * GAME_CONST.TICK_RATE)
    );
    this.state.ship = damageResult.ship;
    if (damageResult.event === "none") return;

    this.broadcastMessage({
      type: "damage",
      lives: this.state.ship.lives,
    });

    if (damageResult.event === "ship_destroyed") {
      this.state.gameStatus = "gameOver";
      this.broadcastMessage({
        type: "gameOver",
        finalScore: this.state.score,
        wave: this.state.wave,
      });
    }
  }

  private static toMessage(): ServerMessage {
    return {
      type: "state",
      state: {
        ...this.state,
        ship: {
          ...this.state.ship,
          position: { ...this.state.ship.position },
          orientation: { ...this.state.ship.orientation },
        },
      },
      lastInputSeq: this.lastProcessedInputSeq,
    };
  }

  private static sendStateTo(ws: WebSocket): void {
    if (ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify(this.toMessage()));
  }

  private static broadcastState(): void {
    if (this.clients.size === 0) return;
    const payload = JSON.stringify(this.toMessage());
    for (const ws of this.clients) {
      if (ws.readyState !== WebSocket.OPEN) {
        this.unregisterClient(ws);
        continue;
      }
      ws.send(payload);
    }
  }

  private static broadcastMessage(
    message: Exclude<ServerMessage, { type: "state" }>
  ): void {
    if (this.clients.size === 0) return;
    const payload = JSON.stringify(message);
    for (const ws of this.clients) {
      if (ws.readyState !== WebSocket.OPEN) {
        this.unregisterClient(ws);
        continue;
      }
      ws.send(payload);
    }
  }
}
