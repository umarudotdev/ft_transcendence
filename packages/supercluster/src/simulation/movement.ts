import {
  Vec3 as GlVec3,
  Quat as GlQuat,
  type Vec3Like,
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
const WORLD_Z_AXIS: Vec3Like = [0, 0, 1];

// Scratch buffers to avoid per-call allocations
const _v1 = GlVec3.create();
const _v2 = GlVec3.create();
const _v3 = GlVec3.create();
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

export interface ReferenceBasis {
  normal: Vec3Like;
  forward: Vec3Like;
  right: Vec3Like;
}

export function resolveReferenceBasis(
  referencePosition: Vec3Like,
  referenceDirection: Vec3Like
): ReferenceBasis {
  const normal = normalizeVec3(referencePosition);

  const forwardRaw = normalizeVec3(referenceDirection, WORLD_Y_AXIS);
  const forwardDotNormal = GlVec3.dot(forwardRaw, normal);
  GlVec3.scale(_v1, normal, forwardDotNormal);
  GlVec3.sub(_v1, forwardRaw, _v1);

  if (GlVec3.squaredLength(_v1) <= EPS) {
    const fallbackAxis = Math.abs(normal[1]) < 0.99 ? WORLD_Y_AXIS : WORLD_X_AXIS;
    GlVec3.cross(_v1, fallbackAxis, normal);
    if (GlVec3.squaredLength(_v1) <= EPS) {
      GlVec3.cross(_v1, WORLD_Z_AXIS, normal);
    }
  }
  GlVec3.normalize(_v1, _v1);
  const forward: Vec3Like = [_v1[0], _v1[1], _v1[2]];

  GlVec3.cross(_v2, forward, normal);
  if (GlVec3.squaredLength(_v2) <= EPS) {
    const fallbackAxis = Math.abs(normal[1]) < 0.99 ? WORLD_Y_AXIS : WORLD_X_AXIS;
    GlVec3.cross(_v2, fallbackAxis, normal);
  }
  GlVec3.normalize(_v2, _v2);
  const right: Vec3Like = [_v2[0], _v2[1], _v2[2]];

  return {
    normal,
    forward,
    right,
  };
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

export function applyShipInputTransformRelativeToReference(
  position: Vec3Like,
  direction: Vec3Like,
  keys: InputState,
  deltaTicks: number,
  speedRadPerTick: number,
  referencePosition: Vec3Like,
  referenceDirection: Vec3Like
): { moved: boolean; position: Vec3Like; direction: Vec3Like } {
  const inputForward = (keys.forward ? 1 : 0) - (keys.backward ? 1 : 0);
  const inputRight = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  const stepAngle = speedRadPerTick * deltaTicks;

  if ((inputForward === 0 && inputRight === 0) || Math.abs(stepAngle) <= EPS) {
    return {
      moved: false,
      position: normalizeVec3(position),
      direction: normalizeVec3(direction),
    };
  }

  const basis = resolveReferenceBasis(referencePosition, referenceDirection);

  GlVec3.scale(_v1, basis.forward, inputForward);
  GlVec3.scaleAndAdd(_v1, _v1, basis.right, inputRight);
  if (GlVec3.squaredLength(_v1) <= EPS) {
    return {
      moved: false,
      position: normalizeVec3(position),
      direction: normalizeVec3(direction),
    };
  }
  GlVec3.normalize(_v1, _v1); // move direction on tangent plane

  GlVec3.cross(_v2, basis.normal, _v1);
  if (GlVec3.squaredLength(_v2) <= EPS) {
    return {
      moved: false,
      position: normalizeVec3(position),
      direction: normalizeVec3(direction),
    };
  }
  GlVec3.normalize(_v2, _v2);

  GlQuat.setAxisAngle(_q1, _v2, stepAngle);

  const pos: Vec3Like = [position[0], position[1], position[2]];
  const dir: Vec3Like = [direction[0], direction[1], direction[2]];
  GlVec3.transformQuat(pos, pos, _q1);
  GlVec3.transformQuat(dir, dir, _q1);
  GlVec3.normalize(pos, pos);

  const posNorm = normalizeVec3(pos);
  const dirNorm = normalizeVec3(dir, basis.forward);
  const dirDotPos = GlVec3.dot(dirNorm, posNorm);
  GlVec3.scale(_v3, posNorm, dirDotPos);
  GlVec3.sub(_v3, dirNorm, _v3);
  if (GlVec3.squaredLength(_v3) <= EPS) {
    GlVec3.copy(_v3, basis.forward);
  }
  GlVec3.normalize(_v3, _v3);

  return {
    moved: true,
    position: [pos[0], pos[1], pos[2]],
    direction: [_v3[0], _v3[1], _v3[2]],
  };
}

export function applyShipInputTransform(
  position: Vec3Like,
  direction: Vec3Like,
  keys: InputState,
  deltaTicks: number,
  speedRadPerTick: number
): { moved: boolean; position: Vec3Like; direction: Vec3Like } {
  return applyShipInputTransformRelativeToReference(
    position,
    direction,
    keys,
    deltaTicks,
    speedRadPerTick,
    position,
    direction
  );
}
