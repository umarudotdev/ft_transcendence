// ============================================================================
// Ship Geometry Constants & Builder
// Procedural ship shape configuration
// Replace this file with a 3D model loader when ready
// ============================================================================

import * as THREE from 'three';

export const SHIP_GEOMETRY = Object.freeze({
	// ========================================================================
	// Material
	// ========================================================================
	COLOR: 0x888888, // Grey
	ROUGHNESS: 0.8, // Matte finish
	METALNESS: 0, // No metallic

	// ========================================================================
	// Dimensions
	// ========================================================================
	SIZE: 4, // Overall size (length from tip to back)
	HEIGHT: 2, // Height of the raised back
	WIDTH_MULT: 0.6, // Width = SIZE * WIDTH_MULT

	// ========================================================================
	// Aim Orbit
	// ========================================================================
	AIM_ORBIT_OPACITY: 0.3, // Transparency of orbit circle

	// ========================================================================
	// Visual Effects
	// ========================================================================
	INVINCIBLE_BLINK_MS: 100 // Blink rate when invincible (milliseconds)
});

export type ShipGeometryType = typeof SHIP_GEOMETRY;

// ============================================================================
// Geometry Builder
// Creates the 3D wedge shape for the ship
// Replace this function with a model loader when ready
// ============================================================================

/**
 * Create the ship's 3D wedge geometry
 *
 * Ship lies on XY plane (tangent to sphere at (0,0,radius))
 * - Tip points toward -Y (forward/north on sphere)
 * - Back is raised in +Z (up from surface)
 *
 * @returns THREE.BufferGeometry for the ship mesh
 */
export function createShipGeometry(): THREE.BufferGeometry {
	const size = SHIP_GEOMETRY.SIZE;
	const height = SHIP_GEOMETRY.HEIGHT;
	const width = size * SHIP_GEOMETRY.WIDTH_MULT;

	// Define vertices for a 3D wedge (6 triangles = 18 vertices)
	const vertices = new Float32Array([
		// Bottom triangle (on the surface)
		0,
		-size,
		0, // Tip (forward)
		-width,
		size * 0.5,
		0, // Back left bottom
		width,
		size * 0.5,
		0, // Back right bottom

		// Top triangle (raised)
		0,
		-size,
		0, // Tip (same as bottom - flat at front)
		width,
		size * 0.5,
		0, // Back right bottom
		width,
		size * 0.5,
		height, // Back right top

		0,
		-size,
		0, // Tip
		width,
		size * 0.5,
		height, // Back right top
		-width,
		size * 0.5,
		height, // Back left top

		0,
		-size,
		0, // Tip
		-width,
		size * 0.5,
		height, // Back left top
		-width,
		size * 0.5,
		0, // Back left bottom

		// Back face (closes the wedge)
		-width,
		size * 0.5,
		0, // Back left bottom
		-width,
		size * 0.5,
		height, // Back left top
		width,
		size * 0.5,
		height, // Back right top

		-width,
		size * 0.5,
		0, // Back left bottom
		width,
		size * 0.5,
		height, // Back right top
		width,
		size * 0.5,
		0 // Back right bottom
	]);

	const geometry = new THREE.BufferGeometry();
	geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
	geometry.computeVertexNormals();

	return geometry;
}
