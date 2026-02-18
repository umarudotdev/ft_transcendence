import type { InputState, ShipState } from "../types";

import { GAME_CONST } from "../constants";
import { applyShipInputTransform } from "./movement";

export type ShipCollisionEvent = "none" | "ship_damaged" | "ship_destroyed";

export interface ShipCollisionDamageResult {
  ship: ShipState;
  event: ShipCollisionEvent;
}

/**
 * World-centric ship movement step.
 * Applies input on sphere surface and keeps direction tangent to surface.
 */
export function stepShipPositionWorld(
  shipPosition: ShipState["position"],
  shipDirection: ShipState["direction"],
  keys: InputState,
  deltaTicks: number = 1,
  speedRadPerTick: number = GAME_CONST.SHIP_SPEED
): { moved: boolean; position: ShipState["position"]; direction: ShipState["direction"] } {
  return applyShipInputTransform(
    shipPosition,
    shipDirection,
    keys,
    deltaTicks,
    speedRadPerTick
  );
}

/**
 * Apply ship damage rules when a ship/asteroid hit is detected.
 * Pure state transition: no side effects (no messaging/logging).
 */
export function applyShipCollisionDamage(
  ship: ShipState,
  hitDetected: boolean,
  invincibleDurationTicks: number
): ShipCollisionDamageResult {
  if (!hitDetected) {
    return { ship, event: "none" };
  }
  if (ship.invincible || ship.lives <= 0) {
    return { ship, event: "none" };
  }

  const nextLives = Math.max(ship.lives - 1, 0);
  const nextShip: ShipState = {
    ...ship,
    lives: nextLives,
    invincible: true,
    invincibleTicks: Math.max(1, invincibleDurationTicks),
  };

  return {
    ship: nextShip,
    event: nextLives <= 0 ? "ship_destroyed" : "ship_damaged",
  };
}

/**
 * Tick down ship invincibility timer.
 * Pure state transition: no side effects.
 */
export function stepShipInvincibilityState(ship: ShipState): ShipState {
  if (!ship.invincible) return ship;
  if (ship.invincibleTicks <= 1) {
    return {
      ...ship,
      invincible: false,
      invincibleTicks: 0,
    };
  }

  return {
    ...ship,
    invincibleTicks: ship.invincibleTicks - 1,
  };
}
