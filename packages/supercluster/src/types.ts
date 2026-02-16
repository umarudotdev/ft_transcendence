import type { QuatLike, Vec3Like } from "gl-matrix";

/**
 * Ship state - player's ship
 * Power-up levels increase during gameplay, reset on game restart.
 * Ship-centric mode: position remains fixed; heading/aim are authoritative.
 */
export interface ShipState {
  position: Vec3Like;
  orientation: QuatLike;
  aimAngle: number;
  lives: number;
  invincible: boolean;
  invincibleTicks: number;
  cooldownLevel: number;
  rayCountLevel: number;
}

/**
 * Projectile state - bullets fired by player.
 * Ship-centric mode: projectile state lives in same frame as ship/asteroids.
 */
export interface ProjectileState {
  id: number;
  position: Vec3Like;
  direction: Vec3Like;
  ageTicks: number;
}

/**
 * Asteroid state.
 * Server sends this, client renders based on it.
 * Ship-centric mode: asteroid state lives in same frame as ship/projectiles.
 */
export interface AsteroidState {
  id: number;
  position: Vec3Like;
  direction: Vec3Like;
  moveSpeed: number;
  size: 1 | 2 | 3 | 4;
  health: number;
  canTakeDamage: boolean;
  isHit: boolean;
  hitTimer: number;
}

export interface GameState {
  tick: number;
  ship: ShipState;
  projectiles: ProjectileState[];
  asteroids: AsteroidState[];
  score: number;
  wave: number;
  gameStatus: GameStatus;
}

export type GameStatus = "waiting" | "countdown" | "playing" | "gameOver";

export interface InputState {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
}
