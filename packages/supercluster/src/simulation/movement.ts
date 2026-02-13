import * as THREE from "three";
import type { InputState } from "../types";
import type { Vec3 } from "../types";

// ============================================================================
// Movement Module
// Great-circle motion on sphere surface
// Uses THREE.Vector3 math (works on both server and client)
// ============================================================================

const EPS = 1e-8;
const WORLD_X_AXIS = new THREE.Vector3(1, 0, 0);
const WORLD_Y_AXIS = new THREE.Vector3(0, 1, 0);

export function vec3ToThree(value: Vec3): THREE.Vector3 {
  return new THREE.Vector3(value.x, value.y, value.z);
}

export function threeToVec3(value: THREE.Vector3): Vec3 {
  return { x: value.x, y: value.y, z: value.z };
}

export function normalizeVec3(
  value: Vec3,
  fallback: Vec3 = { x: 0, y: 0, z: 1 }
): Vec3 {
  const normalized = vec3ToThree(value);
  if (normalized.lengthSq() <= EPS) {
    return { ...fallback };
  }
  normalized.normalize();
  return threeToVec3(normalized);
}

export function randomUnitVec3(): Vec3 {
  return threeToVec3(new THREE.Vector3().randomDirection());
}

export function randomTangentVec3(position: Vec3): Vec3 {
  const p = vec3ToThree(normalizeVec3(position));
  const tangent = new THREE.Vector3().randomDirection().projectOnPlane(p);

  if (tangent.lengthSq() <= EPS) {
    const fallbackAxis =
      Math.abs(p.y) < 0.99
        ? new THREE.Vector3(0, 1, 0)
        : new THREE.Vector3(1, 0, 0);
    tangent.copy(p).cross(fallbackAxis);
  }
  tangent.normalize();
  return threeToVec3(tangent);
}

// ============================================================================
// Sphere Surface Movement
// ============================================================================

/**
 * Move a position along sphere surface in a direction (great-circle motion)
 * Mutates position and velocity vectors in place for performance.
 *
 * @param position - Current position (unit vector, MUTATED)
 * @param velocity - Movement direction (unit vector tangent to sphere, MUTATED)
 * @param angle - Angular distance to move (radians)
 */
export function moveOnSphere(
  position: THREE.Vector3,
  velocity: THREE.Vector3,
  angle: number
): void {
  if (Math.abs(angle) <= EPS) return;

  // Reproject velocity onto tangent plane to prevent radial drift
  const tangentVelocity = velocity
    .clone()
    .sub(position.clone().multiplyScalar(velocity.dot(position)));

  if (tangentVelocity.lengthSq() < EPS) return;
  tangentVelocity.normalize();

  // Rotation axis = perpendicular to position and velocity (great-circle motion)
  const axis = new THREE.Vector3().crossVectors(position, tangentVelocity);
  if (axis.lengthSq() < EPS) return;
  axis.normalize();

  // Create rotation quaternion and apply
  const quat = new THREE.Quaternion().setFromAxisAngle(axis, angle);

  // Rotate position
  position.applyQuaternion(quat).normalize();

  // Rotate velocity to stay tangent after movement
  tangentVelocity.applyQuaternion(quat).normalize();
  velocity.copy(tangentVelocity);
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
  if (Math.abs(pitchAngle) > EPS) {
    scratchQuat.setFromAxisAngle(WORLD_X_AXIS, pitchAngle);
    planetQuaternion.premultiply(scratchQuat);

    // Ship moves opposite to planet rotation.
    scratchQuat.invert();
    shipPosition.applyQuaternion(scratchQuat);
    moved = true;
  }

  // Yaw: rotate around Y axis.
  if (Math.abs(yawAngle) > EPS) {
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
 * Data-oriented sphere motion step for entities with position+direction.
 * Uses shared great-circle motion and returns normalized Vec3 outputs.
 */
export function stepSurfaceMotionState(
  position: Vec3,
  direction: Vec3,
  angle: number
): { position: Vec3; direction: Vec3 } {
  const p = vec3ToThree(position);
  const d = vec3ToThree(direction);

  moveOnSphere(p, d, angle);

  return {
    position: normalizeVec3(threeToVec3(p)),
    direction: normalizeVec3(threeToVec3(d)),
  };
}
