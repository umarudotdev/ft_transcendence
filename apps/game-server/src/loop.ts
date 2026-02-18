import type { ServerWebSocket } from "bun";
import type { QuatLike, Vec3Like } from "gl-matrix";

import {
  applyShipCollisionDamage,
  createAsteroidWave,
  createInitialShipState,
  createWaveArray,
  DEFAULT_GAMEPLAY,
  findShipAsteroidHit,
  GAME_CONST,
  GAMEPLAY_CONST,
  normalizeAimAngle,
  resolveProjectileAsteroidCollisions,
  spawnProjectilesFromAim,
  stepAsteroidHitLifecycle,
  stepAsteroids,
  stepProjectiles,
  stepShipPositionWorld,
  stepShipInvincibilityState,
  type GameState,
  type InputState,
} from "@ft/supercluster";

import type { ServerMessage } from "./types";

import {
  addClient,
  broadcast,
  broadcastMessage,
  getClients,
  removeClient,
  sendTo,
} from "./net";
import { createSession, isClientMessage, type ClientSession } from "./session";

// ============================================================================
// Game Runtime State
// ============================================================================
const sessions = new Map<ServerWebSocket<unknown>, ClientSession>();
let controllingClient: ServerWebSocket<unknown> | null = null;
let state: GameState = createInitialGameState();
let lastProcessedInputSeq = 0;
let nextProjectileId = 0;
let nextAsteroidId = 0;
let shootCooldownTicks = 0;
const asteroidHitDelayTicks = Math.max(
  1,
  Math.round(GAMEPLAY_CONST.HIT_DELAY_SEC * GAME_CONST.TICK_RATE)
);

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

// ============================================================================
// Client Management
// ============================================================================
export function registerClient(ws: ServerWebSocket<unknown>): void {
  addClient(ws);
  sessions.set(ws, createSession());
  if (controllingClient === null) {
    controllingClient = ws;
  }
  sendStateTo(ws);
}

export function unregisterClient(ws: ServerWebSocket<unknown>): void {
  removeClient(ws);
  sessions.delete(ws);

  if (controllingClient === ws) {
    const clients = getClients();
    const next = clients.values().next();
    controllingClient = next.done ? null : next.value;
    if (controllingClient === null) {
      state.gameStatus = "waiting";
    }
  }
}

// ============================================================================
// Message Handling
// ============================================================================
export function handleMessage(
  ws: ServerWebSocket<unknown>,
  rawMessage: unknown
): void {
  if (!isClientMessage(rawMessage)) return;
  const message = rawMessage;

  const session = sessions.get(ws);
  if (!session) return;

  if ("seq" in message) {
    if (message.seq <= session.lastSeq) return;
    session.lastSeq = message.seq;
    lastProcessedInputSeq = message.seq;
  }

  switch (message.type) {
    case "ready":
      state = createInitialGameState();
      nextProjectileId = 0;
      shootCooldownTicks = 0;
      {
        const wave = createWaveArray(DEFAULT_GAMEPLAY.asteroidWave);
        const asteroidSpawn = createAsteroidWave(nextAsteroidId, wave);
        state.asteroids = asteroidSpawn.asteroids;
        nextAsteroidId = asteroidSpawn.nextAsteroidId;
      }
      state.gameStatus = "playing";
      session.status = "playing";
      controllingClient = ws;
      lastProcessedInputSeq = 0;
      broadcastState();
      return;

    case "input":
      session.keys = { ...message.keys };
      break;

    case "aim":
      session.aimAngle = normalizeAimAngle(message.angle);
      if (controllingClient === ws) {
        state.ship.aimAngle = session.aimAngle;
      }
      break;

    case "shoot_start":
      session.firePressed = true;
      break;
    case "shoot_stop":
      session.firePressed = false;
      break;
  }

  sendStateTo(ws);
}

