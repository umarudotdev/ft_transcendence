import {
  GAME_CONST,
  GAMEPLAY_CONST,
  DEFAULT_GAMEPLAY,
  type GameState,
  type InputState,
} from "@ft/supercluster";
import * as THREE from "three";

import { RENDERER_CONST } from "../constants/renderer";
import { GameOverScreen } from "./GameOverScreen";
import { GameStage } from "./GameStage";

// ============================================================================
// Game Renderer
// Orchestrates rendering and game loop
//
// ARCHITECTURE:
// - Ship: Fixed at (0,0,gameSphereRadius) in world space, planet rotates under it
// - Bullets: World space (scene children) - absolute velocity independent of ship movement
// - Asteroids: Planet local space (planet children) - rotate with planet
// - Collisions: Transform bullets from world→planet space for detection
//
// RESPONSIBILITIES:
// - Three.js infrastructure (renderer, scene, camera, lights)
// - Render loop (start/stop, animation frame)
// - Game logic (movement, shooting, collisions)
// - Input handling
//
// DELEGATES TO:
// - GameStage: Game objects (world, ship, asteroids, bullets)
// - GameOverScreen: Game over visuals (explosion, DOM overlay)
// ============================================================================
export class GameRenderer {
  // Three.js infrastructure (owned by GameRenderer)
  private webglRenderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private canvas: HTMLCanvasElement;

  // Game objects container
  private stage: GameStage;

  // Game over screen
  private gameOverScreen: GameOverScreen;

  // Animation state
  private animationId: number | null = null;
  private lastState: GameState | null = null;
  private lastTime: number = 0;

  // ========================================================================
  // Quaternion-based rotation system (no gimbal lock, smooth pole crossing)
  // ========================================================================
  // Planet orientation as quaternion - avoids gimbal lock at poles
  private planetQuaternion = new THREE.Quaternion();

  // Ship position as unit vector on sphere surface (x² + y² + z² = 1)
  // This tracks where the ship "actually" is on the planet
  private shipPosition = new THREE.Vector3(
    GAME_CONST.SHIP_INITIAL_POS.x,
    GAME_CONST.SHIP_INITIAL_POS.y,
    GAME_CONST.SHIP_INITIAL_POS.z
  );

  // Ship direction and aim angles
  private targetShipDirection = 0; // Where ship tip should point (from WASD)
  private shipAimAngle = 0; // Where aim dot is (from mouse)
  private shipLives = DEFAULT_GAMEPLAY.shipLives;
  private shipInvincible = DEFAULT_GAMEPLAY.shipInvincible;

  // Current input state
  private currentInput: InputState = {
    forward: false,
    backward: false,
    left: false,
    right: false,
  };

  // Reusable objects for movement calculations (avoid GC pressure)
  private readonly _WORLD_X_AXIS = new THREE.Vector3(1, 0, 0); // Pitch axis (forward/backward)
  private readonly _WORLD_Y_AXIS = new THREE.Vector3(0, 1, 0); // Yaw axis (left/right)
  private readonly _tempQuat = new THREE.Quaternion();

  // Shooting state
  private shootCooldownTimer = 0; // Time until next shot allowed
  private mousePressed = false; // Is mouse button currently held down

  // Game state
  private isGameOver = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;

    // Setup WebGL renderer
    this.webglRenderer = new THREE.WebGLRenderer({ antialias: true, canvas });
    this.webglRenderer.setSize(canvas.clientWidth, canvas.clientHeight);
    this.webglRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Create scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(RENDERER_CONST.SCENE_BG);

    // Create camera
    this.camera = new THREE.PerspectiveCamera(
      RENDERER_CONST.CAMERA_FOV,
      canvas.clientWidth / canvas.clientHeight,
      RENDERER_CONST.CAMERA_NEAR,
      RENDERER_CONST.CAMERA_FAR
    );
    this.setupCamera();

    // Add lighting
    this.addLights();

    // Create game stage (adds game objects to scene)
    this.stage = new GameStage(this.scene);

