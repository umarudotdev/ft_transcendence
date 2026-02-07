// ============================================================================
// Renderer Constants (RENDERER_CONST)
// Visual settings that don't affect gameplay - CLIENT ONLY
// ============================================================================

export const RENDERER_CONST = Object.freeze({
	// ========================================================================
	// Scene
	// ========================================================================
	SCENE_BG: 0x111122, // Dark blue background

	// ========================================================================
	// Camera
	// ========================================================================
	CAMERA_FOV: 60, // Field of view (degrees)
	CAMERA_NEAR: 0.1, // Near clipping plane
	CAMERA_FAR: 1000, // Far clipping plane
	CAMERA_DIST_MULT: 2, // Distance = SPHERE_RADIUS * CAMERA_DIST_MULT

	// ========================================================================
	// Lighting
	// ========================================================================
	AMB_LIGHT_INTENSITY: 0.4, // Ambient light (fills shadows)
	DIR_LIGHT_INTENSITY: 0.8, // Directional light (main light)
	DIR_LIGHT_POS: Object.freeze({ x: 50, y: 50, z: 100 }),

	// ========================================================================
	// Force Field (visual shell around planet)
	// ========================================================================
	FORCE_FIELD_COLOR: 0x00ffaa, // Cyan-green
	FORCE_FIELD_OPACITY: 0.35,
	FORCE_FIELD_BACK_FADE: 0.0,

	// ========================================================================
	// Planet Visuals
	// ========================================================================
	PLANET_COLOR: 0x4466aa, // Blue-ish

	// ========================================================================
	// Ship Visuals
	// ========================================================================
	SHIP_ROTATION_SPEED: 10, // Lerp speed for ship turning

	// ========================================================================
	// Aim Dot
	// ========================================================================
	AIM_DOT_SIZE: 1,
	AIM_DOT_COLOR: 0xffff00, // Yellow
	AIM_DOT_ORBIT_RADIUS: 4, // Distance from ship center

	// ========================================================================
	// Explosion Effect
	// ========================================================================
	EXPLOSION_RADIUS: 8,
	EXPLOSION_COLOR: 0xff0000, // Red
	EXPLOSION_OPACITY: 0.7,

	// ========================================================================
	// Bullet Visuals
	// ========================================================================
	BULLET_COLOR: 0xffaa00, // Orange-yellow
	BULLET_MAX_COUNT: 100, // Performance cap
	BULLET_RADIUS: 0.75, // Circle geometry radius
	BULLET_STRETCH: 2, // Y-scale for ellipse shape
	BULLET_EMISSIVE_INT: 0.5, // Glow intensity
	BULLET_ROUGHNESS: 0.3,
	BULLET_METALNESS: 0.7,

	// ========================================================================
	// Asteroid Visuals
	// ========================================================================
	ASTEROID_COLOR: 0x8b7355, // Brownish-gray rock
	ASTEROID_HIT_COLOR: 0xff0000, // Red when hit
	ASTEROID_ROUGHNESS: 0.9, // Very rough
	ASTEROID_METALNESS: 0.1, // Slightly metallic
	ASTEROID_ROT_SPEED: 2, // Self-rotation speed (rad/s)
	ASTEROID_FRAG_ROT: 3, // Fragment rotation speed (rad/s)
	ASTEROID_FRAG_SPEED_MULT: 1.3 // Fragments move 30% faster
});

// ========================================================================
// Type export
// ========================================================================
export type RendererConstType = typeof RENDERER_CONST;
