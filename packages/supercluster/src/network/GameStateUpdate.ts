// ============================================================================
// Game State Update (GameStateUpdate)
// Data sent from SERVER -> CLIENT every tick (60/sec)
//
// PLACEHOLDER - To be implemented when server is ready
// ============================================================================

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

  // ========================================================================
  // Ship State
  // ========================================================================
  ship: {
    phi: number; // Polar angle (0 to PI)
    theta: number; // Azimuthal angle (0 to 2*PI)
    aimAngle: number; // Aim direction on tangent plane
    lives: number; // Remaining lives
    invincible: boolean; // Currently invincible
    invincibleTimer: number; // Seconds remaining
  };

  // ========================================================================
  // Asteroids
  // ========================================================================
  asteroids: AsteroidState[];

  // ========================================================================
  // Bullets
  // ========================================================================
  bullets: BulletState[];

  // ========================================================================
  // Power-ups (Future)
  // ========================================================================
  powerUps: PowerUpState[];

  // ========================================================================
  // Game Status
  // ========================================================================
  score: number;
  wave: number;
  isGameOver: boolean;
}

/**
 * Individual asteroid state
 */
export interface AsteroidState {
  id: number;
  phi: number;
  theta: number;
  size: 1 | 2 | 3 | 4; // Size category
  rotationAngle: number; // Visual rotation
  isHit: boolean; // Turning red (hit but not yet broken)
  hitTimer: number; // Seconds until break
}

/**
 * Individual bullet state
 */
export interface BulletState {
  id: number;
  phi: number;
  theta: number;
  age: number; // Ticks since spawn
  ownerId?: number; // For multiplayer: who shot it
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
    ship: {
      phi: Math.PI / 2,
      theta: Math.PI / 2,
      aimAngle: 0,
      lives: 3,
      invincible: false,
      invincibleTimer: 0,
    },
    asteroids: [],
    bullets: [],
    powerUps: [],
    score: 0,
    wave: 1,
    isGameOver: false,
  };
}
