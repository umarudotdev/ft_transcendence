import type { InputState } from "@ft/supercluster";

// ============================================================================
// Input Controller
// Single source of truth for player input state
//
// RESPONSIBILITIES:
// - Stores current input state (keys, aim angle, fire button)
// - Provides setters for Svelte component to update state
// - Provides getters for game logic to read state
//
// DOES NOT:
// - Capture DOM events (that's Svelte's job)
// - Send to server (that's Svelte's job via WebSocket)
// - Calculate movement (that's GameRenderer/mechanics job)
// ============================================================================
export class InputController {
  // Uses existing InputState from shared package
  private _keys: InputState = {
    forward: false,
    backward: false,
    left: false,
    right: false,
  };

  // Aim angle in radians (direction for projectiles)
  // 0 = forward (-Y in screen space), positive = clockwise
  private _aimAngle = 0;

  // Fire button state (mouse pressed)
  private _firePressed = false;

  // ========================================================================
  // Setters (called from Svelte via GameRenderer)
  // ========================================================================

  /**
   * Update movement keys state
   * @param keys - Current state of WASD/arrow keys
   */
  setKeys(keys: InputState): void {
    this._keys = { ...keys };
  }

  /**
   * Update aim angle
   * @param angle - Aim direction in radians
   */
  setAimAngle(angle: number): void {
    this._aimAngle = angle;
  }

  /**
   * Update fire button state
   * @param pressed - Whether fire button is currently pressed
   */
  setFirePressed(pressed: boolean): void {
    this._firePressed = pressed;
  }

  // ========================================================================
  // Getters (used by game logic in GameRenderer)
  // ========================================================================

  /**
   * Get current movement keys state
   */
  get keys(): InputState {
    return this._keys;
  }

  /**
   * Get current aim angle
   */
  get aimAngle(): number {
    return this._aimAngle;
  }

  /**
   * Get fire button state
   */
  get firePressed(): boolean {
    return this._firePressed;
  }

  /**
   * Check if any movement key is pressed
   * Useful for skipping movement calculations when idle
   */
  get hasMovementInput(): boolean {
    return (
      this._keys.forward ||
      this._keys.backward ||
      this._keys.left ||
      this._keys.right
    );
  }

  // ========================================================================
  // Reset
  // ========================================================================

  /**
   * Reset all input state to defaults
   * Called on game restart
   */
  reset(): void {
    this._keys = {
      forward: false,
      backward: false,
      left: false,
      right: false,
    };
    this._aimAngle = 0;
    this._firePressed = false;
  }
}
