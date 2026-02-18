import type { InputState } from "@ft/supercluster";

import type { ClientMessage } from "./types";

type SessionStatus = "connected" | "ready" | "playing" | "ended";

export interface ClientSession {
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

export function createSession(): ClientSession {
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

export function isClientMessage(value: unknown): value is ClientMessage {
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
