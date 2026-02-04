import {
  DEFAULT_CONFIG,
  DEFAULT_RENDERER_CONFIG,
  DEFAULT_BULLET_CONFIG,
  type GameState,
  type GameConfig,
  type RendererConfig,
  type BulletConfig,
  type ShipState,
  type InputState,
} from "@ft/supercluster";
import * as THREE from "three";

import { AsteroidRenderer } from "./Asteroid";
import { BulletRenderer } from "./Bullet";
import { CollisionSystem } from "./CollisionSystem";
import { PlanetRenderer } from "./Planet";
import { ShipRenderer } from "./Ship";

// ============================================================================
// Game Renderer
// Main rendering class that manages all visual elements
//
// ARCHITECTURE:
// - Ship: Fixed at (0,0,gameSphereRadius) in world space, planet rotates under it
// - Bullets: World space (scene children) - absolute velocity independent of ship movement
// - Asteroids: Planet local space (planet children) - rotate with planet
// - Collisions: Transform bullets from world→planet space for detection
//
// This architecture ensures bullets always travel at absolute speed regardless
// of ship movement direction, fixing the reference frame issue where bullets
// appeared slower when moving in the same direction as the ship.
// ============================================================================
export class GameRenderer {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;

  private planet: PlanetRenderer;
  private ship: ShipRenderer;
  private asteroids: AsteroidRenderer;
  private bullets: BulletRenderer;
  private collisionSystem: CollisionSystem;

  private config: GameConfig;
  private rendererConfig: RendererConfig;
  private bulletConfig: BulletConfig;

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
  // Initial position: (0, 0, 1) = front of sphere, in front of camera
  private shipPosition = new THREE.Vector3(0, 0, 1);

  // Ship direction and aim angles
  private targetShipDirection = 0; // Where ship tip should point (from WASD)
  private shipAimAngle = 0; // Where aim dot is (from mouse)
  private shipLives = 3;
  private shipInvincible = false;

  // Current input state
  private currentInput: InputState = {
    forward: false,
    backward: false,
    left: false,
    right: false,
  };

  // Reusable objects for movement calculations (avoid GC pressure)
  private readonly _pitchAxis = new THREE.Vector3(1, 0, 0); // X-axis (forward/backward)
  private readonly _yawAxis = new THREE.Vector3(0, 1, 0); // Y-axis (left/right)
  private readonly _tempQuat = new THREE.Quaternion();

  // Shooting state
  private shootCooldownTimer = 0; // Time until next shot allowed
  private mousePressed = false; // Is mouse button currently held down

  constructor(
    canvas: HTMLCanvasElement,
    config: GameConfig = { ...DEFAULT_CONFIG },
    rendererConfig: RendererConfig = { ...DEFAULT_RENDERER_CONFIG },
    bulletConfig: BulletConfig = { ...DEFAULT_BULLET_CONFIG }
  ) {
    this.config = config;
    this.rendererConfig = rendererConfig;
    this.bulletConfig = bulletConfig;

    // Setup WebGL renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, canvas });
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Create scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x111122);

    // Create camera
    // Position camera behind and above ship for a good viewing angle
    // Ship will appear in lower-center of screen, planet curves away
    this.camera = new THREE.PerspectiveCamera(
      60,
      canvas.clientWidth / canvas.clientHeight,
      0.1,
      1000
    );
    this.setupCamera();

    // Add lighting
    this.addLights();

    // Create planet
    this.planet = new PlanetRenderer(this.camera, config, rendererConfig);
    this.scene.add(this.planet.group);

    // Create ship (now includes aim dot)
    this.ship = new ShipRenderer(config, rendererConfig);
    this.scene.add(this.ship.group);

    // Create asteroids (as children of planet so they rotate with it)
    this.asteroids = new AsteroidRenderer(config);
    this.planet.group.add(this.asteroids.group);

    // Create bullets in WORLD SPACE (not planet children)
    // This ensures bullets travel at absolute speed regardless of ship movement
    this.bullets = new BulletRenderer(config, bulletConfig);
    this.scene.add(this.bullets.group);

    // Create collision system
    this.collisionSystem = new CollisionSystem(config);

    // Spawn initial asteroids: 12 size 1, 8 size 2, 4 size 3, 2 size 4
    this.asteroids.spawnMultiple([
      1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, // 12 size 1
      2, 2, 2, 2, 2, 2, 2, 2, // 8 size 2
      3, 3, 3, 3, // 4 size 3
      4, 4, // 2 size 4
    ]);

    // Initialize ship facing camera (on +Z side of sphere)
    // phi = PI/2 (equator), theta = PI/2 (facing +Z)
    // This puts ship at (0, 0, radius) - directly in front of camera
    this.ship.updateFromState(
      {
        position: { phi: Math.PI / 2, theta: Math.PI / 2 },
        aimAngle: 0,
        lives: 3,
        invincible: false,
      },
      0, // direction angle
      0 // aim angle
    );

