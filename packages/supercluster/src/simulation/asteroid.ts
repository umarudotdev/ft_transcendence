import { GAME_CONST } from "../constants";
import type { AsteroidState } from "../types";
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
  const angularSpeed =
    GAME_CONST.ASTEROID_SPEED_MIN +
    Math.random() * (GAME_CONST.ASTEROID_SPEED_MAX - GAME_CONST.ASTEROID_SPEED_MIN);

  return {
    id,
    position,
    direction,
    angularSpeed,
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
    const steppedMotion = stepSurfaceMotionState(
      asteroid.position,
      asteroid.direction,
      asteroid.angularSpeed * deltaTicks
    );

    stepped.push({
      ...asteroid,
      position: normalizeVec3(steppedMotion.position),
      direction: normalizeVec3(steppedMotion.direction),
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
    parent.angularSpeed * 1.15
  );

  const asteroids: AsteroidState[] = [];
  for (let i = 0; i < count; i++) {
    asteroids.push({
      id: nextAsteroidId++,
      position: { ...parent.position },
      direction: randomTangentVec3(parent.position),
      angularSpeed: fragmentSpeed,
      size: fragmentSize,
      health: 2 * fragmentSize,
      canTakeDamage: true,
      isHit: false,
      hitTimer: 0,
    });
  }

  return { asteroids, nextAsteroidId };
}
