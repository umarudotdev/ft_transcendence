// ============================================================================
// Ship Geometry Constants
// Procedural ship shape configuration
// Replace this file with a 3D model loader when ready
// ============================================================================

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
	INVINCIBLE_BLINK_MS: 100, // Blink rate when invincible (milliseconds)
});

export type ShipGeometryType = typeof SHIP_GEOMETRY;
