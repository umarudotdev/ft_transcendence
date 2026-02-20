import {
  GAME_CONST,
  getTargetHeadingFromInput,
  type GameState,
  type InputState,
} from "@ft/supercluster";
import * as THREE from "three";

import { RENDERER_CONST } from "../constants/renderer";
import { copyVec3ToThree } from "../utils/three-conversions";
import { GameOverScreen } from "./GameOverScreen";
import { GameStage } from "./GameStage";
import { InputController } from "./InputController";

// ============================================================================
// Game Renderer
// Orchestrates rendering and game loop
//
// ARCHITECTURE:
// - Ship/Asteroids/Projectiles: snapshot-driven entities in world frame.
// - World group: identity (no ship-centric world rotation).
// - Camera: follows ship around origin while looking at center.
// - Collision: server authoritative (shared simulation frame), no render authority.
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
  private lastTime: number = 0; //previous frame timestamp in milliseconds
  private simulationAccumulator = 0; // accumulated seconds of sim time not yet processed
  private readonly fixedSimulationStep = 1 / GAME_CONST.TICK_RATE; // sim step size in seconds (at 60 Hz, ~0.0167 s)
  private readonly maxFrameDelta = 0.1; // clamp each frame delta to 100 ms to avoid huge catch-up bursts
  private readonly maxSimulationSteps = 8; // max fixed sim steps processed in one rendered frame

  // Ship position as unit vector on sphere surface (x² + y² + z² = 1)
  private shipPosition = new THREE.Vector3(
    GAME_CONST.SHIP_INITIAL_POS[0],
    GAME_CONST.SHIP_INITIAL_POS[1],
    GAME_CONST.SHIP_INITIAL_POS[2]
  );
  private shipDirection = new THREE.Vector3(0, 1, 0);

  // Ship heading angle (visual only - not part of authoritative state)
  private targetHeadingAngle = 0; // Where ship tip should point (from WASD)

  // Game state
  private isGameOver = false;
  private readonly cameraDistance =
    GAME_CONST.SPHERE_RADIUS * RENDERER_CONST.CAMERA_DIST_MULT;
  private readonly worldUp = new THREE.Vector3(0, 1, 0);
  private readonly worldRight = new THREE.Vector3(1, 0, 0);
  private readonly center = new THREE.Vector3(0, 0, 0);
  private readonly _v1 = new THREE.Vector3();
  private readonly _v2 = new THREE.Vector3();
  private readonly _v3 = new THREE.Vector3();
  private readonly _v4 = new THREE.Vector3();
  private readonly _v5 = new THREE.Vector3(0, 0, 1);

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
    // this.setupCamera();

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
    copyVec3ToThree(this.shipPosition, GAME_CONST.SHIP_INITIAL_POS);
    this.shipDirection.set(0, 1, 0);
    // this.stage.world.group.quaternion.identity();
    this.updateCameraFollow(this.shipPosition, this.shipDirection);

    // Reset ship visual input state
    this.targetHeadingAngle = 0;

    // Reset input and shooting state
    this.input.reset();
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

//   private setupCamera(): void {
//     this.updateCameraFollow(this.shipPosition, this.shipDirection);
//   }

  // ========================================================================
  // Game State Updates (from server)
  // ========================================================================
  updateState(state: GameState): void {
    const localShip = state.ships[0];

    // Update internal state from server
    if (localShip) {
      copyVec3ToThree(this.shipPosition, localShip.position).normalize();
      copyVec3ToThree(this.shipDirection, localShip.direction).normalize();
      this.input.setAimAngle(localShip.aimAngle);
    }

    // Apply to visuals
    if (localShip) {
      // this.stage.world.group.quaternion.identity();
      this.updateCameraFollow(this.shipPosition, this.shipDirection);
      const shipDirectionAngle = this.stage.ship.lerpDirection(
        this.targetHeadingAngle,
        this.fixedSimulationStep
      );
      this.stage.ship.updateFromState(
        localShip,
        shipDirectionAngle,
        this.input.aimAngle
      );
    }

    this.stage.projectiles.syncFromStates(state.projectiles);
    this.stage.asteroids.syncFromStates(state.asteroids);
  }

  // ========================================================================
  // Input Handling (delegates to InputController)
  // ========================================================================
  setInput(input: InputState): void {
    this.input.setKeys(input);
    const targetDirection = getTargetHeadingFromInput(input);
    if (targetDirection !== null) {
      this.targetHeadingAngle = targetDirection;
    }
  }

  setAimAngle(angle: number): void {
    this.input.setAimAngle(angle);
  }

  setMousePressed(pressed: boolean): void {
    this.input.setFirePressed(pressed);
  }

  getAimAngle(): number {
    return this.input.aimAngle;
  }

  /**
   * Shooting is authoritative on server runtime.
   */
  shoot(): boolean {
    return false;
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
    this.stage.update(deltaTime, this.camera.position);
  }

  private updateCameraFollow(
    shipPosition: THREE.Vector3,
    shipDirection: THREE.Vector3
  ): void {
    const normal = this._v1.copy(shipPosition).normalize();
    this.camera.position.copy(normal).multiplyScalar(this.cameraDistance);

    const view = this._v2.copy(this.center).sub(this.camera.position).normalize();
    const upCandidate = this._v3
      .copy(shipDirection)
      .sub(this._v4.copy(view).multiplyScalar(shipDirection.dot(view)));

    if (upCandidate.lengthSq() <= 1e-8) {
      const fallback = Math.abs(view.y) < 0.99 ? this.worldUp : this.worldRight;
      upCandidate
        .copy(fallback)
        .sub(this._v4.copy(view).multiplyScalar(fallback.dot(view)));
      if (upCandidate.lengthSq() <= 1e-8) {
        const fallback2 = Math.abs(view.z) < 0.99 ? this._v5 : this.worldRight;
        upCandidate
          .copy(fallback2)
          .sub(this._v4.copy(view).multiplyScalar(fallback2.dot(view)));
      }
    }

    this.camera.up.copy(upCandidate.normalize());
    this.camera.lookAt(this.center);
  }

  stop(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
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
