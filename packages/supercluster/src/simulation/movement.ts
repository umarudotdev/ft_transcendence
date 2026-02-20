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

const EPS: number = 1e-8;
const WORLD_X_AXIS: Vec3Like = [1, 0, 0];
const WORLD_Y_AXIS: Vec3Like = [0, 1, 0];
const WORLD_Z_AXIS: Vec3Like = [0, 0, 1];

// Scratch buffers to avoid per-call allocations
const _POS: GlVec3  = GlVec3.create();   // position scratch
const _DIR: GlVec3  = GlVec3.create();   // direction scratch
const _QUAT: GlQuat = GlQuat.create();  // quaternion scratch
const _TAN: GlVec3  = GlVec3.create();   // tangent / forward direction scratch
const _AXIS: GlVec3  = GlVec3.create();  // rotation axis scratch
const _PROJ: GlVec3  = GlVec3.create();  // projection / orthogonalization scratch

export function normalizeVec3(
  out: Vec3Like,
  value: Vec3Like,
  fallback: Vec3Like = WORLD_Z_AXIS
): Vec3Like {
  if (GlVec3.squaredLength(value) <= EPS) {
    GlVec3.copy(out, fallback);
    return out;
  }
  GlVec3.normalize(out, value);
  return out;
}

export function randomUnitVec3(): Vec3Like {
  const theta: number = Math.random() * Math.PI * 2;
  const zAxis: number = Math.random() * 2 - 1;
  const radius: number = Math.sqrt(1 - zAxis * zAxis);
  return [radius * Math.cos(theta), radius * Math.sin(theta), zAxis];
}

export function randomTangentVec3(position: Vec3Like): Vec3Like {
  normalizeVec3(_PROJ, position);
  const random: Vec3Like = randomUnitVec3();
  // tangent = random - dot(random, p) * p
  const vDotP: number = GlVec3.dot(random, _PROJ);
  GlVec3.scale(_TAN, _PROJ, vDotP);
  GlVec3.sub(_TAN, random, _TAN);

  if (GlVec3.squaredLength(_TAN) <= EPS) {
    // Degenerate: random was parallel to p, use cross product fallback
    const fallbackAxis: Vec3Like =
      Math.abs(_PROJ[1]) < 0.99 ? WORLD_Y_AXIS : WORLD_X_AXIS;
    GlVec3.cross(_TAN, _PROJ, fallbackAxis);
  }

  GlVec3.normalize(_TAN, _TAN);
  return [_TAN[0], _TAN[1], _TAN[2]];
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
  const vDotP: number = GlVec3.dot(velocity, position);
  GlVec3.scale(_TAN, position, vDotP);
  GlVec3.sub(_TAN, velocity, _TAN); // _TAN = tangentVelocity

  if (GlVec3.squaredLength(_TAN) < EPS) return;
  GlVec3.normalize(_TAN, _TAN);

  // Rotation axis = perpendicular to position and velocity (great-circle motion)
  GlVec3.cross(_AXIS, position, _TAN); // _AXIS = axis
  if (GlVec3.squaredLength(_AXIS) < EPS) return;
  GlVec3.normalize(_AXIS, _AXIS);

  // Create rotation quaternion and apply
  GlQuat.setAxisAngle(_QUAT, _AXIS, angle);

  // Rotate position
  GlVec3.transformQuat(position, position, _QUAT);
  GlVec3.normalize(position, position);

  // Rotate velocity to stay tangent after movement
  GlVec3.transformQuat(_TAN, _TAN, _QUAT);
  GlVec3.normalize(_TAN, _TAN);
  GlVec3.copy(velocity, _TAN);
}

export interface ReferenceBasis {
  normal: Vec3Like;
  forward: Vec3Like;
  right: Vec3Like;
}

export interface ShipInputDelta {
  moved: boolean;
  axis: Vec3Like;
  angle: number;
  fallbackForward: Vec3Like;
}

