import { Elysia } from "elysia";
import type { ClientMessage } from "@ft/supercluster";

import { logger } from "../../common/logger";
import { GameRuntimeService } from "./game.runtime.service";

const AIM_LOG_INTERVAL_MS = 200;
const lastAimLogAtBySocket = new WeakMap<WebSocket, number>();

interface ParsedClientMessage {
  type?: string;
  seq?: number;
  tick?: number;
  angle?: number;
  keys?: {
    forward?: boolean;
    backward?: boolean;
    left?: boolean;
    right?: boolean;
  };
}

function parseClientMessage(message: unknown): ParsedClientMessage | null {
  if (typeof message === "string") {
    try {
      return JSON.parse(message) as ParsedClientMessage;
    } catch {
      return null;
    }
  }

  if (message && typeof message === "object") {
    return message as ParsedClientMessage;
  }

  return null;
}

function activeKeys(keys: ParsedClientMessage["keys"]): string[] {
  if (!keys) return [];

  const pressed: string[] = [];
  if (keys.forward) pressed.push("forward");
  if (keys.backward) pressed.push("backward");
  if (keys.left) pressed.push("left");
  if (keys.right) pressed.push("right");
  return pressed;
}

export const gameController = new Elysia({ prefix: "/game" }).ws("/ws", {
  open(ws) {
    const socket = ws.raw as unknown as WebSocket;
    GameRuntimeService.registerClient(socket);
    logger.ws("open", {
      module: "supercluster-game",
      action: "connected",
    });
  },
  message(ws, message) {
    const socket = ws.raw as unknown as WebSocket;
    const parsed = parseClientMessage(message);
    if (!parsed || typeof parsed.type !== "string") {
      logger.ws("message", {
        module: "supercluster-game",
        action: "invalid_message",
      });
      return;
    }

    GameRuntimeService.handleClientMessage(
      socket,
      parsed as ClientMessage
    );

    switch (parsed.type) {
      case "input":
        logger.ws("message", {
          module: "supercluster-game",
          action: "input_received_input",
          messageType: parsed.type,
          seq: parsed.seq ?? -1,
          tick: parsed.tick ?? -1,
          keys: parsed.keys ?? null,
          activeKeys: activeKeys(parsed.keys),
        });
        break;
      case "aim":
        // Throttle high-frequency aim logs to keep debug output readable.
        if (
          Date.now() - (lastAimLogAtBySocket.get(socket) ?? 0) >=
          AIM_LOG_INTERVAL_MS
        ) {
          lastAimLogAtBySocket.set(socket, Date.now());
          logger.ws("message", {
            module: "supercluster-game",
            action: "input_received_aim",
            messageType: parsed.type,
            seq: parsed.seq ?? -1,
            angle: parsed.angle ?? null,
          });
        }
        break;
      case "shoot_start":
        logger.ws("message", {
          module: "supercluster-game",
          action: "input_received_shoot_start",
          messageType: parsed.type,
          seq: parsed.seq ?? -1,
        });
        break;
      case "shoot_stop":
        logger.ws("message", {
          module: "supercluster-game",
          action: "input_received_shoot_stop",
          messageType: parsed.type,
          seq: parsed.seq ?? -1,
        });
        break;
      case "ready":
        logger.ws("message", {
          module: "supercluster-game",
          action: "input_received_ready",
          messageType: parsed.type,
        });
        break;
      default:
        logger.ws("message", {
          module: "supercluster-game",
          action: "unknown_message_type",
          messageType: parsed.type,
        });
        break;
    }
  },
  close(ws) {
    const socket = ws.raw as unknown as WebSocket;
    GameRuntimeService.unregisterClient(socket);
    lastAimLogAtBySocket.delete(socket);
    logger.ws("close", {
      module: "supercluster-game",
      action: "disconnected",
    });
  },
});
