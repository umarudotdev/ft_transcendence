import {
  Vec3 as GlVec3,
  Quat as GlQuat,
  type Vec3Like,
  type QuatLike,
} from "gl-matrix";

import type { InputState } from "../types";

// ============================================================================
// Movement Module
// Great-circle motion on sphere surface
// Uses gl-matrix v4 math (works on both server and client)
// ============================================================================

const EPS = 1e-8;
const WORLD_X_AXIS: Vec3Like = [1, 0, 0];
const WORLD_Y_AXIS: Vec3Like = [0, 1, 0];

// Scratch buffers to avoid per-call allocations
const _v1 = GlVec3.create();
const _v2 = GlVec3.create();
const _q1 = GlQuat.create();

export function normalizeVec3(
  value: Vec3Like,
  fallback: Vec3Like = [0, 0, 1]
): Vec3Like {
  if (GlVec3.squaredLength(value) <= EPS) {
    return [fallback[0], fallback[1], fallback[2]];
  }
  GlVec3.normalize(_v1, value);
  return [_v1[0], _v1[1], _v1[2]];
}

export function randomUnitVec3(): Vec3Like {
  // Uniformly distributed unit vector via spherical coordinates
  const theta = Math.random() * Math.PI * 2;
  const z = Math.random() * 2 - 1;
  const r = Math.sqrt(1 - z * z);
  return [r * Math.cos(theta), r * Math.sin(theta), z];
}

export function randomTangentVec3(position: Vec3Like): Vec3Like {
  const p = normalizeVec3(position);

  // Random direction, then project onto tangent plane of p
  const random = randomUnitVec3();
  // tangent = random - dot(random, p) * p
  const d = GlVec3.dot(random, p);
  GlVec3.scale(_v1, p, d);
  GlVec3.sub(_v1, random, _v1);

  if (GlVec3.squaredLength(_v1) <= EPS) {
    // Degenerate: random was parallel to p, use cross product fallback
    const fallbackAxis: Vec3Like =
      Math.abs(p[1]) < 0.99 ? [0, 1, 0] : [1, 0, 0];
    GlVec3.cross(_v1, p, fallbackAxis);
  }

  GlVec3.normalize(_v1, _v1);
  return [_v1[0], _v1[1], _v1[2]];
}

// ============================================================================
// Sphere Surface Movement
// ============================================================================

/**
 * Move a position along sphere surface in a direction (great-circle motion)
 * Mutates position and velocity arrays in place for performance.
 *
 * @param position - Current position (unit vector, MUTATED)
 * @param velocity - Movement direction (unit vector tangent to sphere, MUTATED)
 * @param angle - Angular distance to move (radians)
 */
export function moveOnSphere(
  position: Vec3Like,
  velocity: Vec3Like,
  angle: number
): void {
  if (Math.abs(angle) <= EPS) return;

  // Reproject velocity onto tangent plane to prevent radial drift
  // tangentVelocity = velocity - dot(velocity, position) * position
  const vDotP = GlVec3.dot(velocity, position);
  GlVec3.scale(_v1, position, vDotP);
  GlVec3.sub(_v1, velocity, _v1); // _v1 = tangentVelocity

  if (GlVec3.squaredLength(_v1) < EPS) return;
  GlVec3.normalize(_v1, _v1);

  // Rotation axis = perpendicular to position and velocity (great-circle motion)
  GlVec3.cross(_v2, position, _v1); // _v2 = axis
  if (GlVec3.squaredLength(_v2) < EPS) return;
  GlVec3.normalize(_v2, _v2);

  // Create rotation quaternion and apply
  GlQuat.setAxisAngle(_q1, _v2, angle);

  // Rotate position
  GlVec3.transformQuat(position, position, _q1);
  GlVec3.normalize(position, position);

  // Rotate velocity to stay tangent after movement
  GlVec3.transformQuat(_v1, _v1, _q1);
  GlVec3.normalize(_v1, _v1);
  velocity[0] = _v1[0];
  velocity[1] = _v1[1];
  velocity[2] = _v1[2];
}

