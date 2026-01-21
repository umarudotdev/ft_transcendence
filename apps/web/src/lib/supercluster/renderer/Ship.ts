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
		const size = 3;  // Ship size
		const vertices = new Float32Array([
			0, size, 0,           // Top point (forward)
			-size * 0.6, -size * 0.5, 0,  // Bottom left
			size * 0.6, -size * 0.5, 0,   // Bottom right
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
		// Convert spherical coordinates to Cartesian position
		const radius = this.config.gameSphereRadius;
		const { phi, theta } = state.position;

		// Calculate position on sphere surface
		const x = radius * Math.sin(phi) * Math.cos(theta);
		const y = radius * Math.cos(phi);
		const z = radius * Math.sin(phi) * Math.sin(theta);

		this.mesh.position.set(x, y, z);

		// Orient ship: normal is "up" for the ship (perpendicular to sphere surface)
		const normal = new THREE.Vector3(x, y, z).normalize();

		// The ship's local Y (forward/tip) should point along the sphere surface
		// toward the "north pole" by default, then rotated by aimAngle
		// Calculate the "north" direction on the tangent plane
		const worldUp = new THREE.Vector3(0, 1, 0);

		// Tangent pointing toward increasing theta (east)
		const east = new THREE.Vector3().crossVectors(worldUp, normal).normalize();

		// Tangent pointing toward north (decreasing phi)
		const north = new THREE.Vector3().crossVectors(normal, east).normalize();

		// Build orientation: ship lies on tangent plane, tip points north
		// local X = east (right), local Y = north (forward), local Z = normal (up from surface)
		const rotationMatrix = new THREE.Matrix4();
		rotationMatrix.makeBasis(east, north, normal);
		this.mesh.quaternion.setFromRotationMatrix(rotationMatrix);

		// Rotate ship around normal by aim angle
		const aimRotation = new THREE.Quaternion();
		aimRotation.setFromAxisAngle(normal, -state.aimAngle);
		this.mesh.quaternion.premultiply(aimRotation);

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
