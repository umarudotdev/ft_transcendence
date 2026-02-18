// ============================================================================
// Force-Field Shader
// Fades lines that face away from the camera for depth effect
// ============================================================================

export const forceFieldVertexShader = `
	varying vec3 vWorldPosition;

	void main() {
		vec4 worldPos = modelMatrix * vec4(position, 1.0);
		vWorldPosition = worldPos.xyz;
		gl_Position = projectionMatrix * viewMatrix * worldPos;
	}
`;

export const forceFieldFragmentShader = `
	uniform vec3 uColor;
	uniform float uOpacityFront;
	uniform float uOpacityBack;
	uniform vec3 uCameraPos;

	varying vec3 vWorldPosition;

	void main() {
		// For a sphere centered at origin, normal = normalized position
		vec3 normal = normalize(vWorldPosition);
		vec3 viewDir = normalize(uCameraPos - vWorldPosition);

		// Dot product: 1 = facing camera, -1 = facing away
		float facing = dot(normal, viewDir);

		// Interpolate opacity based on facing direction
		float opacity = mix(uOpacityBack, uOpacityFront, (facing + 1.0) * 0.5);

		gl_FragColor = vec4(uColor, opacity);
	}
`;
