// ============================================================================
// Client Input (ClientInput)
// Data sent from CLIENT -> SERVER every frame (or on change)
//
// PLACEHOLDER - To be implemented when server is ready
// ============================================================================

/**
 * Movement and action input from client
 * Sent to server for authoritative game simulation
 */
export interface ClientInput {
  // ========================================================================
  // Movement Keys (WASD)
  // ========================================================================
  keys: {
    forward: boolean; // W or Up
    backward: boolean; // S or Down
    left: boolean; // A or Left
    right: boolean; // D or Right
  };

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
