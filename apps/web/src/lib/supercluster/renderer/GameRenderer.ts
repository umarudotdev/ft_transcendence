import {
  GAME_CONST,
  GAMEPLAY_CONST,
  DEFAULT_GAMEPLAY,
  getTargetDirectionFromInput,
  stepShipOnSphere,
  type GameState,
  type InputState,
  type Vec3,
} from "@ft/supercluster";
import * as THREE from "three";

import { RENDERER_CONST } from "../constants/renderer";
import { GameOverScreen } from "./GameOverScreen";
import { GameStage } from "./GameStage";
import { InputController } from "./InputController";

// ============================================================================
// Game Renderer
// Orchestrates rendering and game loop
//
// ARCHITECTURE:
// - Ship: Fixed at (0,0,gameSphereRadius) in world space, planet rotates under it
// - Projectiles: World space (scene children) - absolute velocity independent of ship movement
// - Asteroids: Planet local space (planet children) - rotate with planet
// - Collisions: Transform projectiles from world→planet space for detection
//
// RESPONSIBILITIES:
// - Three.js infrastructure (renderer, scene, camera, lights)
// - Render loop (start/stop, animation frame)
// - Game logic (movement, shooting, collisions)
// - Input handling (delegates to InputController)
//
// DELEGATES TO:
// - InputController: Input state management (single source of truth)
// - GameStage: Game objects (world, ship, asteroids, projectiles)
// - GameOverScreen: Game over visuals (explosion, DOM overlay)
// ============================================================================
export class GameRenderer {
  private mechanicsController: "client" | "server" = "client";

  // Three.js infrastructure (owned by GameRenderer)
  private webglRenderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private canvas: HTMLCanvasElement;

  // Game objects container
  private stage: GameStage;

  // Game over screen
  private gameOverScreen: GameOverScreen;

  // Input controller (single source of truth for input state)
  private input: InputController;

  // Animation state
  private animationId: number | null = null;
  private lastState: GameState | null = null;
  private lastTime: number = 0; //previous frame timestamp in milliseconds
  private simulationAccumulator = 0; // accumulated seconds of sim time not yet processed
  private readonly fixedSimulationStep = 1 / GAME_CONST.TICK_RATE; // sim step size in seconds (at 60 Hz, ~0.0167 s)
  private readonly maxFrameDelta = 0.1; // clamp each frame delta to 100 ms to avoid huge catch-up bursts
  private readonly maxSimulationSteps = 8; // max fixed sim steps processed in one rendered frame

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
  private readonly initialShipPosition = new THREE.Vector3(
    GAME_CONST.SHIP_INITIAL_POS.x,
    GAME_CONST.SHIP_INITIAL_POS.y,
    GAME_CONST.SHIP_INITIAL_POS.z
  ).normalize();

  // Ship direction (visual only - not sent to server)
  private targetShipDirection = 0; // Where ship tip should point (from WASD)

  // Ship state (will come from server in future)
  private shipLives = DEFAULT_GAMEPLAY.shipLives;
  private shipInvincible = DEFAULT_GAMEPLAY.shipInvincible;

  // Reusable objects for movement calculations (avoid GC pressure)
  private readonly _tempQuat = new THREE.Quaternion();

  // Shooting state
  private shootCooldownTimer = 0; // Time until next shot allowed

  // Game state
  private isGameOver = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;

    // Create input controller (single source of truth for input)
    this.input = new InputController();

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
    this.mechanicsController = "client";

    // Reset ship state
    this.targetShipDirection = 0;
    this.shipLives = DEFAULT_GAMEPLAY.shipLives;
    this.shipInvincible = DEFAULT_GAMEPLAY.shipInvincible;

    // Reset input and shooting state
    this.input.reset();
    this.shootCooldownTimer = 0;
    this.simulationAccumulator = 0;
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
    this.mechanicsController = "server";

    // Update internal state from server
    this.shipPosition
      .set(state.ship.position.x, state.ship.position.y, state.ship.position.z)
      .normalize();
    this.input.setAimAngle(state.ship.aimAngle);
    this.shipLives = state.ship.lives;
    this.shipInvincible = state.ship.invincible;
    const stateDirectionLengthSq =
      state.ship.direction.x * state.ship.direction.x +
      state.ship.direction.y * state.ship.direction.y +
      state.ship.direction.z * state.ship.direction.z;
    if (stateDirectionLengthSq > 1e-8) {
      this.targetShipDirection = Math.atan2(
        state.ship.direction.x,
        -state.ship.direction.y
      );
    }

    // Rebuild planet quaternion from authoritative ship position.
    // Ship is fixed at initial world position while the planet rotates beneath it.
    this.planetQuaternion.setFromUnitVectors(
      this.initialShipPosition,
      this.shipPosition
    );

    // Apply to visuals
    this.stage.world.group.quaternion.copy(this.planetQuaternion);
    this.stage.ship.setCurrentDirectionAngle(this.targetShipDirection);
    this.stage.ship.updateFromState(
      state.ship,
      this.targetShipDirection,
      this.input.aimAngle
    );