    // Create game over screen
    this.gameOverScreen = new GameOverScreen(this.scene, canvas);

    // Initialize game state
    this.initializeGameState();

    // Handle window resize
    this.handleResize = this.handleResize.bind(this);
    window.addEventListener("resize", this.handleResize);

    // Handle restart on Enter key
    this.handleKeyPress = this.handleKeyPress.bind(this);
    window.addEventListener("keydown", this.handleKeyPress);
  }

  /**
   * Initialize/reset game state
   * Called by both constructor and restart()
   */
  private initializeGameState(): void {
    // Initialize game objects
    this.stage.initialize();

    // Reset ship position to initial position
    const { x, y, z } = GAME_CONST.SHIP_INITIAL_POS;
    this.shipPosition.set(x, y, z);
    this.planetQuaternion.identity();
    this.stage.world.group.quaternion.copy(this.planetQuaternion);

    // Reset ship state
    this.targetShipDirection = 0;
    this.shipAimAngle = 0;
    this.shipLives = DEFAULT_GAMEPLAY.shipLives;
    this.shipInvincible = DEFAULT_GAMEPLAY.shipInvincible;

    // Reset input state
    this.currentInput = {
      forward: false,
      backward: false,
      left: false,
      right: false,
    };
    this.mousePressed = false;
    this.shootCooldownTimer = 0;
  }

  /**
   * Handle keyboard input for restart
   */
  private handleKeyPress(event: KeyboardEvent): void {
    if (event.key === "Enter" && this.isGameOver) {
      this.restart();
    }
  }

  private addLights(): void {
    const ambient = new THREE.AmbientLight(
      0xffffff,
      RENDERER_CONST.AMB_LIGHT_INTENSITY
    );
    this.scene.add(ambient);

    const directional = new THREE.DirectionalLight(
      0xffffff,
      RENDERER_CONST.DIR_LIGHT_INTENSITY
    );
    const { x, y, z } = RENDERER_CONST.DIR_LIGHT_POS;
    directional.position.set(x, y, z);
    this.scene.add(directional);
  }

  private setupCamera(): void {
    // Camera positioned directly behind the ship, looking at sphere center
    // Ship is always visually at (0, 0, SPHERE_RADIUS) - front of sphere
    // Camera on the Z axis for a straight view with planet centered
    const cameraDistance =
      GAME_CONST.SPHERE_RADIUS * RENDERER_CONST.CAMERA_DIST_MULT;

    this.camera.position.set(0, 0, cameraDistance);
    this.camera.lookAt(0, 0, 0);
  }

  // ========================================================================
  // Game State Updates (from server)
  // ========================================================================
  updateState(state: GameState): void {
    this.lastState = state;

    // Update internal state from server
    this.shipPosition.copy(
      this.sphericalToUnitVector(
        state.ship.position.phi,
        state.ship.position.theta
      )
    );
    this.shipAimAngle = state.ship.aimAngle;
    this.shipLives = state.ship.lives;
    this.shipInvincible = state.ship.invincible;

    // Rebuild planet quaternion from server state
    this.planetQuaternion.identity();
    this._tempQuat.setFromAxisAngle(
      this._WORLD_X_AXIS,
      -(state.ship.position.phi - Math.PI / 2)
    );
    this.planetQuaternion.multiply(this._tempQuat);
    this._tempQuat.setFromAxisAngle(
      this._WORLD_Y_AXIS,
      state.ship.position.theta - Math.PI / 2
    );
    this.planetQuaternion.multiply(this._tempQuat);

    // Apply to visuals
    this.stage.world.group.quaternion.copy(this.planetQuaternion);
    this.stage.ship.updateFromState(
      state.ship,
      this.stage.ship.getCurrentDirectionAngle(),
      this.shipAimAngle
    );

    // TODO: Update projectiles
    // TODO: Update enemies
  }

  // ========================================================================
  // Input Handling (for local movement before server is implemented)
  // ========================================================================
  setInput(input: InputState): void {
    this.currentInput = { ...input };
  }

  setAimAngle(angle: number): void {
    this.shipAimAngle = angle;
    this.updateShipVisuals();
  }

  setMousePressed(pressed: boolean): void {
    this.mousePressed = pressed;
  }

  /**
   * Update aim angle from relative mouse movement
   * Uses tangent-based calculation so aiming feels natural at all positions
   * @param deltaX - horizontal mouse movement (pixels, right is positive)
   * @param deltaY - vertical mouse movement (pixels, down is positive)
   * @param sensitivity - how fast the aim moves (radians per pixel)
   */
  updateAimFromMouseDelta(
    deltaX: number,
    deltaY: number,
    sensitivity = 0.005
  ): void {
    // Calculate tangent direction at current aim position
    // Tangent points in the direction of increasing angle (clockwise)
    const tangentX = Math.cos(this.shipAimAngle);
    const tangentY = Math.sin(this.shipAimAngle);

    // Project mouse movement onto tangent to get angle change
    const deltaAngle = (deltaX * tangentX + deltaY * tangentY) * sensitivity;

    this.shipAimAngle += deltaAngle;

    // Normalize to -PI to PI
    while (this.shipAimAngle > Math.PI) this.shipAimAngle -= Math.PI * 2;
    while (this.shipAimAngle < -Math.PI) this.shipAimAngle += Math.PI * 2;
  }

  getAimAngle(): number {
    return this.shipAimAngle;
  }

  /**
   * Try to shoot bullets. Respects cooldown.
   * @returns true if bullets were spawned
   */
  shoot(): boolean {
    // Check cooldown
    if (this.shootCooldownTimer > 0) {
      return false;
    }

    // Reset cooldown (convert from ticks to seconds)
    this.shootCooldownTimer =
      DEFAULT_GAMEPLAY.projectileCooldown / GAME_CONST.TICK_RATE;

    // Ship is at (0, 0, 1) in world space (normalized unit vector)
    const shipWorldPosition = new THREE.Vector3(0, 0, 1);

    // Calculate aim direction in world space (on the XY tangent plane)
    // aimAngle: 0 = forward (-Y), positive = clockwise
    const aimX = Math.sin(this.shipAimAngle);
    const aimY = -Math.cos(this.shipAimAngle);
    const aimWorldDirection = new THREE.Vector3(aimX, aimY, 0).normalize();

    // Spawn bullets (spread/count from GameConfig)
    this.stage.bullets.spawnSpread(shipWorldPosition, aimWorldDirection);

    return true;
  }

  // ========================================================================
  // Collision Detection
  // ========================================================================

  /**
   * Check and handle all collisions
   * Transforms bullets from world space to planet space for collision detection
   */
  private checkCollisions(): void {
    // Check bullet-asteroid collisions
    // Pass planetQuaternion to transform bullets from world to planet space
    const bulletCollisions =
      this.stage.collisionSystem.checkBulletAsteroidCollisions(
        this.stage.bullets,
        this.stage.asteroids,
        this.planetQuaternion
      );

    // Handle bullet collisions
    for (const collision of bulletCollisions) {
      // Remove the bullet (bulletId always exists for bullet-asteroid collisions)
      this.stage.bullets.remove(collision.bulletId!);

      // Mark asteroid as hit - will turn red and break after delay
      this.stage.asteroids.markAsHit(
        collision.asteroidId,
        GAMEPLAY_CONST.HIT_DELAY_SEC
      );
    }

    // Check ship-asteroid collisions (only if still alive)
    if (!this.isGameOver) {
      // Ship is at initial position in world space (normalized unit vector)
      const { x, y, z } = GAME_CONST.SHIP_INITIAL_POS;
      const shipWorldPosition = new THREE.Vector3(x, y, z);

      const shipCollisions =
        this.stage.collisionSystem.checkShipAsteroidCollisions(
          shipWorldPosition,
          this.stage.asteroids,
          this.planetQuaternion
        );

      // Handle first ship collision (game over)
      if (shipCollisions.length > 0) {
        this.handleShipCollision();
      }
    }
  }

  /**
   * Handle ship collision - trigger game over
   */
  private handleShipCollision(): void {
    this.isGameOver = true;
    this.gameOverScreen.show();
  }

  // ========================================================================
  // Render Loop
  // ========================================================================
  start(): void {
    if (this.animationId !== null) return;
    this.lastTime = performance.now();

    const animate = (currentTime: number): void => {
      this.animationId = requestAnimationFrame(animate);

      // Calculate delta time in seconds
      const deltaTime = (currentTime - this.lastTime) / 1000;
      this.lastTime = currentTime;

      // Skip game updates if game is over
      if (!this.isGameOver) {
        // Update cooldown timer
        if (this.shootCooldownTimer > 0) {
          this.shootCooldownTimer -= deltaTime;
        }

        // Continuous shooting while mouse is held
        if (this.mousePressed && this.shootCooldownTimer <= 0) {
          this.shoot();
        }

        // Update local movement (only when not receiving server state)
        if (!this.lastState) {
          this.updateLocalMovement(deltaTime);
        }

        // Update game objects
        this.stage.update(deltaTime, this.camera.position);

        // Update bullets (needs camera position for shader)
        this.stage.bullets.setCameraPosition(this.camera.position);
        this.stage.updateBullets(deltaTime);

        // Check collisions and handle them
        this.checkCollisions();
      } else {
        // Still update world for force field shader even when game over
        this.stage.world.update(this.camera.position);
      }

      this.render();
    };

    animate(performance.now());
  }

  stop(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  private updateLocalMovement(deltaTime: number): void {
    // Movement speed in radians per second (convert from rad/tick to rad/sec)
    const speed = GAME_CONST.SHIP_SPEED * GAME_CONST.TICK_RATE;

    // Check if any movement input is active
    const hasInput =
      this.currentInput.forward ||
      this.currentInput.backward ||
      this.currentInput.left ||
      this.currentInput.right;

    if (hasInput) {
      // ====================================================================
      // Calculate target ship direction from WASD input
      // ====================================================================
      let inputX = 0; // Left/right component
      let inputY = 0; // Forward/backward component

      if (this.currentInput.forward) inputY -= 1;
      if (this.currentInput.backward) inputY += 1;
      if (this.currentInput.left) inputX += 1;
      if (this.currentInput.right) inputX -= 1;

      // Calculate target direction angle from input vector
      // 0 = forward (-Y in ship space), PI/2 = right (+X), etc.
      if (inputX !== 0 || inputY !== 0) {
        this.targetShipDirection = Math.atan2(inputX, inputY);
      }

      // ====================================================================
      // Quaternion-based movement (no gimbal lock, smooth pole crossing)
      // ====================================================================
      // We rotate the planet quaternion based on input.
      // The ship position (unit vector) is rotated inversely to track
      // where the ship "actually" is on the planet surface.

      // Calculate rotation angles for this frame
      let pitchAngle = 0; // Forward/backward (rotate around X)
      let yawAngle = 0; // Left/right (rotate around Y)

      if (this.currentInput.forward) pitchAngle += speed * deltaTime;
      if (this.currentInput.backward) pitchAngle -= speed * deltaTime;
      if (this.currentInput.left) yawAngle += speed * deltaTime;
      if (this.currentInput.right) yawAngle -= speed * deltaTime;

      // Create rotation quaternions for pitch and yaw
      // Pitch: rotate around X-axis (forward/backward movement)
      if (pitchAngle !== 0) {
        this._tempQuat.setFromAxisAngle(this._WORLD_X_AXIS, pitchAngle);
        this.planetQuaternion.premultiply(this._tempQuat);

        // Rotate ship position inversely (ship moves opposite to planet rotation)
        this._tempQuat.invert();
        this.shipPosition.applyQuaternion(this._tempQuat);
      }

      // Yaw: rotate around Y-axis (left/right movement)
      if (yawAngle !== 0) {
        this._tempQuat.setFromAxisAngle(this._WORLD_Y_AXIS, yawAngle);
        this.planetQuaternion.premultiply(this._tempQuat);

        // Rotate ship position inversely
        this._tempQuat.invert();
        this.shipPosition.applyQuaternion(this._tempQuat);
      }

      // Normalize to prevent drift from floating point errors
      this.planetQuaternion.normalize();
      this.shipPosition.normalize();

      // Apply planet rotation to the visual
      this.stage.world.group.quaternion.copy(this.planetQuaternion);
    }

    // ====================================================================
    // Lerp ship direction toward target (always, even without input)
    // ====================================================================
    this.stage.ship.lerpDirection(this.targetShipDirection, deltaTime);

    // Update ship visuals
    this.updateShipVisuals();
  }

  // ========================================================================
  // Ship Visual Updates
  // ========================================================================
  private updateShipVisuals(): void {
    // Create a ShipState from current quaternion-based state
    // Convert unit vector position to spherical for compatibility
    const spherical = this.unitVectorToSpherical(this.shipPosition);

    this.stage.ship.updateFromState(
      {
        position: spherical,
        aimAngle: this.shipAimAngle,
        lives: this.shipLives,
        invincible: this.shipInvincible,
        invincibleTicks: 0,
        cooldownLevel: 0,
        rayCountLevel: 0,
      },
      this.stage.ship.getCurrentDirectionAngle(),
      this.shipAimAngle
    );
  }

  // ========================================================================
  // Coordinate Conversion Utilities
  // ========================================================================

  /**
   * Convert unit vector (x, y, z) to spherical coordinates (phi, theta)
   * phi: polar angle from Y-axis (0 to π)
   * theta: azimuthal angle in XZ plane (0 to 2π)
   */
  private unitVectorToSpherical(v: THREE.Vector3): {
    phi: number;
    theta: number;
  } {
    // phi = angle from +Y axis = acos(y)
    const phi = Math.acos(Math.max(-1, Math.min(1, v.y)));

    // theta = angle in XZ plane from +X axis = atan2(z, x)
    // Adjust to match our coordinate system where theta=PI/2 is +Z
    let theta = Math.atan2(v.z, v.x);
    if (theta < 0) theta += Math.PI * 2;

    return { phi, theta };
  }

  /**
   * Convert spherical coordinates to unit vector
   */
  private sphericalToUnitVector(phi: number, theta: number): THREE.Vector3 {
    return new THREE.Vector3(
      Math.sin(phi) * Math.cos(theta),
      Math.cos(phi),
      Math.sin(phi) * Math.sin(theta)
    );
  }

  /**
   * Get current ship position as spherical coordinates (for debug GUI)
   */
  getShipSpherical(): { phi: number; theta: number } {
    return this.unitVectorToSpherical(this.shipPosition);
  }

  render(): void {
    this.webglRenderer.render(this.scene, this.camera);
  }

  // ========================================================================
  // Resize Handling
  // ========================================================================
  private handleResize(): void {
    const canvas = this.webglRenderer.domElement;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    if (canvas.width !== width || canvas.height !== height) {
      this.webglRenderer.setSize(width, height, false);
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
    }
  }

  // ========================================================================
  // Getters
  // ========================================================================
  getCamera(): THREE.PerspectiveCamera {
    return this.camera;
  }

  getScene(): THREE.Scene {
    return this.scene;
  }

  // ========================================================================
  // Cleanup
  // ========================================================================
  dispose(): void {
    this.stop();
    window.removeEventListener("resize", this.handleResize);
    window.removeEventListener("keydown", this.handleKeyPress);

    this.gameOverScreen.dispose();
    this.stage.dispose();
    this.webglRenderer.dispose();
  }

  // ========================================================================
  // Game Over / Restart
  // ========================================================================

  /**
   * Restart the game - reset all state and respawn asteroids
   */
  restart(): void {
    // Clear game over state
    this.isGameOver = false;

    // Hide game over screen
    this.gameOverScreen.hide();

    // Reset all game state
    this.initializeGameState();
  }
}
