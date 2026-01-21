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
		this.camera = new THREE.PerspectiveCamera(
			60,
			canvas.clientWidth / canvas.clientHeight,
			0.1,
			1000
		);
		this.camera.position.set(0, 0, config.gameSphereRadius * 2.5);
		this.camera.lookAt(0, 0, 0);

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

	// ========================================================================
	// Game State Updates
	// ========================================================================
	updateState(state: GameState): void {
		this.lastState = state;

		// Update ship from state
		this.ship.updateFromState(state.ship);

		// TODO: Update projectiles
		// TODO: Update enemies

		// Rotate planet group (in our paradigm, the planet rotates, not the ship)
		// The ship state contains the ship's position, and we rotate the planet
		// so the ship appears to be at the "top" of the view
		this.updatePlanetRotation(state.ship.position.phi, state.ship.position.theta);
	}

	private updatePlanetRotation(phi: number, theta: number): void {
		// Rotate planet so ship position is at the "top" (in front of camera)
		// This creates the effect of the ship moving over the planet
		this.planet.group.rotation.x = phi - Math.PI / 2;
		this.planet.group.rotation.y = -theta;
	}

	// ========================================================================
	// Render Loop
	// ========================================================================
	start(): void {
		if (this.animationId !== null) return;

		const animate = (): void => {
			this.animationId = requestAnimationFrame(animate);
			this.render();
		};

		animate();
	}

	stop(): void {
		if (this.animationId !== null) {
			cancelAnimationFrame(this.animationId);
			this.animationId = null;
		}
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

		// Update camera position
		this.camera.position.z = config.gameSphereRadius * 2.5;
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

	// Debug method to update ship position directly (for lil-gui controls)
	updateShipDebug(state: ShipState): void {
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
