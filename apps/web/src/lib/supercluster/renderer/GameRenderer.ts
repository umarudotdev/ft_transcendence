import {
	DEFAULT_CONFIG,
	GAME_CONST,
	GAMEPLAY_CONST,
	DEFAULT_GAMEPLAY,
	createWaveArray,
	type GameState,
	type GameConfig,
	type InputState
} from '@ft/supercluster';
import * as THREE from 'three';

import { RENDERER_CONST } from '../constants/renderer';
import { AsteroidRenderer } from './Asteroid';
import { BulletRenderer } from './Bullet';
import { CollisionSystem } from './CollisionSystem';
import { PlanetRenderer } from './Planet';
import { ShipRenderer } from './Ship';

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
	// Basic Three.JS objects
	private renderer: THREE.WebGLRenderer;
	private scene: THREE.Scene;
	private camera: THREE.PerspectiveCamera;

	// Game objects
	private planet: PlanetRenderer;
	private ship: ShipRenderer;
	private asteroids: AsteroidRenderer;
	private bullets: BulletRenderer;
	private collisionSystem: CollisionSystem;

	// GUI-controlled projectile values only
	// TODO: Get rid of this. just for game calibration
	private config: GameConfig;

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
		right: false
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
	private explosionCircle: THREE.Mesh | null = null;
	private gameOverOverlay: HTMLDivElement | null = null;
	private canvas: HTMLCanvasElement;

	constructor(canvas: HTMLCanvasElement, config: GameConfig = { ...DEFAULT_CONFIG }) {
		this.canvas = canvas;
		this.config = config;

		// Setup WebGL renderer
		this.renderer = new THREE.WebGLRenderer({ antialias: true, canvas });
		this.renderer.setSize(canvas.clientWidth, canvas.clientHeight);
		this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

		// Create scene
		this.scene = new THREE.Scene();
		this.scene.background = new THREE.Color(RENDERER_CONST.SCENE_BG);

		// Create camera
		// Position camera behind and above ship for a good viewing angle
		// Ship will appear in lower-center of screen, planet curves away
		this.camera = new THREE.PerspectiveCamera(
			RENDERER_CONST.CAMERA_FOV,
			canvas.clientWidth / canvas.clientHeight,
			RENDERER_CONST.CAMERA_NEAR,
			RENDERER_CONST.CAMERA_FAR
		);
		this.setupCamera();

		// Add lighting
		this.addLights();

		// Create planet (uses GAME_CONST and RENDERER_CONST directly)
		this.planet = new PlanetRenderer(this.camera);
		this.scene.add(this.planet.group);

		// Create ship (uses GAME_CONST and RENDERER_CONST directly)
		this.ship = new ShipRenderer();
		this.scene.add(this.ship.group);

		// Create asteroids (as children of planet so they rotate with it)
		this.asteroids = new AsteroidRenderer();
		this.planet.group.add(this.asteroids.group);

		// Create bullets in WORLD SPACE (not planet children)
		// This ensures bullets travel at absolute speed regardless of ship movement
		this.bullets = new BulletRenderer(config);
		this.scene.add(this.bullets.group);

		// Create collision system (uses GAME_CONST directly)
		this.collisionSystem = new CollisionSystem();

		// Initialize game state (asteroids, ship position, input)
		this.initializeGameState();

		// Handle window resize
		this.handleResize = this.handleResize.bind(this);
		window.addEventListener('resize', this.handleResize);

		// Handle restart on Enter key
		this.handleKeyPress = this.handleKeyPress.bind(this);
		window.addEventListener('keydown', this.handleKeyPress);
	}

	/**
	 * Initialize/reset game state (asteroids, ship position, input)
	 * Called by both constructor and restart()
	 */
	private initializeGameState(): void {
		// Clear any existing asteroids and bullets
		this.asteroids.clear();
		this.bullets.clear();

		// Spawn initial asteroids using wave config
		this.asteroids.spawnMultiple(createWaveArray(DEFAULT_GAMEPLAY.asteroidWave));

		// Reset ship position to initial position
		const { x, y, z } = GAME_CONST.SHIP_INITIAL_POS;
		this.shipPosition.set(x, y, z);
		this.planetQuaternion.identity();
		this.planet.group.quaternion.copy(this.planetQuaternion);

		// Reset ship visual state
		this.targetShipDirection = 0;
		this.shipAimAngle = 0;
		this.shipLives = DEFAULT_GAMEPLAY.shipLives;
		this.shipInvincible = DEFAULT_GAMEPLAY.shipInvincible;

		this.ship.updateFromState(
			{
				position: { phi: Math.PI / 2, theta: Math.PI / 2 },
				aimAngle: 0,
				lives: DEFAULT_GAMEPLAY.shipLives,
				invincible: DEFAULT_GAMEPLAY.shipInvincible,
				invincibleTicks: 0,
				cooldownLevel: 0,
				rayCountLevel: 0
			},
			0,
			0
		);

		// Reset input state
		this.currentInput = {
			forward: false,
			backward: false,
			left: false,
			right: false
		};
		this.mousePressed = false;
		this.shootCooldownTimer = 0;
	}

	/**
	 * Handle keyboard input for restart
	 */
	private handleKeyPress(event: KeyboardEvent): void {
		if (event.key === 'Enter' && this.isGameOver) {
			this.restart();
		}
	}

	private addLights(): void {
		const ambient = new THREE.AmbientLight(0xffffff, RENDERER_CONST.AMB_LIGHT_INTENSITY);
		this.scene.add(ambient);

		const directional = new THREE.DirectionalLight(0xffffff, RENDERER_CONST.DIR_LIGHT_INTENSITY);
		const { x, y, z } = RENDERER_CONST.DIR_LIGHT_POS;
		directional.position.set(x, y, z);
		this.scene.add(directional);
	}

	private setupCamera(): void {
		// Camera positioned directly behind the ship, looking at sphere center
		// Ship is always visually at (0, 0, SPHERE_RADIUS) - front of sphere
		// Camera on the Z axis for a straight view with planet centered
		const cameraDistance = GAME_CONST.SPHERE_RADIUS * RENDERER_CONST.CAMERA_DIST_MULT;

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
			this.sphericalToUnitVector(state.ship.position.phi, state.ship.position.theta)
		);
		this.shipAimAngle = state.ship.aimAngle;
		this.shipLives = state.ship.lives;
		this.shipInvincible = state.ship.invincible;

		// Rebuild planet quaternion from server state
		this.planetQuaternion.identity();
		this._tempQuat.setFromAxisAngle(this._WORLD_X_AXIS, -(state.ship.position.phi - Math.PI / 2));
		this.planetQuaternion.multiply(this._tempQuat);
		this._tempQuat.setFromAxisAngle(this._WORLD_Y_AXIS, state.ship.position.theta - Math.PI / 2);
		this.planetQuaternion.multiply(this._tempQuat);

		// Apply to visuals
		this.planet.group.quaternion.copy(this.planetQuaternion);
		this.ship.updateFromState(state.ship, this.ship.getCurrentDirectionAngle(), this.shipAimAngle);

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
	updateAimFromMouseDelta(deltaX: number, deltaY: number, sensitivity = 0.005): void {
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
		this.shootCooldownTimer = this.config.projectile.cooldown / GAME_CONST.TICK_RATE;

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
		const bulletCollisions = this.collisionSystem.checkBulletAsteroidCollisions(
			this.bullets,
			this.asteroids,
			this.planetQuaternion
		);

		// Handle bullet collisions
		for (const collision of bulletCollisions) {
			// Remove the bullet (bulletId always exists for bullet-asteroid collisions)
			this.bullets.remove(collision.bulletId!);

			// Mark asteroid as hit - will turn red and break after delay
			this.asteroids.markAsHit(collision.asteroidId, GAMEPLAY_CONST.HIT_DELAY_SEC);
		}

		// Check ship-asteroid collisions (only if still alive)
		if (!this.isGameOver) {
			// Ship is at initial position in world space (normalized unit vector)
			const { x, y, z } = GAME_CONST.SHIP_INITIAL_POS;
			const shipWorldPosition = new THREE.Vector3(x, y, z);

			const shipCollisions = this.collisionSystem.checkShipAsteroidCollisions(
				shipWorldPosition,
				this.asteroids,
				this.planetQuaternion
			);

			// Handle first ship collision (game over)
			if (shipCollisions.length > 0) {
				this.handleShipCollision();
			}
		}
	}

	/**
	 * Handle ship collision - create explosion visual and trigger game over
	 */
	private handleShipCollision(): void {
		this.isGameOver = true;

		// Create red explosion circle around ship
		// Ship is at (0, 0, gameSphereRadius) in world space
		const geometry = new THREE.CircleGeometry(RENDERER_CONST.EXPLOSION_RADIUS, 32);
		const material = new THREE.MeshBasicMaterial({
			color: RENDERER_CONST.EXPLOSION_COLOR,
			side: THREE.DoubleSide,
			transparent: true,
			opacity: RENDERER_CONST.EXPLOSION_OPACITY
		});

		this.explosionCircle = new THREE.Mesh(geometry, material);

		// Position at ship location and orient to face camera
		this.explosionCircle.position.set(0, 0, GAME_CONST.SPHERE_RADIUS);

		this.scene.add(this.explosionCircle);

		// Create game over overlay (DOM element)
		this.createGameOverOverlay();
	}

	/**
	 * Create the game over overlay DOM element
	 */
	private createGameOverOverlay(): void {
		// Create overlay container
		this.gameOverOverlay = document.createElement('div');
		this.gameOverOverlay.style.position = 'absolute';
		this.gameOverOverlay.style.top = '0';
		this.gameOverOverlay.style.left = '0';
		this.gameOverOverlay.style.width = '100%';
		this.gameOverOverlay.style.height = '100%';
		this.gameOverOverlay.style.display = 'flex';
		this.gameOverOverlay.style.alignItems = 'center';
		this.gameOverOverlay.style.justifyContent = 'center';
		this.gameOverOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
		this.gameOverOverlay.style.zIndex = '1000';
		this.gameOverOverlay.style.pointerEvents = 'none'; // Allow clicking through

		// Create content container
		const content = document.createElement('div');
		content.style.textAlign = 'center';
		content.style.color = 'white';

		// Create title
		const title = document.createElement('h1');
		title.textContent = 'GAME OVER';
		title.style.fontSize = '4rem';
		title.style.fontWeight = 'bold';
		title.style.color = '#ff0000';
		title.style.margin = '0 0 1rem 0';
		title.style.textShadow = '0 0 20px rgba(255, 0, 0, 0.5)';

		// Create instruction text
		const text = document.createElement('p');
		text.textContent = 'Press ENTER to restart';
		text.style.fontSize = '1.5rem';
		text.style.margin = '0';
		text.style.color = '#ffffff';
		text.style.opacity = '0.9';

		content.appendChild(title);
		content.appendChild(text);
		this.gameOverOverlay.appendChild(content);

		// Add to canvas parent element
		const parent = this.canvas.parentElement;
		if (parent) {
			parent.style.position = 'relative'; // Ensure parent is positioned
			parent.appendChild(this.gameOverOverlay);
		}
	}

	/**
	 * Remove the game over overlay DOM element
	 */
	private removeGameOverOverlay(): void {
		if (this.gameOverOverlay && this.gameOverOverlay.parentElement) {
			this.gameOverOverlay.parentElement.removeChild(this.gameOverOverlay);
			this.gameOverOverlay = null;
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

				// Update asteroids (rotation and movement)
				this.asteroids.update(deltaTime);

				// Update bullets (movement and lifetime)
				// Bullets are in world space, so use camera world position directly
				this.bullets.setCameraPosition(this.camera.position);
				this.bullets.update(deltaTime);

				// Check collisions and handle them
				this.checkCollisions();
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
				invincibleTicks: 0,
				cooldownLevel: 0,
				rayCountLevel: 0
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
	// Configuration (GUI-controlled values only)
	// ========================================================================
	updateConfig(config: GameConfig): void {
		this.config = config;
		// Only bullets need GUI config updates (lifetime, cooldown, rayCount, spreadAngle)
		this.bullets.updateGameConfig(config);
	}

	getConfig(): GameConfig {
		return { ...this.config };
	}

	// Convenience methods for GUI-controlled colors
	setForceFieldColor(color: number): void {
		this.planet.setForceFieldColor(color);
	}

	getForceFieldColor(): number {
		return this.planet.getForceFieldColor();
	}

	setAimDotColor(color: number): void {
		this.ship.setAimDotColor(color);
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
		window.removeEventListener('resize', this.handleResize);
		window.removeEventListener('keydown', this.handleKeyPress);

		// Clean up game over overlay
		this.removeGameOverOverlay();

		// Clean up explosion
		if (this.explosionCircle) {
			this.scene.remove(this.explosionCircle);
			this.explosionCircle.geometry.dispose();
			(this.explosionCircle.material as THREE.Material).dispose();
			this.explosionCircle = null;
		}

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

	/**
	 * Update projectile gameplay mechanics (lifetime, cooldown, rayCount, spreadAngle)
	 * These are GUI-controlled values
	 */
	updateProjectileConfig(config: Partial<GameConfig['projectile']>): void {
		Object.assign(this.config.projectile, config);
		this.bullets.updateGameConfig(this.config);
	}

	setBulletColor(color: number): void {
		this.bullets.setColor(color);
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

	// ========================================================================
	// Game Over / Restart
	// ========================================================================

	/**
	 * Restart the game - reset all state and respawn asteroids
	 */
	restart(): void {
		// Clear game over state
		this.isGameOver = false;

		// Remove game over overlay
		this.removeGameOverOverlay();

		// Remove explosion visual
		if (this.explosionCircle) {
			this.scene.remove(this.explosionCircle);
			this.explosionCircle.geometry.dispose();
			(this.explosionCircle.material as THREE.Material).dispose();
			this.explosionCircle = null;
		}

		// Reset all game state (asteroids, ship, bullets, input)
		this.initializeGameState();
	}
}
