import * as THREE from "three";
import type { InputState } from "../types";

// ============================================================================
// Movement Module
// Great-circle motion on sphere surface
// Uses THREE.Vector3 math (works on both server and client)
// ============================================================================

const EPS = 1e-8;
const WORLD_X_AXIS = new THREE.Vector3(1, 0, 0);
const WORLD_Y_AXIS = new THREE.Vector3(0, 1, 0);

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
  if (angle === 0) return;

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
 * Move a position without updating velocity direction
 * Use when velocity direction should remain constant in world space
 *
 * @param position - Current position (unit vector, MUTATED)
 * @param velocity - Movement direction (unit vector tangent to sphere)
 * @param angle - Angular distance to move (radians)
 */
export function moveOnSphereStraight(
  position: THREE.Vector3,
  velocity: THREE.Vector3,
  angle: number
): void {
  if (angle === 0) return;

  // Reproject velocity onto tangent plane
  const tangentVelocity = velocity
    .clone()
    .sub(position.clone().multiplyScalar(velocity.dot(position)));

  if (tangentVelocity.lengthSq() < EPS) return;
  tangentVelocity.normalize();

  // Rotation axis
  const axis = new THREE.Vector3().crossVectors(position, tangentVelocity);
  if (axis.lengthSq() < EPS) return;
  axis.normalize();

  // Rotate position only
  const quat = new THREE.Quaternion().setFromAxisAngle(axis, angle);
  position.applyQuaternion(quat).normalize();
}

// ============================================================================
// Direction Calculation
// ============================================================================

/**
 * Calculate tangent direction from an angle on the sphere surface
 * Used for ship aim direction, projectile direction, etc.
 *
 * @param position - Position on sphere (unit vector)
 * @param angle - Direction angle in tangent plane (radians)
 * @returns Unit vector tangent to sphere at position
 */
export function getTangentDirection(
  position: THREE.Vector3,
  angle: number
): THREE.Vector3 {
  // Calculate local basis vectors at position
  const up = new THREE.Vector3(0, 1, 0);

  // First tangent basis axis from world-up and local normal.
  let east = new THREE.Vector3().crossVectors(up, position);
  if (east.lengthSq() < EPS) {
    // At poles, use X axis as reference
    east = new THREE.Vector3(1, 0, 0);
  }
  east.normalize();

  // Second tangent basis axis orthogonal to both normal and east.
  const north = new THREE.Vector3().crossVectors(position, east).normalize();

  // Combine based on angle
  return new THREE.Vector3()
    .addScaledVector(north, Math.cos(angle))
    .addScaledVector(east, Math.sin(angle))
    .normalize();
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
