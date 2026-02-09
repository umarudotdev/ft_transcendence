import { GAME_CONST, GAMEPLAY_CONST } from "@ft/supercluster";
import * as THREE from "three";

import type { AsteroidData, AsteroidRenderer } from "./Asteroid";
import type { ProjectileRenderer } from "./Projectile";

// ============================================================================
// Collision System
// Handles collision detection between game objects on sphere surface
// Uses GAME_CONST for physics constants (immutable)
// ============================================================================

export interface CollisionEvent {
  type: "projectile-asteroid" | "ship-asteroid";
  projectileId?: number;
  asteroidId: number;
}

export class CollisionSystem {
  constructor() {
    // No config needed - uses GAME_CONST directly
  }

  // ========================================================================
  // Collision Detection
  // ========================================================================

  /**
   * Check all projectile-asteroid collisions
   * Projectiles are in world space, asteroids are in planet local space
   * @param planetQuaternion - Current rotation of planet to transform projectiles
   * @returns Array of collision events
   */
  checkProjectileAsteroidCollisions(
    projectiles: ProjectileRenderer,
    asteroids: AsteroidRenderer,
    planetQuaternion: THREE.Quaternion
  ): CollisionEvent[] {
    const collisions: CollisionEvent[] = [];
    const projectileList = projectiles.getProjectiles();
    const asteroidList = asteroids.getAsteroids();

    // Calculate inverse transform once (world → planet local)
    const worldToPlanet = planetQuaternion.clone().invert();

    // Brute force: check every projectile against every asteroid
    for (const projectile of projectileList) {
      // Transform projectile position from world space to planet local space
      const projectileLocalPos = projectile.position
        .clone()
        .applyQuaternion(worldToPlanet)
        .normalize();

      for (const asteroid of asteroidList) {
        if (this.checkPositionCollision(projectileLocalPos, asteroid)) {
          collisions.push({
            type: "projectile-asteroid",
            projectileId: projectile.id,
            asteroidId: asteroid.id,
          });
          // Projectile is destroyed on first hit, no need to check further
          break;
        }
      }
    }

    return collisions;
  }

  /**
   * Check ship-asteroid collisions
   * Ship is in world space, asteroids are in planet local space
   * @param shipPosition - Ship position in world space (unit vector)
   * @param planetQuaternion - Current rotation of planet to transform ship
   * @returns Array of collision events (first collision only)
   */
  checkShipAsteroidCollisions(
    shipPosition: THREE.Vector3,
    asteroids: AsteroidRenderer,
    planetQuaternion: THREE.Quaternion
  ): CollisionEvent[] {
    const collisions: CollisionEvent[] = [];
    const asteroidList = asteroids.getAsteroids();

    // Transform ship from world space to planet local space
    const worldToPlanet = planetQuaternion.clone().invert();
    const shipLocal = shipPosition
      .clone()
      .applyQuaternion(worldToPlanet)
      .normalize();

    // Ship collision radius
    const shipRadius = GAMEPLAY_CONST.SHIP_RADIUS / GAME_CONST.SPHERE_RADIUS;

    // Check ship against all asteroids
    for (const asteroid of asteroidList) {
      const asteroidRadius = this.getAsteroidAngularRadius(asteroid);
      const dot = shipLocal.dot(asteroid.position);
      const threshold = Math.cos(shipRadius + asteroidRadius);

      if (dot > threshold) {
        collisions.push({
          type: "ship-asteroid",
          asteroidId: asteroid.id,
        });
        // Ship can only hit one asteroid per frame
        break;
      }
    }

    return collisions;
  }

  /**
   * Check collision between a position (projectile in local space) and asteroid
   * Uses dot product for angular distance on sphere surface
   */
  private checkPositionCollision(
    projectileLocalPosition: THREE.Vector3,
    asteroid: AsteroidData
  ): boolean {
    // Calculate angular radii
    const projectileRadius = this.getProjectileAngularRadius();
    const asteroidRadius = this.getAsteroidAngularRadius(asteroid);

    // Dot product gives us cos(angular distance)
    const dot = projectileLocalPosition.dot(asteroid.position);

    // Collision threshold = cos(sum of radii)
    // cos is decreasing, so collision when dot > threshold
    const threshold = Math.cos(projectileRadius + asteroidRadius);

    return dot > threshold;
  }

  // ========================================================================
  // Angular Radius Calculations
  // ========================================================================

  /**
   * Get projectile angular radius in radians
   * Projectiles are small, so we use a fixed small radius
   */
  private getProjectileAngularRadius(): number {
    // For small angles: angular radius ≈ visual radius / sphere radius
    return GAMEPLAY_CONST.PROJECTILE_RADIUS / GAME_CONST.SPHERE_RADIUS;
  }

  /**
   * Get asteroid angular radius in radians based on its size
   */
  private getAsteroidAngularRadius(asteroid: AsteroidData): number {
    // Get diameter from constants (sizes 1-4 map to indices 0-3)
    const visualDiameter = GAMEPLAY_CONST.ASTEROID_DIAM[asteroid.size - 1];
    const visualRadius = visualDiameter / 2;

    // Add collision padding for forgiving collisions
    const collisionRadius = visualRadius * GAMEPLAY_CONST.ASTEROID_PADDING;

    // For small angles: angular radius ≈ visual radius / sphere radius
    return collisionRadius / GAME_CONST.SPHERE_RADIUS;
  }
}
