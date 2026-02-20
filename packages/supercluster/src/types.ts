// ============================================================================
// Shared Types for SuperCluster
// Used by both client (renderer) and server (game logic)
//
// World-Centric Frame Contract:
// - Ship, asteroids, and projectiles share one world simulation frame.
// - Collision checks compare entities directly in that same frame.
// ============================================================================

export type NetVec3 = [number, number, number];

// ============================================================================
// Game Entities
// ============================================================================

/**
 * Ship state - player's ship
 * Power-up levels increase during gameplay, reset on game restart
 * World-centric mode: position and direction are authoritative for movement.
 */
export interface ShipState {
  playerId: string; // Stable player identity (maps to room/session id)
  position: NetVec3; // Unit vector position in world frame
  direction: NetVec3; // Tangent unit vector in world frame
  aimAngle: number; // Canonical aim angle in ship-local tangent frame (radians)
  lives: number;
  invincible: boolean; // After taking damage
  invincibleTicks: number; // Remaining invincibility ticks (for visual feedback)
  cooldownLevel: number; // 0-4, each level = -3 ticks cooldown
  rayCountLevel: number; // 0-4, each level = +1 ray
}

/**
 * Projectile state - bullets fired by player
 * World-centric mode: projectile state lives in same frame as ship/asteroids.
 */
export interface ProjectileState {
  id: number;
  ownerPlayerId: string; // Shooter player id (for future PvP/friendly-fire rules)
  position: NetVec3;
  direction: NetVec3; // Movement direction unit vector in world frame
  ageTicks: number; // Ticks since spawn
}

/**
 * Asteroid state - replaces generic EnemyState
 * Server sends this, client renders based on it
 * World-centric mode: asteroid state lives in same frame as ship/projectiles.
 */
export interface AsteroidState {
  id: number;
  position: NetVec3;
  direction: NetVec3; // Movement direction unit vector in world frame
  moveSpeed: number; // Movement speed scalar in world frame (rad/tick)
  size: 1 | 2 | 3 | 4; // 1=smallest, 4=largest
  health: number; // Remaining hit points
  phase: AsteroidPhase; // Lifecycle/mechanics phase
  phaseTimer: number; // Countdown for current phase transition
  hitFlashTicks: number; // Remaining visual hit-flash ticks while active
}

export type AsteroidPhase = "incoming" | "active" | "breaking";

// ============================================================================
// Game State
// ============================================================================
export interface GameState {
  tick: number; // Authoritative server simulation tick
  ships: ShipState[];
  projectiles: ProjectileState[];
  asteroids: AsteroidState[];
  score: number;
  wave: number;
  gameStatus: GameStatus;
}

export type GameStatus =
  | "waiting" // Waiting for player to be ready
  | "countdown" // Countdown before game starts
  | "playing" // Game in progress
  | "gameOver"; // Game ended

// ============================================================================
// Player Input
// ============================================================================
export interface InputState {
  forward: boolean; // W or Up
  backward: boolean; // S or Down
  left: boolean; // A or Left
  right: boolean; // D or Right
}
