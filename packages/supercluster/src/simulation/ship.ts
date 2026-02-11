import * as THREE from "three";

import type { InputState, Quat, Vec3 } from "../types";

const WORLD_X_AXIS = new THREE.Vector3(1, 0, 0);
const WORLD_Y_AXIS = new THREE.Vector3(0, 1, 0);

/**
 * Compute ship facing direction in tangent/screen space from movement keys.
 * Returns null when no movement keys are active.
 */
export function getTargetDirectionFromInput(keys: InputState): number | null {
  let inputX = 0;
  let inputY = 0;

  // Canonical convention:
  // forward = 0, right = +PI/2, backward = PI, left = -PI/2
  if (keys.forward) inputY += 1;
  if (keys.backward) inputY -= 1;
  if (keys.right) inputX += 1;
  if (keys.left) inputX -= 1;

  if (inputX === 0 && inputY === 0) return null;

  // 0 = forward (-Y ship-space), PI/2 = right (+X ship-space)
  return Math.atan2(inputX, inputY);
}

/**
 * Shared ship movement step on sphere using quaternion integration.
 *
 * Mutates `planetQuaternion` and `shipPosition` in place.
 *
 * @param planetQuaternion - World rotation accumulator
 * @param shipPosition - Unit vector ship position on sphere
 * @param keys - Movement input snapshot
 * @param deltaTicks - Simulation delta in ticks
 * @param speedRadPerTick - Ship movement speed in rad/tick
 * @param scratchQuat - Reusable quaternion scratch (avoids allocations)
 * @returns true when movement was applied
 */
export function stepShipOnSphere(
  planetQuaternion: THREE.Quaternion,
  shipPosition: THREE.Vector3,
  keys: InputState,
  deltaTicks: number,
  speedRadPerTick: number,
  scratchQuat: THREE.Quaternion
): boolean {
  let pitchAngle = 0;
  let yawAngle = 0;

  if (keys.forward) pitchAngle += speedRadPerTick * deltaTicks;
  if (keys.backward) pitchAngle -= speedRadPerTick * deltaTicks;
  if (keys.left) yawAngle += speedRadPerTick * deltaTicks;
  if (keys.right) yawAngle -= speedRadPerTick * deltaTicks;

  let moved = false;

  // Pitch: rotate around X axis.
  if (pitchAngle !== 0) {
    scratchQuat.setFromAxisAngle(WORLD_X_AXIS, pitchAngle);
    planetQuaternion.premultiply(scratchQuat);

    // Ship moves opposite to planet rotation.
    scratchQuat.invert();
    shipPosition.applyQuaternion(scratchQuat);
    moved = true;
  }

  // Yaw: rotate around Y axis.
  if (yawAngle !== 0) {
    scratchQuat.setFromAxisAngle(WORLD_Y_AXIS, yawAngle);
    planetQuaternion.premultiply(scratchQuat);

    scratchQuat.invert();
    shipPosition.applyQuaternion(scratchQuat);
    moved = true;
  }

  if (moved) {
    planetQuaternion.normalize();
    shipPosition.normalize();
  }

  return moved;
}

/**
 * Data-oriented ship step for authoritative runtime.
 * Keeps movement math shared while exposing plain serializable vectors.
 */
export function stepShipState(
  shipPosition: Vec3,
  shipDirection: Vec3,
  shipOrientation: Quat,
  keys: InputState,
  deltaTicks: number,
  speedRadPerTick: number
): { moved: boolean; position: Vec3; direction: Vec3; orientation: Quat } {
  const position = new THREE.Vector3(
    shipPosition.x,
    shipPosition.y,
    shipPosition.z
  ).normalize();
  const planetQuaternion = new THREE.Quaternion(
    shipOrientation.x,
    shipOrientation.y,
    shipOrientation.z,
    shipOrientation.w
  ).normalize();
  const scratchQuat = new THREE.Quaternion();

  const moved = stepShipOnSphere(
    planetQuaternion,
    position,
    keys,
    deltaTicks,
    speedRadPerTick,
    scratchQuat
  );

  const targetDirection = getTargetDirectionFromInput(keys);
  const direction =
    targetDirection === null
      ? shipDirection
      : {
          x: -Math.sin(targetDirection),
          y: Math.cos(targetDirection),
          z: 0,
        };

  return {
    moved,
    position: { x: position.x, y: position.y, z: position.z },
    direction,
    orientation: {
      x: planetQuaternion.x,
      y: planetQuaternion.y,
      z: planetQuaternion.z,
      w: planetQuaternion.w,
    },
  };
}
