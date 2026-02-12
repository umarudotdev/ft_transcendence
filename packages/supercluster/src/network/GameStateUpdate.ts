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
  Vec3,
} from "../types";
import { createInitialShipState } from "../defaults";

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
  position: Vec3;
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
    ship: createInitialShipState(),
    asteroids: [],
    projectiles: [],
    powerUps: [],
    score: 0,
    wave: 1,
    status: "waiting",
  };
}
