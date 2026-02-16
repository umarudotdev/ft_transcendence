export const GAME_CONST = Object.freeze({
  SPHERE_RADIUS: 100,
  FORCE_FIELD_RADIUS: 95,
  PLANET_RADIUS: 70,

  TICK_RATE: 60,

  SHIP_SPEED: 0.01,
  SHIP_INITIAL_POS: Object.freeze([0, 0, 1] as const),

  PROJECTILE_SPEED: 0.015,
  PROJECTILE_AGE_TICKS: 102,
  PROJECTILE_SPREAD_ANGLE: Math.PI / 18,

  ASTEROID_SPEED_MIN: 0.00167,
  ASTEROID_SPEED_MAX: 0.005,
});

export const GAMEPLAY_CONST = Object.freeze({
  HIT_DELAY_SEC: 0.5,

  PROJECTILE_RADIUS: 1,
  SHIP_RADIUS: 3,
  ASTEROID_PADDING: 1.3,

  ASTEROID_DIAM: Object.freeze([2, 4, 6, 8] as const),
});

/** Get asteroid radius by size (1-4) */
export function getAsteroidRadius(size: 1 | 2 | 3 | 4): number {
  return GAMEPLAY_CONST.ASTEROID_DIAM[size - 1] / 2;
}

/** Get asteroid collision radius (with padding for forgiving collisions) */
export function getAsteroidCollisionRadius(size: 1 | 2 | 3 | 4): number {
  return getAsteroidRadius(size) * GAMEPLAY_CONST.ASTEROID_PADDING;
}
