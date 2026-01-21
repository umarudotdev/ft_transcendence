import * as THREE from 'three';
import type { ShipState, GameConfig } from '@ft/supercluster';

// ============================================================================
// Ship Renderer
// Renders the player's ship as a triangle on the sphere surface
// ============================================================================
export class ShipRenderer {
	readonly mesh: THREE.Mesh;
	private config: GameConfig;

	constructor(config: GameConfig) {
		this.config = config;

		// Create triangle geometry for ship
		const geometry = this.createTriangleGeometry();
		const material = new THREE.MeshBasicMaterial({
			color: 0xff4444,
			side: THREE.DoubleSide,
		});

		this.mesh = new THREE.Mesh(geometry, material);
		this.mesh.renderOrder = 100;  // Render above planet
	}

	private createTriangleGeometry(): THREE.BufferGeometry {
		// 3D wedge shape: tip at front (flat), back raised up
		// Ship lies on XY plane (tangent to sphere at (0,0,radius))
		// Tip points toward -Y (forward/north on sphere)
		// Back is raised in +Z (up from surface)
		const size = 6;
		const height = 3; // Height of the back of the ship

		// Define vertices for a 3D wedge (2 triangles)
		const vertices = new Float32Array([
			// Bottom triangle (on the surface)
			0, -size, 0, // Tip (forward)
			-size * 0.6, size * 0.5, 0, // Back left bottom
			size * 0.6, size * 0.5, 0, // Back right bottom

			// Top triangle (raised)
			0, -size, 0, // Tip (same as bottom - flat at front)
			size * 0.6, size * 0.5, 0, // Back right bottom
			size * 0.6, size * 0.5, height, // Back right top

			0, -size, 0, // Tip
			size * 0.6, size * 0.5, height, // Back right top
			-size * 0.6, size * 0.5, height, // Back left top

			0, -size, 0, // Tip
			-size * 0.6, size * 0.5, height, // Back left top
			-size * 0.6, size * 0.5, 0, // Back left bottom

			// Back face (closes the wedge)
			-size * 0.6, size * 0.5, 0, // Back left bottom
			-size * 0.6, size * 0.5, height, // Back left top
			size * 0.6, size * 0.5, height, // Back right top

			-size * 0.6, size * 0.5, 0, // Back left bottom
			size * 0.6, size * 0.5, height, // Back right top
			size * 0.6, size * 0.5, 0, // Back right bottom
		]);

		const geometry = new THREE.BufferGeometry();
		geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
		geometry.computeVertexNormals();

		return geometry;
	}

	// ========================================================================
	// Update from Game State
	// ========================================================================
	updateFromState(state: ShipState): void {
		// Ship is visually FIXED at (0, 0, gameSphereRadius) - front of sphere
		// The planet rotates under the ship to create movement illusion
		// Only aimAngle affects ship's visual rotation
		const radius = this.config.gameSphereRadius;

		// Fixed position: always at the front of the sphere (facing camera)
		this.mesh.position.set(0, 0, radius);

		// Ship geometry is already defined in the XY plane (tangent to sphere):
		// - Tip points toward -Y (forward/north on sphere)
		// - Back is raised in +Z (up from surface)
		// No base rotation needed - geometry is pre-aligned

		// Apply aim rotation around the ship's up axis (Z axis = normal to sphere)
		// Positive aim angle rotates clockwise when viewed from above
		this.mesh.rotation.set(0, 0, -state.aimAngle);

		// Handle invincibility visual (blinking)
		if (state.invincible) {
			this.mesh.visible = Math.floor(Date.now() / 100) % 2 === 0;
		} else {
			this.mesh.visible = true;
		}
	}

	// ========================================================================
	// Configuration
	// ========================================================================
	updateConfig(config: GameConfig): void {
		this.config = config;
	}

	setColor(color: number): void {
		(this.mesh.material as THREE.MeshBasicMaterial).color.setHex(color);
	}

	// ========================================================================
	// Cleanup
	// ========================================================================
	dispose(): void {
		this.mesh.geometry.dispose();
		(this.mesh.material as THREE.Material).dispose();
	}
}
