// ============================================================================
// Shared Types for SuperCluster
// Used by both client (renderer) and server (game logic)
// Contract rule: keep this file engine-agnostic (no Three.js classes/imports)
//
// Ship-Centric Frame Contract (migration target):
// - Ship, asteroids, and projectiles share one simulation frame.
// - Collision checks compare entities directly in that same frame.
// ============================================================================

// ============================================================================
// Vector Position
// ============================================================================
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Quat {
  x: number;
  y: number;
  z: number;
  w: number;
}

// ============================================================================
// Game Entities
// ============================================================================

/**
 * Ship state - player's ship
 * Power-up levels increase during gameplay, reset on game restart
 * Ship-centric mode: position remains fixed; heading/aim are authoritative.
 */
export interface ShipState {
  position: Vec3; // Fixed ship anchor in ship-centric simulation frame
  orientation: Quat; // Authoritative orientation used for world visual rotation
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
  position: Vec3;
  direction: Vec3; // Movement direction unit vector in ship-centric frame
  ageTicks: number; // Ticks since spawn
}

/**
 * Asteroid state - replaces generic EnemyState
 * Server sends this, client renders based on it
 * Ship-centric mode: asteroid state lives in same frame as ship/projectiles.
 */
export interface AsteroidState {
  id: number;
  position: Vec3;
  direction: Vec3; // Movement direction unit vector in ship-centric frame
  moveSpeed: number; // Movement speed scalar in ship-centric frame (units/tick)
  size: 1 | 2 | 3 | 4; // 1=smallest, 4=largest
  health: number; // Hits remaining (usually 1)
  canTakeDamage: boolean; // Damage gate while asteroid is in break transition
  isHit: boolean; // Has been hit, waiting to break
  hitTimer: number; // Time remaining until break (in ticks)
}

// ============================================================================
// Game State (Server → Client)
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
  | "gameOver"; // Game ended (removed "paused" - no pause feature)

// ============================================================================
// Player Input (Client → Server)
// Includes sequence numbers for future client-side prediction
// ============================================================================
export interface InputState {
  forward: boolean; // W or Up
  backward: boolean; // S or Down
  left: boolean; // A or Left
  right: boolean; // D or Right
}

export interface PlayerInput {
  type: "input";
  seq: number; // Sequence number for reconciliation
  tick: number; // Client tick when input was made
  keys: InputState;
}

export interface AimInput {
  type: "aim";
  seq: number; // Sequence number for reconciliation
  angle: number; // Radians
}

export interface ShootStartInput {
  type: "shoot_start";
  seq: number; // Sequence number for reconciliation
}

export interface ShootStopInput {
  type: "shoot_stop";
  seq: number; // Sequence number for reconciliation
}

export interface ReadyInput {
  type: "ready";
}

export type ClientMessage =
  | PlayerInput
  | AimInput
  | ShootStartInput
  | ShootStopInput
  | ReadyInput;

// ============================================================================
// Server Messages (Server → Client)
// ============================================================================
export interface StateMessage {
  type: "state";
  state: GameState; // Full authoritative snapshot
  lastInputSeq: number; // Last client input seq consumed by server
}

export interface CountdownMessage {
  type: "countdown";
  seconds: number;
}

export interface HitMessage {
  type: "hit";
  targetId: number;
  points: number;
}

export interface DamageMessage {
  type: "damage";
  lives: number;
}

export interface GameOverMessage {
  type: "gameOver";
  finalScore: number;
  wave: number;
}

export interface WaveMessage {
  type: "wave";
  waveNumber: number;
}

export type ServerMessage =
  | StateMessage
  | CountdownMessage
  | HitMessage
  | DamageMessage
  | GameOverMessage
  | WaveMessage;

// ============================================================================
// NOTE: GameConfig, RendererConfig, BulletConfig removed
// - Projectile physics: GAME_CONST (PROJECTILE_AGE_TICKS, PROJECTILE_SPREAD_ANGLE)
// - Projectile gameplay: DEFAULT_GAMEPLAY (projectileCooldown, projectileRayCount)
// - Visual settings: RENDERER_CONST (apps/web/src/lib/supercluster/constants/renderer.ts)
// ============================================================================
