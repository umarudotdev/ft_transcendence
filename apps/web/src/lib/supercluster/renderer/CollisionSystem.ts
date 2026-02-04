import type { GameConfig } from "@ft/supercluster";
import * as THREE from "three";

import type { AsteroidData, AsteroidRenderer } from "./Asteroid";
import type { BulletRenderer } from "./Bullet";

// ============================================================================
// Collision System
// Handles collision detection between game objects on sphere surface
// ============================================================================

export interface CollisionEvent {
  type: "bullet-asteroid" | "ship-asteroid";
  bulletId?: number;
  asteroidId: number;
}

export class CollisionSystem {
  private config: GameConfig;

  constructor(config: GameConfig) {
    this.config = config;
  }

  // ========================================================================
  // Update Config
  // ========================================================================
  updateConfig(config: GameConfig): void {
    this.config = config;
  }

  // ========================================================================
  // Collision Detection
  // ========================================================================

  /**
   * Check all bullet-asteroid collisions
   * Bullets are in world space, asteroids are in planet local space
   * @param planetQuaternion - Current rotation of planet to transform bullets
   * @returns Array of collision events
   */
  checkBulletAsteroidCollisions(
    bullets: BulletRenderer,
    asteroids: AsteroidRenderer,
    planetQuaternion: THREE.Quaternion
  ): CollisionEvent[] {
    const collisions: CollisionEvent[] = [];
    const bulletList = bullets.getBullets();
    const asteroidList = asteroids.getAsteroids();

    // Calculate inverse transform once (world → planet local)
    const worldToPlanet = planetQuaternion.clone().invert();

    // Brute force: check every bullet against every asteroid
    for (const bullet of bulletList) {
      // Transform bullet position from world space to planet local space
      const bulletLocalPos = bullet.position
        .clone()
        .applyQuaternion(worldToPlanet)
        .normalize();

      for (const asteroid of asteroidList) {
        if (this.checkPositionCollision(bulletLocalPos, asteroid)) {
          collisions.push({
            type: "bullet-asteroid",
            bulletId: bullet.id,
            asteroidId: asteroid.id,
          });
          // Bullet is destroyed on first hit, no need to check further
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
    const shipLocal = shipPosition.clone().applyQuaternion(worldToPlanet).normalize();

    // Ship collision radius (visual size ~3 units)
    const shipRadius = 3 / this.config.gameSphereRadius;

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
   * Check collision between a position (bullet in local space) and asteroid
   * Uses dot product for angular distance on sphere surface
   */
  private checkPositionCollision(
    bulletLocalPosition: THREE.Vector3,
    asteroid: AsteroidData
  ): boolean {
    // Calculate angular radii
    const bulletRadius = this.getBulletAngularRadius();
    const asteroidRadius = this.getAsteroidAngularRadius(asteroid);

    // Dot product gives us cos(angular distance)
    const dot = bulletLocalPosition.dot(asteroid.position);

    // Collision threshold = cos(sum of radii)
    // cos is decreasing, so collision when dot > threshold
    const threshold = Math.cos(bulletRadius + asteroidRadius);

    return dot > threshold;
  }

  // ========================================================================
  // Angular Radius Calculations
  // ========================================================================

  /**
   * Get bullet angular radius in radians
   * Bullets are small, so we use a fixed small radius
   */
  private getBulletAngularRadius(): number {
    // Bullet visual size is about 0.5 units wide
    const bulletVisualRadius = 1;
    const sphereRadius = this.config.gameSphereRadius;

    // For small angles: angular radius ≈ visual radius / sphere radius
    return bulletVisualRadius / sphereRadius;
  }

  /**
   * Get asteroid angular radius in radians based on its size
   */
  private getAsteroidAngularRadius(asteroid: AsteroidData): number {
    // SIZE_MULTIPLIERS are visual diameters: [2, 4, 6, 8]
    const SIZE_MULTIPLIERS = [2, 4, 6, 8];
    const visualDiameter = SIZE_MULTIPLIERS[asteroid.size - 1];
    const visualRadius = visualDiameter / 2;
    const sphereRadius = this.config.gameSphereRadius;

    // Add collision padding (1.3x = 30% larger hit area than visual)
    const collisionPadding = 1.3;
    const collisionRadius = visualRadius * collisionPadding;

    // For small angles: angular radius ≈ visual radius / sphere radius
    // For accurate calculation: Math.atan(visualRadius / sphereRadius)
    return collisionRadius / sphereRadius;
  }
}
