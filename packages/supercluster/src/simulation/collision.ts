import { Vec3 } from "gl-matrix";

import type { AsteroidState, ProjectileState, ShipState } from "../types";

import {
  GAME_CONST,
  GAMEPLAY_CONST,
  getAsteroidCollisionRadius,
} from "../constants";

export interface ProjectileAsteroidHit {
  projectileId: number;
  asteroidId: number;
}

export interface ProjectileAsteroidCollisionEvent {
  type: "asteroid_damaged" | "projectile_consumed";
  asteroidId?: number;
  projectileId?: number;
  points?: number;
}

export interface ProjectileAsteroidCollisionResolution {
  projectiles: ProjectileState[];
  asteroids: AsteroidState[];
  events: ProjectileAsteroidCollisionEvent[];
}

const PROJECTILE_ANGULAR_RADIUS =
  GAMEPLAY_CONST.PROJECTILE_RADIUS / GAME_CONST.SPHERE_RADIUS;
const SHIP_ANGULAR_RADIUS =
  GAMEPLAY_CONST.SHIP_RADIUS / GAME_CONST.SPHERE_RADIUS;

/** Get angular radius for asteroid (with bounds checking and collision padding) */
export function getAsteroidAngularRadius(size: number): number {
  const clampedSize = Math.max(1, Math.min(4, size)) as 1 | 2 | 3 | 4;
  return getAsteroidCollisionRadius(clampedSize) / GAME_CONST.SPHERE_RADIUS;
}

export function findProjectileAsteroidHits(
  projectiles: readonly ProjectileState[],
  asteroids: readonly AsteroidState[]
): ProjectileAsteroidHit[] {
  if (projectiles.length === 0 || asteroids.length === 0) return [];

  const hits: ProjectileAsteroidHit[] = [];

  for (const projectile of projectiles) {
    const projectilePos = projectile.position;
    for (const asteroid of asteroids) {
      const asteroidPos = asteroid.position;
      const asteroidRadius = getAsteroidAngularRadius(asteroid.size);
      const threshold = Math.cos(PROJECTILE_ANGULAR_RADIUS + asteroidRadius);
      if (Vec3.dot(projectilePos, asteroidPos) > threshold) {
        hits.push({ projectileId: projectile.id, asteroidId: asteroid.id });
        break;
      }
    }
  }

  return hits;
}

/**
 * Resolve projectile-vs-asteroid collisions as a pure state transition.
 * Consumes projectile hits, applies asteroid damage gates/timers,
 * and returns typed gameplay events for runtime side effects.
 */
export function resolveProjectileAsteroidCollisions(
  projectiles: readonly ProjectileState[],
  asteroids: readonly AsteroidState[],
  hitDelayTicks: number,
  pointsPerDamage: number = 10
): ProjectileAsteroidCollisionResolution {
  const hits: ProjectileAsteroidHit[] = findProjectileAsteroidHits(
    projectiles,
    asteroids
  );
  if (hits.length === 0) {
    return {
      projectiles: [...projectiles],
      asteroids: [...asteroids],
      events: [],
    };
  }

  const consumedProjectileIds = new Set<number>();
  const asteroidHitIds = new Set<number>();
  for (const hit of hits) {
    consumedProjectileIds.add(hit.projectileId);
    asteroidHitIds.add(hit.asteroidId);
  }

  const events: ProjectileAsteroidCollisionEvent[] = [];
  for (const projectileId of consumedProjectileIds) {
    events.push({
      type: "projectile_consumed",
      projectileId,
    });
  }

  const nextProjectiles: ProjectileState[] = projectiles.filter(
    (projectile) => !consumedProjectileIds.has(projectile.id)
  );

  const nextAsteroids: AsteroidState[] = asteroids.map((asteroid) => {
    if (!asteroidHitIds.has(asteroid.id)) return asteroid;
    if (!asteroid.canTakeDamage) return asteroid;

    const nextHealth = Math.max(asteroid.health - 1, 0);
    events.push({
      type: "asteroid_damaged",
      asteroidId: asteroid.id,
      points: pointsPerDamage,
    });

    return {
      ...asteroid,
      health: nextHealth,
      canTakeDamage: false,
      isHit: true,
      hitTimer: Math.max(1, hitDelayTicks),
    };
  });

  return {
    projectiles: nextProjectiles,
    asteroids: nextAsteroids,
    events,
  };
}

export function findShipAsteroidHit(
  ship: ShipState,
  asteroids: readonly AsteroidState[]
): number | null {
  if (asteroids.length === 0) return null;
  const shipPos = ship.position;

  for (const asteroid of asteroids) {
    const asteroidPos = asteroid.position;
    const asteroidRadius = getAsteroidAngularRadius(asteroid.size);
    const threshold = Math.cos(SHIP_ANGULAR_RADIUS + asteroidRadius);
    if (Vec3.dot(shipPos, asteroidPos) > threshold) {
      return asteroid.id;
    }
  }

  return null;
}
