// ============================================================================
// Shared Types for SuperCluster
// Used by both client (renderer) and server (game logic)
//
// Ship-Centric Frame Contract (migration target):
// - Ship, asteroids, and projectiles share one simulation frame.
// - Collision checks compare entities directly in that same frame.
// ============================================================================

import type { QuatLike, Vec3Like } from "gl-matrix";

// ============================================================================
// Game Entities
// ============================================================================

/**
 * Ship state - player's ship
 * Power-up levels increase during gameplay, reset on game restart
 * Ship-centric mode: position remains fixed; heading/aim are authoritative.
 */
export interface ShipState {
  position: Vec3Like; // Fixed ship anchor in ship-centric simulation frame
  orientation: QuatLike; // Authoritative orientation used for world visual rotation
  aimAngle: number; // Canonical aim angle in ship-centric frame (radians)
  lives: number;
  invincible: boolean; // After taking damage
  invincibleTicks: number; // Remaining invincibility ticks (for visual feedback)
  cooldownLevel: number; // 0-4, each level = -3 ticks cooldown
  rayCountLevel: number; // 0-4, each level = +1 ray
}

/**
 * Projectile state - bullets fired by player
 * Ship-centric mode: projectile state lives in same frame as ship/asteroids.
 */
export interface ProjectileState {
  id: number;
  position: Vec3Like;
  direction: Vec3Like; // Movement direction unit vector in ship-centric frame
  ageTicks: number; // Ticks since spawn
}

/**
 * Asteroid state - replaces generic EnemyState
 * Server sends this, client renders based on it
 * Ship-centric mode: asteroid state lives in same frame as ship/projectiles.
 */
export interface AsteroidState {
  id: number;
  position: Vec3Like;
  direction: Vec3Like; // Movement direction unit vector in ship-centric frame
  moveSpeed: number; // Movement speed scalar in ship-centric frame (units/tick)
  size: 1 | 2 | 3 | 4; // 1=smallest, 4=largest
  health: number; // Hits remaining (usually 1)
  canTakeDamage: boolean; // Damage gate while asteroid is in break transition
  isHit: boolean; // Has been hit, waiting to break
  hitTimer: number; // Time remaining until break (in ticks)
}

// ============================================================================
// Game State
// ============================================================================
export interface GameState {
  tick: number; // Authoritative server simulation tick
  ship: ShipState;
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
