import { Elysia } from "elysia";
import type { ClientMessage } from "@ft/supercluster";

import { logger } from "../../common/logger";
import { GameRuntimeService } from "./game.runtime.service";

const AIM_LOG_INTERVAL_MS = 200;
let lastAimLogAt = 0;

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
    GameRuntimeService.registerClient(ws.raw as unknown as WebSocket);
    logger.ws("open", {
      module: "supercluster-game",
      action: "connected",
    });
  },
  message(ws, message) {
    const parsed = parseClientMessage(message);
    if (!parsed || typeof parsed.type !== "string") {
      logger.ws("message", {
        module: "supercluster-game",
        action: "invalid_message",
      });
      return;
    }

    GameRuntimeService.handleClientMessage(
      ws.raw as unknown as WebSocket,
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
        if (Date.now() - lastAimLogAt >= AIM_LOG_INTERVAL_MS) {
          lastAimLogAt = Date.now();
          logger.ws("message", {
            module: "supercluster-game",
            action: "input_received_aim",
            messageType: parsed.type,
            seq: parsed.seq ?? -1,
            angle: parsed.angle ?? null,
          });
        }
        break;
      case "shoot":
        logger.ws("message", {
          module: "supercluster-game",
          action: "input_received_shoot",
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
    GameRuntimeService.unregisterClient(ws.raw as unknown as WebSocket);
    logger.ws("close", {
      module: "supercluster-game",
      action: "disconnected",
    });
  },
});
