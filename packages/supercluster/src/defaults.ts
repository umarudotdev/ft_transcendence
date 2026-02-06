// ============================================================================
// Gameplay Defaults (DEFAULT_GAMEPLAY)
// Starting values that RESET on game restart or player death
// Power-ups modify these during gameplay
// ============================================================================

// ========================================================================
// Asteroid Wave Configuration
// ========================================================================
export interface AsteroidWave {
  size1: number; // Count of smallest asteroids
  size2: number;
  size3: number;
  size4: number; // Count of largest asteroids
}

// ========================================================================
// Gameplay State Defaults
// ========================================================================
export interface GameplayDefaults {
  // Ship
  shipLives: number;
  shipInvincible: boolean;
  invincibleTimer: number; // Seconds of invincibility after hit

  // Projectile (power-ups modify these)
  projectileCooldown: number; // Ticks between shots
  projectileRayCount: number; // Number of bullets per shot (1-5)

  // Initial asteroid wave
  asteroidWave: AsteroidWave;
}

export const DEFAULT_GAMEPLAY: GameplayDefaults = {
  // Ship
  shipLives: 3,
  shipInvincible: false,
  invincibleTimer: 2.0, // 2 seconds of invincibility after hit

  // Projectile (power-ups modify these)
  projectileCooldown: 18, // Ticks = 0.3 sec at 60 ticks/sec
  projectileRayCount: 1, // Single shot, power-ups increase

  // Initial asteroid wave
  asteroidWave: {
    size1: 12,
    size2: 8,
    size3: 4,
    size4: 2,
  },
};

// ========================================================================
// Power-up Progression (Future)
// Power-ups alternate: cooldown -> spread -> cooldown -> spread (4 each)
// ========================================================================
export const POWER_UP_PROGRESSION = Object.freeze({
  // Each pickup reduces cooldown by this amount (ticks)
  cooldownReductions: Object.freeze([3, 3, 3, 3]),

  // Each pickup increases ray count by this amount
  rayCountIncreases: Object.freeze([1, 1, 1, 1]),
});

// ========================================================================
// Helper: Create asteroid wave array for spawning
// ========================================================================
export function createWaveArray(wave: AsteroidWave): number[] {
  return [
    ...Array(wave.size1).fill(1),
    ...Array(wave.size2).fill(2),
    ...Array(wave.size3).fill(3),
    ...Array(wave.size4).fill(4),
  ];
}

// ========================================================================
// Type exports
// ========================================================================
export type GameplayDefaultsType = typeof DEFAULT_GAMEPLAY;
