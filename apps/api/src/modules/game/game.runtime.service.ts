import {
  createInitialShipState,
  createWaveArray,
  findProjectileAsteroidHits,
  findShipAsteroidHit,
  GAME_CONST,
  GAMEPLAY_CONST,
  normalizeAimAngle,
  spawnProjectilesFromAim,
  stepAsteroids,
  stepProjectiles,
  stepShipState,
  createAsteroidWave,
  createAsteroidFragments,
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
        const stepped = stepShipState(
          this.state.ship.position,
          this.state.ship.orientation,
          controllingSession.keys,
          1,
          GAME_CONST.SHIP_SPEED
        );
        this.state.ship.position = stepped.position;
        this.state.ship.orientation = stepped.orientation;

        if (this.shootCooldownTicks > 0) {
          this.shootCooldownTicks -= 1;
        }

        if (controllingSession.firePressed && this.shootCooldownTicks <= 0) {
          const spawned = spawnProjectilesFromAim(
            this.nextProjectileId,
            this.state.ship.position,
            this.state.ship.aimAngle,
            DEFAULT_GAMEPLAY.projectileRayCount
          );
          this.nextProjectileId = spawned.nextProjectileId;
          this.state.projectiles.push(...spawned.projectiles);
          this.shootCooldownTicks = DEFAULT_GAMEPLAY.projectileCooldown;
        }
      }
    }

    this.state.projectiles = stepProjectiles(this.state.projectiles, 1);
    this.state.asteroids = stepAsteroids(this.state.asteroids, 1);
    this.resolveCollisions();
    this.resolveAsteroidHitLifecycle();
    this.resolveShipCollision();
    this.stepShipInvincibility();

    this.state.tick += 1;
    this.broadcastState();
  }

  private static resolveCollisions(): void {
    const hits = findProjectileAsteroidHits(
      this.state.projectiles,
      this.state.asteroids
    );
    if (hits.length === 0) return;

    const consumedProjectileIds = new Set<number>();
    const asteroidHitIds = new Set<number>();
    const damagedAsteroidIds = new Set<number>();
    for (const hit of hits) {
      consumedProjectileIds.add(hit.projectileId);
      asteroidHitIds.add(hit.asteroidId);
    }

    this.state.projectiles = this.state.projectiles.filter(
      (projectile) => !consumedProjectileIds.has(projectile.id)
    );

    const nextAsteroids = this.state.asteroids.map((asteroid) => {
      if (!asteroidHitIds.has(asteroid.id)) return asteroid;
      if (!asteroid.canTakeDamage) return asteroid;
      damagedAsteroidIds.add(asteroid.id);

      const nextHealth = Math.max(asteroid.health - 1, 0);
      return {
        ...asteroid,
        health: nextHealth,
        canTakeDamage: false,
        isHit: true,
        hitTimer: this.asteroidHitDelayTicks,
      };
    });
    this.state.asteroids = nextAsteroids;

    for (const asteroidId of damagedAsteroidIds) {
      this.broadcastMessage({
        type: "hit",
        targetId: asteroidId,
        points: 10,
      });
      this.state.score += 10;
    }
  }

  private static resolveAsteroidHitLifecycle(): void {
    if (this.state.asteroids.length === 0) return;
    const survivors: GameState["asteroids"] = [];

    for (const asteroid of this.state.asteroids) {
      if (!asteroid.isHit) {
        survivors.push(asteroid);
        continue;
      }

      const nextTimer = asteroid.hitTimer - 1;
      if (nextTimer > 0) {
        survivors.push({
          ...asteroid,
          hitTimer: nextTimer,
        });
        continue;
      }

      if (asteroid.health <= 0) {
        if (asteroid.size > 1) {
          const fragmentCount = 2 + Math.floor(Math.random() * 2);
          const fragments = createAsteroidFragments(
            asteroid,
            this.nextAsteroidId,
            fragmentCount
          );
          this.nextAsteroidId = fragments.nextAsteroidId;
          survivors.push(...fragments.asteroids);
        }
        continue;
      }

      survivors.push({
        ...asteroid,
        canTakeDamage: true,
        isHit: false,
        hitTimer: 0,
      });
    }

    this.state.asteroids = survivors;
  }

  private static resolveShipCollision(): void {
    if (this.state.ship.invincible) return;
    if (this.state.ship.lives <= 0) return;

    const hitAsteroidId = findShipAsteroidHit(this.state.ship, this.state.asteroids);
    if (hitAsteroidId === null) return;

    const nextLives = Math.max(this.state.ship.lives - 1, 0);
    this.state.ship.lives = nextLives;
    this.state.ship.invincible = true;
    this.state.ship.invincibleTicks = Math.max(
      1,
      Math.round(DEFAULT_GAMEPLAY.invincibleTimer * GAME_CONST.TICK_RATE)
    );

    this.broadcastMessage({
      type: "damage",
      lives: nextLives,
    });

    if (nextLives <= 0) {
      this.state.gameStatus = "gameOver";
      this.broadcastMessage({
        type: "gameOver",
        finalScore: this.state.score,
        wave: this.state.wave,
      });
    }
  }

  private static stepShipInvincibility(): void {
    if (!this.state.ship.invincible) return;
    if (this.state.ship.invincibleTicks <= 0) {
      this.state.ship.invincible = false;
      this.state.ship.invincibleTicks = 0;
      return;
    }
    this.state.ship.invincibleTicks -= 1;
    if (this.state.ship.invincibleTicks <= 0) {
      this.state.ship.invincible = false;
      this.state.ship.invincibleTicks = 0;
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
