import * as THREE from 'three';
import { PlanetRenderer } from './Planet';
import { ShipRenderer } from './Ship';
import {
	DEFAULT_CONFIG,
	DEFAULT_RENDERER_CONFIG,
	type GameState,
	type GameConfig,
	type RendererConfig,
	type ShipState,
	type InputState,
} from '@ft/supercluster';

// ============================================================================
// Game Renderer
// Main rendering class that manages all visual elements
// ============================================================================
export class GameRenderer {
	private renderer: THREE.WebGLRenderer;
	private scene: THREE.Scene;
	private camera: THREE.PerspectiveCamera;

	private planet: PlanetRenderer;
	private ship: ShipRenderer;

	private config: GameConfig;
	private rendererConfig: RendererConfig;

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

	// Ship aim angle and other state (non-positional)
	private shipAimAngle = 0;
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
	private readonly _yawAxis = new THREE.Vector3(0, 1, 0);   // Y-axis (left/right)
	private readonly _tempQuat = new THREE.Quaternion();

	constructor(
		canvas: HTMLCanvasElement,
		config: GameConfig = { ...DEFAULT_CONFIG },
		rendererConfig: RendererConfig = { ...DEFAULT_RENDERER_CONFIG }
	) {
		this.config = config;
		this.rendererConfig = rendererConfig;

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

		// Create ship
		this.ship = new ShipRenderer(config);
		this.scene.add(this.ship.mesh);

		// Initialize ship facing camera (on +Z side of sphere)
		// phi = PI/2 (equator), theta = PI/2 (facing +Z)
		// This puts ship at (0, 0, radius) - directly in front of camera
		this.ship.updateFromState({
			position: { phi: Math.PI / 2, theta: Math.PI / 2 },
			aimAngle: 0,
			lives: 3,
			invincible: false,
		});

		// Handle window resize
		this.handleResize = this.handleResize.bind(this);
		window.addEventListener('resize', this.handleResize);
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
		const cameraDistance = r * 2.5;

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
		this._tempQuat.setFromAxisAngle(this._pitchAxis, -(state.ship.position.phi - Math.PI / 2));
		this.planetQuaternion.multiply(this._tempQuat);
		this._tempQuat.setFromAxisAngle(this._yawAxis, state.ship.position.theta - Math.PI / 2);
		this.planetQuaternion.multiply(this._tempQuat);

		// Apply to visuals
		this.planet.group.quaternion.copy(this.planetQuaternion);
		this.ship.updateFromState(state.ship);

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

			// Update local movement (only when not receiving server state)
			if (!this.lastState) {
				this.updateLocalMovement(deltaTime);
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
		// Movement speed in radians per second
		const speed = this.config.shipSpeed * 60; // Convert from per-tick to per-second

		// Check if any movement input is active
		const hasInput =
			this.currentInput.forward ||
			this.currentInput.backward ||
			this.currentInput.left ||
			this.currentInput.right;

		if (!hasInput) return;

		// ====================================================================
		// Quaternion-based movement (no gimbal lock, smooth pole crossing)
		// ====================================================================
		// We rotate the planet quaternion based on input.
		// The ship position (unit vector) is rotated inversely to track
		// where the ship "actually" is on the planet surface.

		// Calculate rotation angles for this frame
		let pitchAngle = 0; // Forward/backward (rotate around X)
		let yawAngle = 0;   // Left/right (rotate around Y)

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

		// Update ship visuals (aim angle)
		this.updateShipVisuals();
	}

	// ========================================================================
	// Ship Visual Updates
	// ========================================================================
	private updateShipVisuals(): void {
		// Create a ShipState from current quaternion-based state
		// Convert unit vector position to spherical for compatibility
		const spherical = this.unitVectorToSpherical(this.shipPosition);

		this.ship.updateFromState({
			position: spherical,
			aimAngle: this.shipAimAngle,
			lives: this.shipLives,
			invincible: this.shipInvincible,
		});
	}

	// ========================================================================
	// Coordinate Conversion Utilities
	// ========================================================================

	/**
	 * Convert unit vector (x, y, z) to spherical coordinates (phi, theta)
	 * phi: polar angle from Y-axis (0 to π)
	 * theta: azimuthal angle in XZ plane (0 to 2π)
	 */
	private unitVectorToSpherical(v: THREE.Vector3): { phi: number; theta: number } {
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

		// Update camera position when sphere radius changes
		this.setupCamera();
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
		this._tempQuat.setFromAxisAngle(this._pitchAxis, -(state.position.phi - Math.PI / 2));
		this.planetQuaternion.multiply(this._tempQuat);

		// Rotate to match theta (yaw around Y)
		this._tempQuat.setFromAxisAngle(this._yawAxis, state.position.theta - Math.PI / 2);
		this.planetQuaternion.multiply(this._tempQuat);

		// Apply to planet visual
		this.planet.group.quaternion.copy(this.planetQuaternion);

		// Update ship visual
		this.ship.updateFromState(state);
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

		this.planet.dispose();
		this.ship.dispose();
		this.renderer.dispose();
	}
}
