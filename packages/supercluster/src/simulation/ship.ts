import { Quat as GlQuat, type QuatLike, type Vec3Like } from "gl-matrix";

import type { InputState, ShipState } from "../types";

import { GAME_CONST } from "../constants";

const EPS = 1e-8;
const WORLD_X_AXIS: Vec3Like = [1, 0, 0];
const WORLD_Y_AXIS: Vec3Like = [0, 1, 0];

// Scratch quaternion to avoid per-call allocations
const _q1 = GlQuat.create();

export type ShipCollisionEvent = "none" | "ship_damaged" | "ship_destroyed";

export interface ShipCollisionDamageResult {
  ship: ShipState;
  event: ShipCollisionEvent;
}

/**
 * Ship-centric authoritative orientation step.
 * Updates orientation from input keys and keeps ship anchor fixed.
 */
export function stepShipOrientationState(
  shipOrientation: QuatLike,
  keys: InputState,
  deltaTicks: number = 1,
  speedRadPerTick: number = GAME_CONST.SHIP_SPEED
): { moved: boolean; orientation: QuatLike } {
  const orientation = [...shipOrientation] as QuatLike;
  GlQuat.normalize(orientation, orientation);

  let pitchAngle = 0;
  let yawAngle = 0;
  if (keys.forward) pitchAngle += speedRadPerTick * deltaTicks;
  if (keys.backward) pitchAngle -= speedRadPerTick * deltaTicks;
  if (keys.left) yawAngle += speedRadPerTick * deltaTicks;
  if (keys.right) yawAngle -= speedRadPerTick * deltaTicks;

  let moved = false;

  if (Math.abs(pitchAngle) > EPS) {
    GlQuat.setAxisAngle(_q1, WORLD_X_AXIS, pitchAngle);
    // premultiply: orientation = _q1 * orientation
    GlQuat.multiply(orientation, _q1, orientation);
    moved = true;
  }

  if (Math.abs(yawAngle) > EPS) {
    GlQuat.setAxisAngle(_q1, WORLD_Y_AXIS, yawAngle);
    GlQuat.multiply(orientation, _q1, orientation);
    moved = true;
  }

  if (moved) GlQuat.normalize(orientation, orientation);

  return {
    moved,
    orientation,
  };
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
