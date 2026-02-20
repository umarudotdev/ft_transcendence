// ============================================================================
// Game Constants (GAME_CONST)
// Physics constants that NEVER change during gameplay
// Shared between server and client
// ============================================================================

export const GAME_CONST = Object.freeze({
  // Sphere Geometry
  SPHERE_RADIUS: 100, // Game sphere radius (where ship/bullets/asteroids exist)
  FORCE_FIELD_RADIUS: 95, // Visual boundary
  PLANET_RADIUS: 70, // Visual planet size

  // Timing
  TICK_RATE: 60, // Server ticks per second

  // Ship Physics
  SHIP_SPEED: 0.01, // Angular velocity (rad/tick) = 0.6 rad/sec
  SHIP_INITIAL_POS: Object.freeze([0, 0, 1] as const), // Unit vector, front of sphere

  // Projectile Physics
  PROJECTILE_SPEED: 0.015, // Angular velocity (rad/tick) = 0.9 rad/sec
  PROJECTILE_AGE_TICKS: 102, // Max age in ticks before despawn (~1.7 sec)
  PROJECTILE_SPREAD_ANGLE: Math.PI / 18, // 10 degrees between rays (PI/18)

  // Asteroid Physics
  ASTEROID_SPEED_MIN: 0.00167, // Min angular velocity (rad/tick) = 0.1 rad/sec
  ASTEROID_SPEED_MAX: 0.005, // Max angular velocity (rad/tick) = 0.3 rad/sec
});

// ========================================================================
// Gameplay Constants (GAMEPLAY_CONST)
// Timing and mechanics that affect gameplay but aren't pure physics
// ========================================================================

export const GAMEPLAY_CONST = Object.freeze({
  // Hit delay before asteroid breaks (affects gameplay timing)
  HIT_DELAY_SEC: 0.5,

  // Collision Detection (used by both server and client)
  PROJECTILE_RADIUS: 1,
  SHIP_RADIUS: 3,
  ASTEROID_PADDING: 1.3, // Multiplier for forgiving collisions

  // Asteroid diameters by size category (1-4)
  // Index 0 = size 1 (smallest), Index 3 = size 4 (largest)
  ASTEROID_DIAM: Object.freeze([2, 4, 6, 8] as const),
});

// ========================================================================
// Type for GAME_CONST (for type safety when passing around)
// ========================================================================
export type GameConstType = typeof GAME_CONST;
export type GameplayConstType = typeof GAMEPLAY_CONST;

// ========================================================================
// Collision Helper Functions
// ========================================================================

/**
 * Get asteroid radius by size (1-4)
 */
export function getAsteroidRadius(size: 1 | 2 | 3 | 4): number {
  return GAMEPLAY_CONST.ASTEROID_DIAM[size - 1] / 2;
}

/**
 * Get asteroid collision radius (with padding for forgiving collisions)
 */
export function getAsteroidCollisionRadius(size: 1 | 2 | 3 | 4): number {
  return getAsteroidRadius(size) * GAMEPLAY_CONST.ASTEROID_PADDING;
}
