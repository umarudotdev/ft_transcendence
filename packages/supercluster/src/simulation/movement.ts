import { Quat, Vec3, type Vec3Like } from "gl-matrix";

import type { InputState } from "../types";

import { EPS, WORLD_X_AXIS, WORLD_Y_AXIS, _q1 } from "./shared";

// Scratch Vec3 buffers to avoid per-call allocations
const _v1 = Vec3.create();
const _v2 = Vec3.create();

export function normalizeVec3(
  value: Vec3Like,
  fallback: Vec3Like = [0, 0, 1]
): Vec3Like {
  if (Vec3.squaredLength(value) <= EPS) {
    return [...fallback] as Vec3Like;
  }
  Vec3.normalize(_v1, value);
  return [..._v1] as Vec3Like;
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
  const d = Vec3.dot(random, p);
  Vec3.scale(_v1, p, d);
  Vec3.sub(_v1, random, _v1);

  if (Vec3.squaredLength(_v1) <= EPS) {
    // Degenerate: random was parallel to p, use cross product fallback
    const fallbackAxis: Vec3Like =
      Math.abs(p[1]) < 0.99 ? [0, 1, 0] : [1, 0, 0];
    Vec3.cross(_v1, p, fallbackAxis);
  }

  Vec3.normalize(_v1, _v1);
  return [..._v1] as Vec3Like;
}

/**
 * Move a position along sphere surface in a direction (great-circle motion).
 * Mutates position and velocity arrays in place for performance.
 */
export function moveOnSphere(
  position: Vec3Like,
  velocity: Vec3Like,
  angle: number
): void {
  if (Math.abs(angle) <= EPS) return;

  // Reproject velocity onto tangent plane to prevent radial drift
  const vDotP = Vec3.dot(velocity, position);
  Vec3.scale(_v1, position, vDotP);
  Vec3.sub(_v1, velocity, _v1);

  if (Vec3.squaredLength(_v1) < EPS) return;
  Vec3.normalize(_v1, _v1);

  // Rotation axis = perpendicular to position and velocity (great-circle motion)
  Vec3.cross(_v2, position, _v1);
  if (Vec3.squaredLength(_v2) < EPS) return;
  Vec3.normalize(_v2, _v2);

  Quat.setAxisAngle(_q1, _v2, angle);

  Vec3.transformQuat(position, position, _q1);
  Vec3.normalize(position, position);

  Vec3.transformQuat(_v1, _v1, _q1);
  Vec3.normalize(_v1, _v1);
  velocity[0] = _v1[0];
  velocity[1] = _v1[1];
  velocity[2] = _v1[2];
}

/**
 * Data-oriented sphere motion step for entities with position+direction.
 * Returns new position/direction after great-circle motion.
 * moveOnSphere already normalizes both outputs, so no extra normalization needed.
 */
export function stepSurfaceMotionState(
  position: Vec3Like,
  direction: Vec3Like,
  angle: number
): { position: Vec3Like; direction: Vec3Like } {
  const p = [...position] as Vec3Like;
  const d = [...direction] as Vec3Like;

  moveOnSphere(p, d, angle);

  return { position: p, direction: d };
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
      position: [...position] as Vec3Like,
      direction: [...direction] as Vec3Like,
    };
  }

  const pos = [...position] as Vec3Like;
  const dir = [...direction] as Vec3Like;

  if (Math.abs(pitchAngle) > EPS) {
    Quat.setAxisAngle(_q1, WORLD_X_AXIS, pitchAngle);
    Vec3.transformQuat(pos, pos, _q1);
    Vec3.transformQuat(dir, dir, _q1);
  }

  if (Math.abs(yawAngle) > EPS) {
    Quat.setAxisAngle(_q1, WORLD_Y_AXIS, yawAngle);
    Vec3.transformQuat(pos, pos, _q1);
    Vec3.transformQuat(dir, dir, _q1);
  }

  return {
    moved: true,
    position: [...pos] as Vec3Like,
    direction: [...dir] as Vec3Like,
  };
}
