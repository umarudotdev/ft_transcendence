// ============================================================================
// Shared Types for SuperCluster
// Used by both client (renderer) and server (game logic)
// ============================================================================

// ============================================================================
// Spherical Position
// ============================================================================
export interface SphericalPosition {
  phi: number; // Polar angle from Y-axis (0 to PI)
  theta: number; // Azimuthal angle in XZ plane (0 to 2*PI)
}

// ============================================================================
// Game Entities
// ============================================================================
export interface ShipState {
  position: SphericalPosition;
  aimAngle: number; // Direction of aim on tangent plane (radians)
  lives: number;
  invincible: boolean; // After taking damage
}

export interface ProjectileState {
  id: number;
  position: SphericalPosition;
  direction: number; // Movement direction on sphere (radians)
  age: number; // Ticks since spawn
}

export interface EnemyState {
  id: number;
  position: SphericalPosition;
  type: EnemyType;
  health: number;
  velocity: SphericalPosition; // Angular velocity
}

export type EnemyType = "asteroid" | "chaser" | "shooter";

// ============================================================================
// Game State (Server → Client)
// ============================================================================
export interface GameState {
  tick: number;
  ship: ShipState;
  projectiles: ProjectileState[];
  enemies: EnemyState[];
  score: number;
  wave: number;
  gameStatus: GameStatus;
}

export type GameStatus =
  | "waiting"
  | "countdown"
  | "playing"
  | "paused"
  | "gameOver";

// ============================================================================
// Player Input (Client → Server)
// ============================================================================
export interface InputState {
  forward: boolean; // W or Up
  backward: boolean; // S or Down
  left: boolean; // A or Left
  right: boolean; // D or Right
}

export interface PlayerInput {
  type: "input";
  keys: InputState;
}

export interface AimInput {
  type: "aim";
  angle: number; // Radians
}

export interface ShootInput {
  type: "shoot";
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
// Configuration
// ============================================================================
export interface GameConfig {
  gameSphereRadius: number;
  forceFieldRadius: number;
  planetRadius: number;
  shipSpeed: number; // Angular velocity (rad/tick)
  projectileSpeed: number; // Angular velocity (rad/tick)
  projectileLifetime: number; // Ticks
  tickRate: number; // Ticks per second (60)
}

export const DEFAULT_CONFIG: GameConfig = {
  gameSphereRadius: 100,
  forceFieldRadius: 95,
  planetRadius: 70,
  shipSpeed: 0.01,
  projectileSpeed: 0.05,
  projectileLifetime: 120, // 2 seconds at 60 ticks
  tickRate: 60,
};

// ============================================================================
// Renderer Config (Client-only)
// ============================================================================
export interface RendererConfig {
  forceFieldOpacity: number;
  forceFieldBackFade: number;
  showAxes: boolean;
  showDebugInfo: boolean;
  // Ship rotation
  shipRotationSpeed: number; // Lerp speed (0-1, higher = faster)
  // Aim dot
  aimDotSize: number; // Radius of the dot
  aimDotColor: number; // Hex color
  aimDotOrbitRadius: number; // Distance from ship center
}

export const DEFAULT_RENDERER_CONFIG: RendererConfig = {
  forceFieldOpacity: 0.35,
  forceFieldBackFade: 0.0,
  showAxes: false,
  showDebugInfo: false,
  // Ship rotation
  shipRotationSpeed: 10, // ~0.3s to rotate at 60fps
  // Aim dot
  aimDotSize: 1,
  aimDotColor: 0xffff00, // Yellow
  aimDotOrbitRadius: 4, // Slightly larger than ship
};

// ============================================================================
// Bullet Config (Client-only, for local testing before networking)
// ============================================================================
export interface BulletConfig {
  lifetime: number; // Seconds before bullet disappears
  speed: number; // Radians per second on sphere surface
  cooldown: number; // Seconds between shots
  rayCount: number; // Number of bullets per shot (1-5)
  spreadAngle: number; // Angle between rays in radians (for multi-ray)
  color: number; // Hex color (yellow/orange)
  maxBullets: number; // Max bullets on screen (performance)
}

export const DEFAULT_BULLET_CONFIG: BulletConfig = {
  lifetime: 2.0, // 2 seconds
  speed: 1.0, // Moderate travel speed
  cooldown: 0.2, // 5 shots per second
  rayCount: 1, // Single shot
  spreadAngle: Math.PI / 18, // 10 degrees in radians
  color: 0xffaa00, // Orange-yellow
  maxBullets: 100,
};
