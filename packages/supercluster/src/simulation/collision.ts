import * as THREE from "three";

import {
  GAME_CONST,
  GAMEPLAY_CONST,
  getAsteroidCollisionRadius,
} from "../constants";

// ============================================================================
// Collision Detection Module
// Pure collision detection using angular distance on sphere surface
// Uses THREE.Vector3 math (works on both server and client)
// ============================================================================

export interface CollisionResult {
  collides: boolean;
  angularDistance: number; // For debugging/visualization
}

// ============================================================================
// Core Collision Detection
// ============================================================================

/**
 * Check if two positions on a sphere surface are colliding
 * Uses dot product: dot(p1, p2) = cos(angular_distance)
 * Collision when: dot > cos(r1 + r2)
 *
 * @param pos1 - First position as unit vector
 * @param pos2 - Second position as unit vector
 * @param radius1 - Angular radius of first object (radians)
 * @param radius2 - Angular radius of second object (radians)
 */
export function checkSphereCollision(
  pos1: THREE.Vector3,
  pos2: THREE.Vector3,
  radius1: number,
  radius2: number
): CollisionResult {
  const dot = pos1.dot(pos2);
  const threshold = Math.cos(radius1 + radius2);
  return {
    collides: dot > threshold,
    angularDistance: Math.acos(Math.max(-1, Math.min(1, dot))),
  };
}

/**
 * Quick collision check without creating result object
 * For performance when you only need boolean result
 */
export function checkSphereCollisionFast(
  pos1: THREE.Vector3,
  pos2: THREE.Vector3,
  radius1: number,
  radius2: number
): boolean {
  const dot = pos1.dot(pos2);
  const threshold = Math.cos(radius1 + radius2);
  return dot > threshold;
}

// ============================================================================
// Angular Radius Helpers
// Convert visual/physics radii to angular radii on sphere surface
// ============================================================================

/**
 * Get angular radius for a projectile
 */
export function getProjectileAngularRadius(): number {
  return GAMEPLAY_CONST.PROJECTILE_RADIUS / GAME_CONST.SPHERE_RADIUS;
}

/**
 * Get angular radius for ship
 */
export function getShipAngularRadius(): number {
  return GAMEPLAY_CONST.SHIP_RADIUS / GAME_CONST.SPHERE_RADIUS;
}

/**
 * Get angular radius for asteroid (with collision padding)
 * @param size - Asteroid size (1-4)
 */
export function getAsteroidAngularRadius(size: 1 | 2 | 3 | 4): number {
  return getAsteroidCollisionRadius(size) / GAME_CONST.SPHERE_RADIUS;
}

/**
 * Get angular radius for asteroid with bounds checking
 * Safe version that handles out-of-range sizes
 * @param size - Asteroid size (may be out of range)
 */
export function getAsteroidAngularRadiusSafe(size: number): number {
  const clampedSize = Math.max(1, Math.min(4, size)) as 1 | 2 | 3 | 4;
  return getAsteroidAngularRadius(clampedSize);
}
