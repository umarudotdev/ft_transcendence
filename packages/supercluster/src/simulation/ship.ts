import * as THREE from "three";

import { GAME_CONST } from "../constants";
import type { InputState, Quat, ShipState, Vec3 } from "../types";
import { quatToThree, threeToQuat } from "./movement";

const EPS = 1e-8;
const WORLD_X_AXIS = new THREE.Vector3(1, 0, 0);
const WORLD_Y_AXIS = new THREE.Vector3(0, 1, 0);

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
  shipOrientation: Quat,
  keys: InputState,
  deltaTicks: number = 1,
  speedRadPerTick: number = GAME_CONST.SHIP_SPEED
): { moved: boolean; orientation: Quat } {
  const orientation = quatToThree(shipOrientation).normalize();

  let pitchAngle = 0;
  let yawAngle = 0;
  if (keys.forward) pitchAngle += speedRadPerTick * deltaTicks;
  if (keys.backward) pitchAngle -= speedRadPerTick * deltaTicks;
  if (keys.left) yawAngle += speedRadPerTick * deltaTicks;
  if (keys.right) yawAngle -= speedRadPerTick * deltaTicks;

  let moved = false;
  const scratchQuat = new THREE.Quaternion();

  if (Math.abs(pitchAngle) > EPS) {
    scratchQuat.setFromAxisAngle(WORLD_X_AXIS, pitchAngle);
    orientation.premultiply(scratchQuat);
    moved = true;
  }

  if (Math.abs(yawAngle) > EPS) {
    scratchQuat.setFromAxisAngle(WORLD_Y_AXIS, yawAngle);
    orientation.premultiply(scratchQuat);
    moved = true;
  }

  if (moved) orientation.normalize();

  return {
    moved,
    orientation: threeToQuat(orientation),
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

/**
 * Data-oriented ship step for authoritative runtime.
 * Keeps movement math shared while exposing plain serializable vectors.
 *
 * @deprecated Use `stepShipOrientationState(...)` in ship-centric mode.
 */
// export function stepShipState(
//   shipPosition: Vec3,
//   shipOrientation: Quat,
//   keys: InputState,
//   deltaTicks: number,
//   speedRadPerTick: number
// ): { moved: boolean; position: Vec3; orientation: Quat } {
//   const stepped = stepShipOrientationState(
//     shipOrientation,
//     keys,
//     deltaTicks,
//     speedRadPerTick
//   );

//   return {
//     moved: stepped.moved,
//     // Ship-centric compatibility wrapper: keep ship anchor fixed.
//     position: { ...shipPosition },
//     orientation: stepped.orientation,
//   };
// }
