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
// Configuration (GUI-controlled values only)
// Non-GUI values use GAME_CONST directly from constants.ts
// ============================================================================
export interface GameConfig {
  // Projectile mechanics - GUI controlled via lil-gui
  projectile: {
    lifetime: number; // Ticks before despawn (GUI: Bullets → Lifetime)
    cooldown: number; // Ticks between shots (GUI: Bullets → Cooldown)
    rayCount: number; // Number of bullets per shot 1-5 (GUI: Bullets → Ray Count)
    spreadAngle: number; // Angle between rays in radians (GUI: Bullets → Spread)
  };
}

export const DEFAULT_CONFIG: GameConfig = {
  projectile: {
    lifetime: 102, // ~1.7 sec at 60 ticks/sec
    cooldown: 18, // ~0.3 sec at 60 ticks/sec (5 shots/sec)
    rayCount: 1, // Single shot
    spreadAngle: Math.PI / 18, // 10 degrees
  },
};

// ============================================================================
// Renderer Config (Client-only)
// ============================================================================
export interface RendererConfig {
  forceFieldOpacity: number;
  forceFieldBackFade: number;
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
  // Ship rotation
  shipRotationSpeed: 10, // ~0.3s to rotate at 60fps
  // Aim dot
  aimDotSize: 1,
  aimDotColor: 0xffff00, // Yellow
  aimDotOrbitRadius: 4, // Slightly larger than ship
};

// ============================================================================
// Bullet Visual Config (Client-only visual preferences)
// NOTE: All gameplay mechanics (speed, lifetime, cooldown, etc.) come from GameConfig
// ============================================================================
export interface BulletConfig {
  color: number; // Hex color (yellow/orange) - visual only
  maxBullets: number; // Max bullets on screen (client performance limit)
}

export const DEFAULT_BULLET_CONFIG: BulletConfig = {
  color: 0xffaa00, // Orange-yellow
  maxBullets: 100, // Performance cap for low-end devices
};
