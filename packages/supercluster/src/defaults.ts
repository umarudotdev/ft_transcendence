import type { NetVec3, ShipState } from "./types";

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
  projectileRayCount: 2, // Single shot, power-ups increase

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
// Shared Initial Entity State
// ========================================================================
const SHIP_SPAWN_POSITIONS: readonly NetVec3[] = Object.freeze([
  [0, 0, 1], // north pole front
  [0, 0, -1], // south pole back
  [0, 1, 0], // top equator
  [0, -1, 0], // bottom equator
  [1, 0, 0], // right equator
  [-1, 0, 0], // left equator
]);

function normalizeVec3(v: NetVec3): NetVec3 {
  const len = Math.hypot(v[0], v[1], v[2]);
  if (len <= 1e-8) return [0, 0, 1];
  return [v[0] / len, v[1] / len, v[2] / len];
}

function crossVec3(a: NetVec3, b: NetVec3): NetVec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function createSpawnDirection(position: NetVec3): NetVec3 {
  const normalizedPos = normalizeVec3(position);
  const worldUp: NetVec3 = [0, 1, 0];
  const worldRight: NetVec3 = [1, 0, 0];

  let tangent = crossVec3(worldUp, normalizedPos);
  if (Math.hypot(tangent[0], tangent[1], tangent[2]) <= 1e-8) {
    tangent = crossVec3(worldRight, normalizedPos);
  }

  return normalizeVec3(tangent);
}

export function getShipSpawnPosition(playerIndex: number): NetVec3 {
  const index = Math.abs(playerIndex) % SHIP_SPAWN_POSITIONS.length;
  const spawn = SHIP_SPAWN_POSITIONS[index];
  return [spawn[0], spawn[1], spawn[2]];
}

export function createInitialShipState(
  playerId = "player-1",
  spawnPosition: NetVec3 = getShipSpawnPosition(0)
): ShipState {
  const position = normalizeVec3(spawnPosition);
  return {
    playerId,
    position,
    direction: createSpawnDirection(position),
    aimAngle: 0,
    lives: DEFAULT_GAMEPLAY.shipLives,
    invincible: DEFAULT_GAMEPLAY.shipInvincible,
    invincibleTicks: 0,
    cooldownLevel: 0,
    rayCountLevel: 0,
  };
}

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
