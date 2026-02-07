// ============================================================================
// Game State Update (GameStateUpdate)
// Data sent from SERVER -> CLIENT every tick (60/sec)
//
// NOTE: Uses types from ../types.ts - this file adds network-specific wrappers
// ============================================================================

import type {
  AsteroidState,
  ProjectileState,
  ShipState,
  GameStatus,
} from "../types";

/**
 * Complete game state sent to client for rendering
 * Client interpolates between states for smooth visuals
 */
export interface GameStateUpdate {
  // ========================================================================
  // Synchronization
  // ========================================================================
  tick: number; // Server tick number
  timestamp: number; // Server timestamp
  lastInputSeq: number; // Last processed input sequence

  // ========================================================================
  // Game Entities (from types.ts)
  // ========================================================================
  ship: ShipState;
  asteroids: AsteroidState[];
  projectiles: ProjectileState[];

  // ========================================================================
  // Power-ups (Future)
  // ========================================================================
  powerUps: PowerUpState[];

  // ========================================================================
  // Game Status
  // ========================================================================
  score: number;
  wave: number;
  status: GameStatus;
}

/**
 * Individual power-up state (Future)
 */
export interface PowerUpState {
  id: number;
  phi: number;
  theta: number;
  type: "cooldown" | "spread";
}

/**
 * Create an empty game state (for initialization)
 */
export function createEmptyGameState(): GameStateUpdate {
  return {
    tick: 0,
    timestamp: 0,
    lastInputSeq: 0,
    ship: {
      position: { phi: Math.PI / 2, theta: Math.PI / 2 },
      aimAngle: 0,
      lives: 3,
      invincible: false,
      invincibleTicks: 0,
      cooldownLevel: 0,
      rayCountLevel: 0,
    },
    asteroids: [],
    projectiles: [],
    powerUps: [],
    score: 0,
    wave: 1,
    status: "waiting",
  };
}
