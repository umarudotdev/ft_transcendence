import {
  DEFAULT_GAMEPLAY,
  GAME_CONST,
  stepShipState,
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
    ship: {
      position: {
        x: GAME_CONST.SHIP_INITIAL_POS.x,
        y: GAME_CONST.SHIP_INITIAL_POS.y,
        z: GAME_CONST.SHIP_INITIAL_POS.z,
      },
      direction: { x: 0, y: -1, z: 0 },
      aimAngle: 0,
      lives: DEFAULT_GAMEPLAY.shipLives,
      invincible: DEFAULT_GAMEPLAY.shipInvincible,
      invincibleTicks: 0,
      cooldownLevel: 0,
      rayCountLevel: 0,
    },
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
    case "shoot":
      return Number.isInteger(message.seq);
    default:
      return false;
  }
}

function normalizeAngle(angle: number): number {
  const twoPi = Math.PI * 2;
  const normalized = angle % twoPi;
  return normalized < 0 ? normalized + twoPi : normalized;
}

export class GameRuntimeService {
  private static clients = new Set<WebSocket>();
  private static sessions = new Map<WebSocket, ClientSessionState>();
  private static controllingClient: WebSocket | null = null;
  private static state: GameState = createInitialGameState();
  private static lastProcessedInputSeq = 0;

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
        session.aimAngle = normalizeAngle(message.angle);
        if (this.controllingClient === ws) {
          this.state.ship.aimAngle = session.aimAngle;
        }
        break;

      case "shoot":
        session.firePressed = true;
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
          this.state.ship.direction,
          controllingSession.keys,
          1,
          GAME_CONST.SHIP_SPEED
        );
        this.state.ship.position = stepped.position;
        this.state.ship.direction = stepped.direction;
      }
    }

    this.state.tick += 1;
    this.broadcastState();
    for (const session of this.sessions.values()) {
      session.firePressed = false;
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
          direction: { ...this.state.ship.direction },
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
}