export function resolveReferenceBasis(
  referencePosition: Vec3Like,
  referenceDirection: Vec3Like
): ReferenceBasis {
  normalizeVec3(_PROJ, referencePosition);
  const normal: Vec3Like = [_PROJ[0], _PROJ[1], _PROJ[2]];

  normalizeVec3(_TAN, referenceDirection, WORLD_Y_AXIS);
  const forwardDotNormal: number = GlVec3.dot(_TAN, _PROJ);
  GlVec3.scale(_AXIS, _PROJ, forwardDotNormal);
  GlVec3.sub(_TAN, _TAN, _AXIS);

  if (GlVec3.squaredLength(_TAN) <= EPS) {
    const fallbackAxis: Vec3Like = Math.abs(_PROJ[1]) < 0.99 ? WORLD_Y_AXIS : WORLD_X_AXIS;
    GlVec3.cross(_TAN, fallbackAxis, _PROJ);
    if (GlVec3.squaredLength(_TAN) <= EPS) {
      GlVec3.cross(_TAN, WORLD_Z_AXIS, _PROJ);
    }
  }
  GlVec3.normalize(_TAN, _TAN);
  const forward: Vec3Like = [_TAN[0], _TAN[1], _TAN[2]];

  GlVec3.cross(_AXIS, forward, _PROJ);
  if (GlVec3.squaredLength(_AXIS) <= EPS) {
    const fallbackAxis = Math.abs(_PROJ[1]) < 0.99 ? WORLD_Y_AXIS : WORLD_X_AXIS;
    GlVec3.cross(_AXIS, fallbackAxis, _PROJ);
  }
  GlVec3.normalize(_AXIS, _AXIS);
  const right: Vec3Like = [_AXIS[0], _AXIS[1], _AXIS[2]];

  return {
    normal,
    forward,
    right,
  };
}

export function computeShipInputDelta(
  keys: InputState,
  deltaTicks: number,
  speedRadPerTick: number,
  referencePosition: Vec3Like,
  referenceDirection: Vec3Like
): ShipInputDelta {
  const inputForward: number = (keys.forward ? 1 : 0) - (keys.backward ? 1 : 0);
  const inputRight: number = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  const stepAngle: number = speedRadPerTick * deltaTicks;

  const basis = resolveReferenceBasis(referencePosition, referenceDirection);
  if ((inputForward === 0 && inputRight === 0) || Math.abs(stepAngle) <= EPS) {
    return {
      moved: false,
      axis: WORLD_X_AXIS,
      angle: 0,
      fallbackForward: basis.forward,
    };
  }

  GlVec3.scale(_TAN, basis.forward, inputForward);
  GlVec3.scaleAndAdd(_TAN, _TAN, basis.right, inputRight);
  if (GlVec3.squaredLength(_TAN) <= EPS) {
    return {
      moved: false,
      axis: WORLD_X_AXIS,
      angle: 0,
      fallbackForward: basis.forward,
    };
  }
  GlVec3.normalize(_TAN, _TAN); // move direction on tangent plane

  GlVec3.cross(_AXIS, basis.normal, _TAN);
  if (GlVec3.squaredLength(_AXIS) <= EPS) {
    return {
      moved: false,
      axis: WORLD_X_AXIS,
      angle: 0,
      fallbackForward: basis.forward,
    };
  }
  GlVec3.normalize(_AXIS, _AXIS);

  return {
    moved: true,
    axis: [_AXIS[0], _AXIS[1], _AXIS[2]],
    angle: stepAngle,
    fallbackForward: basis.forward,
  };
}

export function applyShipInputDelta(
  position: Vec3Like,
  direction: Vec3Like,
  delta: ShipInputDelta
): { moved: boolean; position: Vec3Like; direction: Vec3Like } {
  GlVec3.copy(_POS, position);
  GlVec3.copy(_DIR, direction);

  if (delta.moved) {
    GlQuat.setAxisAngle(_QUAT, delta.axis, delta.angle);
    GlVec3.transformQuat(_POS, _POS, _QUAT);
    GlVec3.transformQuat(_DIR, _DIR, _QUAT);
  }

  normalizeVec3(_POS, _POS);
  normalizeVec3(_DIR, _DIR, delta.fallbackForward);

  // Project direction onto tangent plane of position
  const dirDotPos = GlVec3.dot(_DIR, _POS);
  GlVec3.scale(_PROJ, _POS, dirDotPos);
  GlVec3.sub(_PROJ, _DIR, _PROJ);
  if (GlVec3.squaredLength(_PROJ) <= EPS) {
    GlVec3.copy(_PROJ, delta.fallbackForward);
  }
  GlVec3.normalize(_PROJ, _PROJ);

  return {
    moved: delta.moved,
    position: [_POS[0], _POS[1], _POS[2]],
    direction: [_PROJ[0], _PROJ[1], _PROJ[2]],
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
  GlVec3.copy(_POS, position);
  GlVec3.copy(_DIR, direction);

  moveOnSphere(_POS, _DIR, angle);

  normalizeVec3(_POS, _POS);
  normalizeVec3(_DIR, _DIR);

  return {
    position: [_POS[0], _POS[1], _POS[2]],
    direction: [_DIR[0], _DIR[1], _DIR[2]],
  };
}
