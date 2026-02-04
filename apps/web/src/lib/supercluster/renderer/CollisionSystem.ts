import type { GameConfig } from "@ft/supercluster";

import type { AsteroidData, AsteroidRenderer } from "./Asteroid";
import type { BulletData, BulletRenderer } from "./Bullet";

// ============================================================================
// Collision System
// Handles collision detection between game objects on sphere surface
// ============================================================================

export interface CollisionEvent {
  type: "bullet-asteroid";
  bulletId: number;
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
   * Both bullets and asteroids are in planet local space, so no transformation needed
   * @returns Array of collision events
   */
  checkBulletAsteroidCollisions(
    bullets: BulletRenderer,
    asteroids: AsteroidRenderer
  ): CollisionEvent[] {
    const collisions: CollisionEvent[] = [];
    const bulletList = bullets.getBullets();
    const asteroidList = asteroids.getAsteroids();

    // Brute force: check every bullet against every asteroid
    for (const bullet of bulletList) {
      for (const asteroid of asteroidList) {
        if (this.checkBulletAsteroidCollision(bullet, asteroid)) {
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
   * Check collision between a single bullet and asteroid
   * Uses dot product for angular distance on sphere surface
   */
  private checkBulletAsteroidCollision(
    bullet: BulletData,
    asteroid: AsteroidData
  ): boolean {
    // Calculate angular radii
    const bulletRadius = this.getBulletAngularRadius();
    const asteroidRadius = this.getAsteroidAngularRadius(asteroid);

    // Dot product gives us cos(angular distance)
    const dot = bullet.position.dot(asteroid.position);

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

    // For small angles: angular radius ≈ visual radius / sphere radius
    // For accurate calculation: Math.atan(visualRadius / sphereRadius)
    return visualRadius / sphereRadius;
  }
}
