import { GAME_CONST } from "@ft/supercluster";
import * as THREE from "three";

import { RENDERER_CONST } from "../constants/renderer";
import {
  forceFieldVertexShader,
  forceFieldFragmentShader,
} from "../shaders/forceField";

// ============================================================================
// Constants
// ============================================================================
const DEFAULT_ICOSPHERE_DETAIL = 10; // 0=20 faces, 1=80, 2=320, 3=1280

// ============================================================================
// Force Field Renderer
// Renders the icosphere wireframe with camera-facing opacity shader
// Uses GAME_CONST for size, RENDERER_CONST for visuals
// ============================================================================
export class ForceFieldRenderer {
  readonly mesh: THREE.LineSegments;

  private material: THREE.ShaderMaterial;
  private color: THREE.Color;

  // Reusable vector to avoid allocations in update()
  private readonly _cameraPos = new THREE.Vector3();

  constructor() {
    this.color = new THREE.Color(RENDERER_CONST.FORCE_FIELD_COLOR);

    // Create icosphere wireframe geometry
    const geometry = new THREE.IcosahedronGeometry(
      GAME_CONST.FORCE_FIELD_RADIUS,
      DEFAULT_ICOSPHERE_DETAIL
    );
    const wireframe = new THREE.WireframeGeometry(geometry);

    // Create shader material
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: this.color },
        uOpacityFront: { value: RENDERER_CONST.FORCE_FIELD_OPACITY },
        uOpacityBack: { value: RENDERER_CONST.FORCE_FIELD_BACK_FADE },
        uCameraPos: { value: this._cameraPos },
      },
      vertexShader: forceFieldVertexShader,
      fragmentShader: forceFieldFragmentShader,
      transparent: true,
      depthWrite: false,
    });

    this.mesh = new THREE.LineSegments(wireframe, this.material);
  }

  // ========================================================================
  // Update - call each frame with camera position
  // ========================================================================
  update(cameraPosition: THREE.Vector3): void {
    // Copy camera position to shader uniform
    this._cameraPos.copy(cameraPosition);
  }

  // ========================================================================
  // Color Control
  // ========================================================================
  setColor(color: number): void {
    this.color.setHex(color);
  }

  getColor(): number {
    return this.color.getHex();
  }

  // ========================================================================
  // Cleanup
  // ========================================================================
  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