    // Handle window resize
    this.handleResize = this.handleResize.bind(this);
    window.addEventListener("resize", this.handleResize);
  }

  private addLights(): void {
    const ambient = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambient);

    const directional = new THREE.DirectionalLight(0xffffff, 0.8);
    directional.position.set(50, 50, 100);
    this.scene.add(directional);
  }

  private setupCamera(): void {
    // Camera positioned directly behind the ship, looking at sphere center
    // Ship is always visually at (0, 0, gameSphereRadius) - front of sphere
    // Camera on the Z axis for a straight view with planet centered
    const r = this.config.gameSphereRadius;

    // Position: directly behind the ship on Z axis
    const cameraDistance = r * 2;

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
      this._pitchAxis,
      -(state.ship.position.phi - Math.PI / 2)
    );
    this.planetQuaternion.multiply(this._tempQuat);
    this._tempQuat.setFromAxisAngle(
      this._yawAxis,
      state.ship.position.theta - Math.PI / 2
    );
    this.planetQuaternion.multiply(this._tempQuat);

    // Apply to visuals
    this.planet.group.quaternion.copy(this.planetQuaternion);
    this.ship.updateFromState(
      state.ship,
      this.ship.getCurrentDirectionAngle(),
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
    this.shootCooldownTimer = this.config.projectile.cooldown / this.config.tickRate;

    // Ship is at (0, 0, 1) in world space (normalized unit vector)
    const shipWorldPosition = new THREE.Vector3(0, 0, 1);

    // Calculate aim direction in world space (on the XY tangent plane)
    // aimAngle: 0 = forward (-Y), positive = clockwise
    const aimX = Math.sin(this.shipAimAngle);
    const aimY = -Math.cos(this.shipAimAngle);
    const aimWorldDirection = new THREE.Vector3(aimX, aimY, 0).normalize();

    // Spawn bullets (spread/count from GameConfig)
    this.bullets.spawnSpread(shipWorldPosition, aimWorldDirection);

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
    const collisions = this.collisionSystem.checkBulletAsteroidCollisions(
      this.bullets,
      this.asteroids,
      this.planetQuaternion
    );

    // Handle each collision
    for (const collision of collisions) {
      // Remove the bullet
      this.bullets.remove(collision.bulletId);

      // Mark asteroid as hit - will turn red and break after 0.5s delay
      this.asteroids.markAsHit(collision.asteroidId, 0.5);
    }
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

      // Update asteroids (rotation and movement)
      this.asteroids.update(deltaTime);

      // Update bullets (movement and lifetime)
      // Bullets are in world space, so use camera world position directly
      this.bullets.setCameraPosition(this.camera.position);
      this.bullets.update(deltaTime);

      // Check collisions and handle them
      this.checkCollisions();

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
    // Movement speed in radians per second
    const speed = this.config.shipSpeed * this.config.tickRate; // Convert from per-tick to per-second

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
        this._tempQuat.setFromAxisAngle(this._pitchAxis, pitchAngle);
        this.planetQuaternion.premultiply(this._tempQuat);

        // Rotate ship position inversely (ship moves opposite to planet rotation)
        this._tempQuat.invert();
        this.shipPosition.applyQuaternion(this._tempQuat);
      }

      // Yaw: rotate around Y-axis (left/right movement)
      if (yawAngle !== 0) {
        this._tempQuat.setFromAxisAngle(this._yawAxis, yawAngle);
        this.planetQuaternion.premultiply(this._tempQuat);

        // Rotate ship position inversely
        this._tempQuat.invert();
        this.shipPosition.applyQuaternion(this._tempQuat);
      }

      // Normalize to prevent drift from floating point errors
      this.planetQuaternion.normalize();
      this.shipPosition.normalize();

      // Apply planet rotation to the visual
      this.planet.group.quaternion.copy(this.planetQuaternion);
    }

    // ====================================================================
    // Lerp ship direction toward target (always, even without input)
    // ====================================================================
    this.ship.lerpDirection(this.targetShipDirection, deltaTime);

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

    this.ship.updateFromState(
      {
        position: spherical,
        aimAngle: this.shipAimAngle,
        lives: this.shipLives,
        invincible: this.shipInvincible,
      },
      this.ship.getCurrentDirectionAngle(),
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
    this.renderer.render(this.scene, this.camera);
  }

  // ========================================================================
  // Configuration
  // ========================================================================
  updateConfig(config: GameConfig): void {
    this.config = config;
    this.planet.updateConfig(config);
    this.ship.updateConfig(config);
    this.asteroids.updateConfig(config);
    this.bullets.updateGameConfig(config);
    this.collisionSystem.updateConfig(config);

    // Update camera position when sphere radius changes
    this.setupCamera();
  }

  /**
   * Update only the game sphere radius (affects gameplay)
   * Preserves all other config values
   */
  setGameSphereRadius(radius: number): void {
    this.config.gameSphereRadius = radius;
    this.planet.updateConfig(this.config);
    this.ship.updateConfig(this.config);
    this.asteroids.updateConfig(this.config);
    this.bullets.updateGameConfig(this.config);
    this.collisionSystem.updateConfig(this.config);
    this.setupCamera();
  }

  /**
   * Update only planet visual radius (cosmetic only, doesn't affect gameplay)
   */
  setPlanetRadius(radius: number): void {
    this.config.planetRadius = radius;
    this.planet.setPlanetRadius(radius);
  }

  /**
   * Update only force field visual radius (cosmetic only, doesn't affect gameplay)
   */
  setForceFieldRadius(radius: number): void {
    this.config.forceFieldRadius = radius;
    this.planet.setForceFieldRadius(radius);
  }

  getConfig(): GameConfig {
    return { ...this.config };
  }

  getRendererConfig(): RendererConfig {
    return { ...this.rendererConfig };
  }

  updateRendererConfig(rendererConfig: RendererConfig): void {
    this.rendererConfig = rendererConfig;
    this.planet.updateRendererConfig(rendererConfig);
  }

  // Convenience methods for common config changes
  setAxesVisible(visible: boolean): void {
    this.planet.setAxesVisible(visible);
  }

  setForceFieldOpacity(front: number, back: number): void {
    this.planet.setForceFieldOpacity(front, back);
  }

  setForceFieldDetail(detail: number): void {
    this.planet.setForceFieldDetail(detail);
  }

  setForceFieldColor(color: number): void {
    this.planet.setForceFieldColor(color);
  }

  getForceFieldDetail(): number {
    return this.planet.getForceFieldDetail();
  }

  getForceFieldColor(): number {
    return this.planet.getForceFieldColor();
  }

  // Ship rotation and aim dot controls
  setShipRotationSpeed(speed: number): void {
    this.ship.setRotationSpeed(speed);
  }

  setAimDotColor(color: number): void {
    this.ship.setAimDotColor(color);
  }

  setAimDotSize(size: number): void {
    this.ship.setAimDotSize(size);
  }

  setAimDotOrbitRadius(radius: number): void {
    this.ship.setAimDotOrbitRadius(radius);
  }

  // Debug method to update ship state directly (for lil-gui controls)
  // Sets the planet quaternion from spherical coordinates
  updateShipDebug(state: ShipState): void {
    // Update ship position from spherical coordinates
    this.shipPosition.copy(
      this.sphericalToUnitVector(state.position.phi, state.position.theta)
    );
    this.shipAimAngle = state.aimAngle;

    // Rebuild planet quaternion from spherical position
    // This creates the rotation that would place the ship at (phi, theta)
    this.planetQuaternion.identity();

    // Rotate to match phi (pitch around X)
    this._tempQuat.setFromAxisAngle(
      this._pitchAxis,
      -(state.position.phi - Math.PI / 2)
    );
    this.planetQuaternion.multiply(this._tempQuat);

    // Rotate to match theta (yaw around Y)
    this._tempQuat.setFromAxisAngle(
      this._yawAxis,
      state.position.theta - Math.PI / 2
    );
    this.planetQuaternion.multiply(this._tempQuat);

    // Apply to planet visual
    this.planet.group.quaternion.copy(this.planetQuaternion);

    // Update ship visual
    this.ship.updateFromState(
      state,
      this.ship.getCurrentDirectionAngle(),
      this.shipAimAngle
    );
  }

  // ========================================================================
  // Resize Handling
  // ========================================================================
  private handleResize(): void {
    const canvas = this.renderer.domElement;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    if (canvas.width !== width || canvas.height !== height) {
      this.renderer.setSize(width, height, false);
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

    this.planet.dispose();
    this.ship.dispose();
    this.asteroids.dispose();
    this.bullets.dispose();
    this.renderer.dispose();
  }

  // ========================================================================
  // Asteroid Controls
  // ========================================================================
  getAsteroidRenderer(): AsteroidRenderer {
    return this.asteroids;
  }

  // ========================================================================
  // Bullet Controls
  // ========================================================================
  getBulletRenderer(): BulletRenderer {
    return this.bullets;
  }

  getBulletCount(): number {
    return this.bullets.getCount();
  }

  getBulletConfig(): BulletConfig {
    return this.bulletConfig;
  }

  /**
   * Update bullet visual config (color, maxBullets)
   */
  updateBulletConfig(config: Partial<BulletConfig>): void {
    Object.assign(this.bulletConfig, config);
    this.bullets.updateBulletConfig(this.bulletConfig);
  }

  /**
   * Update projectile gameplay mechanics (speed, lifetime, cooldown, etc.)
   * These are server-authoritative and affect gameplay balance
   */
  updateProjectileConfig(config: Partial<GameConfig['projectile']>): void {
    Object.assign(this.config.projectile, config);
    this.bullets.updateGameConfig(this.config);
  }

  setBulletColor(color: number): void {
    this.bullets.setColor(color);
    this.bulletConfig.color = color;
  }

  clearBullets(): void {
    this.bullets.clear();
  }

  // ========================================================================
  // Asteroid Controls
  // ========================================================================
  getAsteroidCount(): number {
    return this.asteroids.getCount();
  }
}
