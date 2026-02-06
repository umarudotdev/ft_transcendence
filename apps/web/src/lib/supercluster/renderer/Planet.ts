import { GAME_CONST } from '@ft/supercluster';
import * as THREE from 'three';

import { RENDERER_CONST } from '../constants/renderer';
import { forceFieldVertexShader, forceFieldFragmentShader } from '../shaders/forceField';

// ============================================================================
// Constants
// ============================================================================
const SPHERE_SEGMENTS = 64;
const DEFAULT_ICOSPHERE_DETAIL = 10; // 0=20 faces, 1=80, 2=320, 3=1280

// ============================================================================
// Planet Renderer
// Renders the 3-layer planet: solid planet, wireframe force-field, invisible game sphere
// Uses GAME_CONST for sizes, RENDERER_CONST for visuals
// ============================================================================
export class PlanetRenderer {
	readonly group: THREE.Object3D;

	private planet: THREE.Mesh;
	private forceField: THREE.LineSegments;
	private forceFieldMaterial: THREE.ShaderMaterial;
	private forceFieldDetail: number = DEFAULT_ICOSPHERE_DETAIL;
	private forceFieldColor: THREE.Color;

	constructor(camera: THREE.Camera) {
		this.group = new THREE.Object3D();
		this.forceFieldColor = new THREE.Color(RENDERER_CONST.FORCE_FIELD_COLOR);

		// Create planet (solid sphere - innermost)
		const planetGeometry = new THREE.SphereGeometry(
			GAME_CONST.PLANET_RADIUS,
			SPHERE_SEGMENTS,
			SPHERE_SEGMENTS
		);
		const planetMaterial = new THREE.MeshPhongMaterial({
			color: RENDERER_CONST.PLANET_COLOR,
			flatShading: false
		});
		this.planet = new THREE.Mesh(planetGeometry, planetMaterial);
		this.group.add(this.planet);

		// Create force-field (icosphere wireframe with fading shader)
		// Using IcosahedronGeometry for uniform triangle distribution
		const forceFieldGeometry = new THREE.IcosahedronGeometry(
			GAME_CONST.FORCE_FIELD_RADIUS,
			this.forceFieldDetail
		);
		const wireframe = new THREE.WireframeGeometry(forceFieldGeometry);
		this.forceFieldMaterial = this.createForceFieldMaterial(camera);
		this.forceField = new THREE.LineSegments(wireframe, this.forceFieldMaterial);
		this.group.add(this.forceField);
	}

	private createForceFieldMaterial(camera: THREE.Camera): THREE.ShaderMaterial {
		return new THREE.ShaderMaterial({
			uniforms: {
				uColor: { value: this.forceFieldColor },
				uOpacityFront: { value: RENDERER_CONST.FORCE_FIELD_OPACITY },
				uOpacityBack: { value: RENDERER_CONST.FORCE_FIELD_BACK_FADE },
				uCameraPos: { value: camera.position }
			},
			vertexShader: forceFieldVertexShader,
			fragmentShader: forceFieldFragmentShader,
			transparent: true,
			depthWrite: false
		});
	}

	// ========================================================================
	// Force Field Color (GUI-controlled)
	// ========================================================================
	setForceFieldColor(color: number): void {
		this.forceFieldColor.setHex(color);
		this.forceFieldMaterial.uniforms['uColor']!.value = this.forceFieldColor;
	}

	getForceFieldColor(): number {
		return this.forceFieldColor.getHex();
	}

	// ========================================================================
	// Cleanup
	// ========================================================================
	dispose(): void {
		this.planet.geometry.dispose();
		(this.planet.material as THREE.Material).dispose();
		this.forceField.geometry.dispose();
		this.forceFieldMaterial.dispose();
	}
}