// ============================================================================
// Game Tick
// ============================================================================
function tick(): void {
  if (state.gameStatus !== "playing") return;

  const controller = controllingClient;
  // JUST NEW DATA ?? ********************************************************
  const activeKeys = controller
    ? (sessions.get(controller)?.keys ?? { ...DEFAULT_KEYS })
    : { ...DEFAULT_KEYS };

  const referenceShipPosition: Vec3Like = [
    state.ship.position[0],
    state.ship.position[1],
    state.ship.position[2],
  ];
  const referenceShipDirection: Vec3Like = [
    state.ship.direction[0],
    state.ship.direction[1],
    state.ship.direction[2],
  ];
  // END HERE ****************************************************************

  if (controller) {
    const controllingSession = sessions.get(controller);
    if (controllingSession) {
      const stepped = stepShipPositionWorld(
        state.ship.position,
        state.ship.direction,
        controllingSession.keys,
        1,
        GAME_CONST.SHIP_SPEED
      );
      state.ship.position = stepped.position;
      state.ship.direction = stepped.direction;

      if (shootCooldownTicks > 0) {
        shootCooldownTicks -= 1;
      }

      if (controllingSession.firePressed && shootCooldownTicks <= 0) {
        const spawned = spawnProjectilesFromAim(
          nextProjectileId,
          state.ship.position,
          state.ship.direction,
          state.ship.aimAngle,
          DEFAULT_GAMEPLAY.projectileRayCount
        );
        nextProjectileId = spawned.nextProjectileId;
        state.projectiles.push(...spawned.projectiles);
        shootCooldownTicks = DEFAULT_GAMEPLAY.projectileCooldown;
      }
    }
  }

  state.projectiles = stepProjectiles(
    state.projectiles,
    activeKeys,
    1,
    GAME_CONST.SHIP_SPEED,
    referenceShipPosition,
    referenceShipDirection
  );
  state.asteroids = stepAsteroids(state.asteroids, 1);
  resolveCollisions();
  resolveAsteroidHitLifecycle();
  resolveShipCollision();
  state.ship = stepShipInvincibilityState(state.ship);

  state.tick += 1;
  broadcastState();
}

function resolveCollisions(): void {
  const resolution = resolveProjectileAsteroidCollisions(
    state.projectiles,
    state.asteroids,
    asteroidHitDelayTicks
  );
  state.projectiles = resolution.projectiles;
  state.asteroids = resolution.asteroids;

  for (const event of resolution.events) {
    if (event.type !== "asteroid_damaged" || event.asteroidId === undefined) {
      continue;
    }
    const points = event.points ?? 0;
    broadcastMessage({
      type: "hit",
      targetId: event.asteroidId,
      points,
    });
    state.score += points;
  }
}

function resolveAsteroidHitLifecycle(): void {
  const stepped = stepAsteroidHitLifecycle(state.asteroids, nextAsteroidId);
  state.asteroids = stepped.asteroids;
  nextAsteroidId = stepped.nextAsteroidId;
}

function resolveShipCollision(): void {
  const hitDetected = findShipAsteroidHit(state.ship, state.asteroids) !== null;
  const damageResult = applyShipCollisionDamage(
    state.ship,
    hitDetected,
    Math.round(DEFAULT_GAMEPLAY.invincibleTimer * GAME_CONST.TICK_RATE)
  );
  state.ship = damageResult.ship;
  if (damageResult.event === "none") return;

  broadcastMessage({
    type: "damage",
    lives: state.ship.lives,
  });

  if (damageResult.event === "ship_destroyed") {
    state.gameStatus = "gameOver";
    broadcastMessage({
      type: "gameOver",
      finalScore: state.score,
      wave: state.wave,
    });
  }
}

// ============================================================================
// State Serialization & Broadcasting
// ============================================================================
function toMessage(): ServerMessage {
  return {
    type: "state",
    state: {
      ...state,
      ship: {
        ...state.ship,
        position: [...state.ship.position] as Vec3Like,
        direction: [...state.ship.direction] as Vec3Like,
        orientation: [...state.ship.orientation] as QuatLike,
      },
    },
    lastInputSeq: lastProcessedInputSeq,
  };
}

function sendStateTo(ws: ServerWebSocket<unknown>): void {
  sendTo(ws, JSON.stringify(toMessage()));
}

function broadcastState(): void {
  if (getClients().size === 0) return;
  broadcast(JSON.stringify(toMessage()));
}

// ============================================================================
// Game Loop Start/Stop
// ============================================================================
const tickIntervalMs = 1000 / GAME_CONST.TICK_RATE;
let timer: ReturnType<typeof setInterval> | null = null;

export function startLoop(): void {
  if (timer) return;
  timer = setInterval(tick, tickIntervalMs);
  console.log("[game-server] Game loop started");
}

export function stopLoop(): void {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
  console.log("[game-server] Game loop stopped");
}
