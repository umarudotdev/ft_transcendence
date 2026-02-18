import type { AsteroidState } from "../types";

import { GAME_CONST } from "../constants";
import {
  normalizeVec3,
  randomTangentVec3,
  randomUnitVec3,
  stepSurfaceMotionState,
} from "./movement";

function clampAsteroidSize(size: number): AsteroidState["size"] {
  if (size <= 1) return 1;
  if (size >= 4) return 4;
  return Math.round(size) as AsteroidState["size"];
}

export function createRandomAsteroidState(
  id: number,
  size: number
): AsteroidState {
  const position = randomUnitVec3();
  const direction = randomTangentVec3(position);
  const asteroidSize = clampAsteroidSize(size);
  const moveSpeed =
    GAME_CONST.ASTEROID_SPEED_MIN +
    Math.random() *
      (GAME_CONST.ASTEROID_SPEED_MAX - GAME_CONST.ASTEROID_SPEED_MIN);

  return {
    id,
    position,
    direction,
    moveSpeed,
    size: asteroidSize,
    health: 2 * asteroidSize,
    canTakeDamage: true,
    isHit: false,
    hitTimer: 0,
  };
}

export function createAsteroidWave(
  nextAsteroidId: number,
  sizes: readonly number[]
): { asteroids: AsteroidState[]; nextAsteroidId: number } {
  const asteroids: AsteroidState[] = [];
  for (const size of sizes) {
    asteroids.push(createRandomAsteroidState(nextAsteroidId++, size));
  }
  return { asteroids, nextAsteroidId };
}

export function stepAsteroids(
  asteroids: readonly AsteroidState[],
  deltaTicks: number
): AsteroidState[] {
  if (asteroids.length === 0) return [];

  const stepped: AsteroidState[] = [];
  for (const asteroid of asteroids) {
    const motion = stepSurfaceMotionState(
      asteroid.position,
      asteroid.direction,
      asteroid.moveSpeed * deltaTicks
    );

    stepped.push({
      ...asteroid,
      position: normalizeVec3(motion.position),
      direction: normalizeVec3(motion.direction),
    });
  }

  return stepped;
}

export function createAsteroidFragments(
  parent: AsteroidState,
  nextAsteroidId: number,
  count: number
): { asteroids: AsteroidState[]; nextAsteroidId: number } {
  if (parent.size <= 1 || count <= 0) {
    return { asteroids: [], nextAsteroidId };
  }

  const fragmentSize = (parent.size - 1) as AsteroidState["size"];
  const fragmentSpeed = Math.min(
    GAME_CONST.ASTEROID_SPEED_MAX,
    parent.moveSpeed * 1.15
  );

  const asteroids: AsteroidState[] = [];
  for (let i = 0; i < count; i++) {
    asteroids.push({
      id: nextAsteroidId++,
      position: [parent.position[0], parent.position[1], parent.position[2]],
      direction: randomTangentVec3(parent.position),
      moveSpeed: fragmentSpeed,
      size: fragmentSize,
      health: 2 * fragmentSize,
      canTakeDamage: true,
      isHit: false,
      hitTimer: 0,
    });
  }

  return { asteroids, nextAsteroidId };
}

/**
 * Resolve asteroid hit timers, recover damage gate, and spawn fragments for destroyed asteroids.
 * Pure state transition for asteroid lifecycle.
 */
export function stepAsteroidHitLifecycle(
  asteroids: readonly AsteroidState[],
  nextAsteroidId: number
): { asteroids: AsteroidState[]; nextAsteroidId: number } {
  if (asteroids.length === 0) {
    return {
      asteroids: [],
      nextAsteroidId,
    };
  }

  const survivors: AsteroidState[] = [];
  let currentNextId = nextAsteroidId;

  for (const asteroid of asteroids) {
    if (!asteroid.isHit) {
      survivors.push(asteroid);
      continue;
    }

    const nextTimer = asteroid.hitTimer - 1;
    if (nextTimer > 0) {
      survivors.push({
        ...asteroid,
        hitTimer: nextTimer,
      });
      continue;
    }

    if (asteroid.health <= 0) {
      if (asteroid.size > 1) {
        const fragmentCount = 2 + Math.floor(Math.random() * 2);
        const fragments = createAsteroidFragments(
          asteroid,
          currentNextId,
          fragmentCount
        );
        currentNextId = fragments.nextAsteroidId;
        survivors.push(...fragments.asteroids);
      }
      continue;
    }

    survivors.push({
      ...asteroid,
      canTakeDamage: true,
      isHit: false,
      hitTimer: 0,
    });
  }

  return {
    asteroids: survivors,
    nextAsteroidId: currentNextId,
  };
}