/**
 * Shared ship movement step on sphere using quaternion integration.
 *
 * Mutates `planetQuaternion` and `shipPosition` in place.
 *
 * @param planetQuaternion - World rotation accumulator (MUTATED)
 * @param shipPosition - Unit vector ship position on sphere (MUTATED)
 * @param keys - Movement input snapshot
 * @param deltaTicks - Simulation delta in ticks
 * @param speedRadPerTick - Ship movement speed in rad/tick
 * @returns true when movement was applied
 */
export function stepShipOnSphere(
  planetQuaternion: QuatLike,
  shipPosition: Vec3Like,
  keys: InputState,
  deltaTicks: number,
  speedRadPerTick: number
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
    GlQuat.setAxisAngle(_q1, WORLD_X_AXIS, pitchAngle);
    // premultiply: planetQuaternion = _q1 * planetQuaternion
    GlQuat.multiply(planetQuaternion, _q1, planetQuaternion);

    // Ship moves opposite to planet rotation.
    GlQuat.invert(_q1, _q1);
    GlVec3.transformQuat(shipPosition, shipPosition, _q1);
    moved = true;
  }

  // Yaw: rotate around Y axis.
  if (Math.abs(yawAngle) > EPS) {
    GlQuat.setAxisAngle(_q1, WORLD_Y_AXIS, yawAngle);
    GlQuat.multiply(planetQuaternion, _q1, planetQuaternion);

    GlQuat.invert(_q1, _q1);
    GlVec3.transformQuat(shipPosition, shipPosition, _q1);
    moved = true;
  }

  if (moved) {
    GlQuat.normalize(planetQuaternion, planetQuaternion);
    GlVec3.normalize(shipPosition, shipPosition);
  }

  return moved;
}

/**
 * Data-oriented sphere motion step for entities with position+direction.
 * Uses shared great-circle motion and returns normalized outputs.
 */
export function stepSurfaceMotionState(
  position: Vec3Like,
  direction: Vec3Like,
  angle: number
): { position: Vec3Like; direction: Vec3Like } {
  const p: Vec3Like = [position[0], position[1], position[2]];
  const d: Vec3Like = [direction[0], direction[1], direction[2]];

  moveOnSphere(p, d, angle);

  return {
    position: normalizeVec3(p),
    direction: normalizeVec3(d),
  };
}

/**
 * Apply inverse ship input transform to an entity in ship-centric simulation.
 * This moves world entities relative to fixed ship anchor.
 *
 * Note: keeps position radius magnitude (does not normalize position).
 */
export function applyInverseShipInputTransform(
  position: Vec3Like,
  direction: Vec3Like,
  keys: InputState,
  deltaTicks: number,
  speedRadPerTick: number
): { moved: boolean; position: Vec3Like; direction: Vec3Like } {
  let pitchAngle = 0;
  let yawAngle = 0;

  if (keys.forward) pitchAngle += speedRadPerTick * deltaTicks;
  if (keys.backward) pitchAngle -= speedRadPerTick * deltaTicks;
  if (keys.left) yawAngle += speedRadPerTick * deltaTicks;
  if (keys.right) yawAngle -= speedRadPerTick * deltaTicks;

  if (Math.abs(pitchAngle) <= EPS && Math.abs(yawAngle) <= EPS) {
    return {
      moved: false,
      position: [position[0], position[1], position[2]],
      direction: normalizeVec3(direction),
    };
  }

  const pos: Vec3Like = [position[0], position[1], position[2]];
  const dir = normalizeVec3(direction);

  if (Math.abs(pitchAngle) > EPS) {
    GlQuat.setAxisAngle(_q1, WORLD_X_AXIS, pitchAngle);
    GlVec3.transformQuat(pos, pos, _q1);
    GlVec3.transformQuat(dir, dir, _q1);
  }

  if (Math.abs(yawAngle) > EPS) {
    GlQuat.setAxisAngle(_q1, WORLD_Y_AXIS, yawAngle);
    GlVec3.transformQuat(pos, pos, _q1);
    GlVec3.transformQuat(dir, dir, _q1);
  }

  return {
    moved: true,
    position: [pos[0], pos[1], pos[2]],
    direction: normalizeVec3(dir),
  };
}
