// ============================================================================
// Client Input (ClientInput)
// Data sent from CLIENT -> SERVER every frame (or on change)
//
// NOTE: Uses InputState from ../types.ts
// ============================================================================

import type { InputState } from "../types";

/**
 * Movement and action input from client
 * Sent to server for authoritative game simulation
 */
export interface ClientInput {
  // ========================================================================
  // Movement Keys (WASD) - from types.ts
  // ========================================================================
  keys: InputState;

  // ========================================================================
  // Aim Direction
  // ========================================================================
  aimAngle: number; // Radians, direction on tangent plane

  // ========================================================================
  // Actions
  // ========================================================================
  firing: boolean; // Mouse button held down

  // ========================================================================
  // Timing (for lag compensation)
  // ========================================================================
  timestamp: number; // Client timestamp when input was captured
  sequence: number; // Input sequence number for reconciliation
}

/**
 * Create a default/empty ClientInput
 */
export function createEmptyInput(): ClientInput {
  return {
    keys: {
      forward: false,
      backward: false,
      left: false,
      right: false,
    },
    aimAngle: 0,
    firing: false,
    timestamp: 0,
    sequence: 0,
  };
}

/**
 * Check if any movement keys are pressed
 */
export function hasMovementInput(input: ClientInput): boolean {
  return (
    input.keys.forward ||
    input.keys.backward ||
    input.keys.left ||
    input.keys.right
  );
}