    // TODO: Update projectiles
    // TODO: Update enemies
  }

  // ========================================================================
  // Input Handling (delegates to InputController)
  // ========================================================================
  setInput(input: InputState): void {
    this.input.setKeys(input);
  }

  setAimAngle(angle: number): void {
    this.input.setAimAngle(angle);
    this.updateShipVisuals();
  }

  setMousePressed(pressed: boolean): void {
    this.input.setFirePressed(pressed);
  }

  getAimAngle(): number {
    return this.input.aimAngle;
  }

  /**
   * Try to shoot projectiles. Respects cooldown.
   * @returns true if projectiles were spawned
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
    const aimAngle = this.input.aimAngle;
    const aimX = Math.sin(aimAngle);
    const aimY = -Math.cos(aimAngle);
    const aimWorldDirection = new THREE.Vector3(aimX, aimY, 0).normalize();

    // Spawn projectiles (spread/count from GameConfig)
    this.stage.projectiles.spawnSpread(shipWorldPosition, aimWorldDirection);

    return true;
  }

  // ========================================================================
  // Collision Detection
  // ========================================================================

  /**
   * Check and handle all collisions
   * Transforms projectiles from world space to planet space for collision detection
   */
  private checkCollisions(): void {
    // Check projectile-asteroid collisions
    // Pass planetQuaternion to transform projectiles from world to planet space
    const projectileCollisions =
      this.stage.collisionSystem.checkProjectileAsteroidCollisions(
        this.stage.projectiles,
        this.stage.asteroids,
        this.planetQuaternion
      );

    // Handle projectile collisions
    for (const collision of projectileCollisions) {
      // Remove the projectile (projectileId always exists for projectile-asteroid collisions)
      this.stage.projectiles.remove(collision.projectileId!);

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
    this.simulationAccumulator = 0;

    const animate = (currentTime: number): void => {
      this.animationId = requestAnimationFrame(animate);

      // Calculate frame delta and clamp to avoid spiral-of-death after tab switches.
      const rawDeltaTime = (currentTime - this.lastTime) / 1000;
      const deltaTime = Math.min(rawDeltaTime, this.maxFrameDelta);
      this.lastTime = currentTime;

      // Skip game updates if game is over
      if (!this.isGameOver) {
        // Run fixed-step simulation to reduce tunneling on frame spikes.
        this.simulationAccumulator += deltaTime;
        let stepCount = 0;

        while (
          this.simulationAccumulator >= this.fixedSimulationStep &&
          stepCount < this.maxSimulationSteps
        ) {
          this.updateSimulation(this.fixedSimulationStep);
          this.simulationAccumulator -= this.fixedSimulationStep;
          stepCount++;
        }

        // Drop leftover accumulated time if we hit step cap.
        if (stepCount === this.maxSimulationSteps) {
          this.simulationAccumulator = 0;
        }
      } else {
        // Still update world for force field shader even when game over
        this.stage.world.update(this.camera.position);
      }

      this.render();
    };

    animate(performance.now());
  }

  private updateSimulation(deltaTime: number): void {
    if (this.lastState) {
      this.mechanicsController = "server";
      // Phase 0 isolation:
      // when authoritative snapshots are present, keep renderer visual updates only.
      this.stage.world.update(this.camera.position);
      this.stage.projectiles.setCameraPosition(this.camera.position);
      return;
    }
    this.mechanicsController = "client";

    // Update cooldown timer
    if (this.shootCooldownTimer > 0) {
      this.shootCooldownTimer -= deltaTime;
    }

    // Continuous shooting while mouse is held
    if (this.input.firePressed && this.shootCooldownTimer <= 0) {
      this.shoot();
    }

    // Update local movement
    this.updateLocalMovement(deltaTime);

    // Update game objects
    this.stage.update(deltaTime, this.camera.position);

    // Update projectiles (needs camera position for shader)
    this.stage.projectiles.setCameraPosition(this.camera.position);
    this.stage.updateProjectiles(deltaTime);

    // Check collisions and handle them
    this.checkCollisions();
  }

  stop(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  private updateLocalMovement(deltaTime: number): void {
    const deltaTicks = deltaTime * GAME_CONST.TICK_RATE;

    // Read input from InputController
    const keys = this.input.keys;

    const targetDirection = getTargetDirectionFromInput(keys);
    if (targetDirection !== null) {
      this.targetShipDirection = targetDirection;
    }

    if (this.input.hasMovementInput) {
      const moved = stepShipOnSphere(
        this.planetQuaternion,
        this.shipPosition,
        keys,
        deltaTicks,
        GAME_CONST.SHIP_SPEED,
        this._tempQuat
      );

      if (moved) {
        // Apply updated world rotation to visual world group.
        this.stage.world.group.quaternion.copy(this.planetQuaternion);
      }
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
    const aimAngle = this.input.aimAngle;

    this.stage.ship.updateFromState(
      {
        position: {
          x: this.shipPosition.x,
          y: this.shipPosition.y,
          z: this.shipPosition.z,
        },
        direction: {
          x: Math.sin(this.targetShipDirection),
          y: -Math.cos(this.targetShipDirection),
          z: 0,
        },
        aimAngle: aimAngle,
        lives: this.shipLives,
        invincible: this.shipInvincible,
        invincibleTicks: 0,
        cooldownLevel: 0,
        rayCountLevel: 0,
      },
      this.stage.ship.getCurrentDirectionAngle(),
      aimAngle
    );
  }

  /**
   * Get current ship position as a unit vector.
   */
  getShipPosition(): Vec3 {
    return {
      x: this.shipPosition.x,
      y: this.shipPosition.y,
      z: this.shipPosition.z,
    };
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

  getMechanicsController(): "client" | "server" {
    return this.mechanicsController;
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
