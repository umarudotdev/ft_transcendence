import * as THREE from "three";

// ============================================================================
// Movement Module
// Great-circle motion on sphere surface
// Uses THREE.Vector3 math (works on both server and client)
// ============================================================================

const EPS = 1e-8;

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
// Coordinate Conversion
// ============================================================================

/**
 * Convert spherical coordinates to Cartesian unit vector
 * Uses standard physics convention:
 * - phi: polar angle from Y-axis (0 = north pole, PI = south pole)
 * - theta: azimuthal angle in XZ plane (0 = +Z, PI/2 = +X)
 *
 * @param phi - Polar angle (radians, 0 to PI)
 * @param theta - Azimuthal angle (radians, 0 to 2*PI)
 */
export function sphericalToCartesian(
  phi: number,
  theta: number
): THREE.Vector3 {
  return new THREE.Vector3(
    Math.sin(phi) * Math.sin(theta),
    Math.cos(phi),
    Math.sin(phi) * Math.cos(theta)
  );
}

/**
 * Convert Cartesian unit vector to spherical coordinates
 *
 * @param v - Unit vector (must be normalized)
 * @returns Object with phi (0 to PI) and theta (0 to 2*PI)
 */
export function cartesianToSpherical(v: THREE.Vector3): {
  phi: number;
  theta: number;
} {
  const phi = Math.acos(Math.max(-1, Math.min(1, v.y)));
  const theta = Math.atan2(v.x, v.z);
  return { phi, theta: theta < 0 ? theta + 2 * Math.PI : theta };
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

  // East direction (tangent toward increasing theta)
  let east = new THREE.Vector3().crossVectors(up, position);
  if (east.lengthSq() < EPS) {
    // At poles, use X axis as reference
    east = new THREE.Vector3(1, 0, 0);
  }
  east.normalize();

  // North direction (tangent toward decreasing phi)
  const north = new THREE.Vector3().crossVectors(position, east).normalize();

  // Combine based on angle
  return new THREE.Vector3()
    .addScaledVector(north, Math.cos(angle))
    .addScaledVector(east, Math.sin(angle))
    .normalize();
}
