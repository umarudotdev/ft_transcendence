// ============================================================================
// Shared Types for SuperCluster
// Used by both client (renderer) and server (game logic)
// ============================================================================

// ============================================================================
// Vector Position
// ============================================================================
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

// ============================================================================
// Game Entities
// ============================================================================

/**
 * Ship state - player's ship
 * Power-up levels increase during gameplay, reset on game restart
 */
export interface ShipState {
  position: Vec3;
  direction: Vec3; // Tangent direction unit vector
  aimAngle: number; // Direction of aim on tangent plane (radians)
  lives: number;
  invincible: boolean; // After taking damage
  invincibleTicks: number; // Remaining invincibility ticks (for visual feedback)
  cooldownLevel: number; // 0-4, each level = -3 ticks cooldown
  rayCountLevel: number; // 0-4, each level = +1 ray
}

/**
 * Projectile state - bullets fired by player
 */
export interface ProjectileState {
  id: number;
  position: Vec3;
  direction: Vec3; // Movement direction unit vector tangent to sphere
  age: number; // Ticks since spawn
}

/**
 * Asteroid state - replaces generic EnemyState
 * Server sends this, client renders based on it
 */
export interface AsteroidState {
  id: number;
  position: Vec3;
  direction: Vec3; // Movement direction unit vector tangent to sphere
  angularSpeed: number; // Angular speed (rad/tick)
  size: 1 | 2 | 3 | 4; // 1=smallest, 4=largest
  health: number; // Hits remaining (usually 1)
  isHit: boolean; // Has been hit, waiting to break
  hitTimer: number; // Time remaining until break (in ticks)
}

// ============================================================================
// Game State (Server → Client)
// ============================================================================
export interface GameState {
  tick: number;
  ship: ShipState;
  projectiles: ProjectileState[];
  asteroids: AsteroidState[]; // Changed from enemies: EnemyState[]
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

export interface ShootInput {
  type: "shoot";
  seq: number; // Sequence number for reconciliation
}

export interface ReadyInput {
  type: "ready";
}

export type ClientMessage = PlayerInput | AimInput | ShootInput | ReadyInput;

// ============================================================================
// Server Messages (Server → Client)
// ============================================================================
export interface StateMessage {
  type: "state";
  state: GameState;
  lastInputSeq: number; // Last processed input sequence (for reconciliation)
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
// - Projectile physics: GAME_CONST (PROJECTILE_LIFETIME, PROJECTILE_SPREAD_ANGLE)
// - Projectile gameplay: DEFAULT_GAMEPLAY (projectileCooldown, projectileRayCount)
// - Visual settings: RENDERER_CONST (apps/web/src/lib/supercluster/constants/renderer.ts)
// ============================================================================
