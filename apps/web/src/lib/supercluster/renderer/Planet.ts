import type { GameConfig, RendererConfig } from "@ft/supercluster";

import * as THREE from "three";

import {
  forceFieldVertexShader,
  forceFieldFragmentShader,
} from "../shaders/forceField";

// ============================================================================
// Constants
// ============================================================================
const SPHERE_SEGMENTS = 64;
const DEFAULT_ICOSPHERE_DETAIL = 10; // 0=20 faces, 1=80, 2=320, 3=1280

// ============================================================================
// Planet Renderer
// Renders the 3-layer planet: solid planet, wireframe force-field, invisible game sphere
// ============================================================================
export class PlanetRenderer {
  readonly group: THREE.Object3D;

  private planet: THREE.Mesh;
  private forceField: THREE.LineSegments;
  private forceFieldMaterial: THREE.ShaderMaterial;
  private axes: THREE.AxesHelper;
  private config: GameConfig;
  private rendererConfig: RendererConfig;
  private forceFieldDetail: number = DEFAULT_ICOSPHERE_DETAIL;
  private forceFieldColor: THREE.Color;

  constructor(
    camera: THREE.Camera,
    config: GameConfig,
    rendererConfig: RendererConfig
  ) {
    this.config = config;
    this.rendererConfig = rendererConfig;
    this.group = new THREE.Object3D();
    this.forceFieldColor = new THREE.Color(0x00ffaa);

    // Create planet (solid sphere - innermost)
    const planetGeometry = new THREE.SphereGeometry(
      config.planetRadius,
      SPHERE_SEGMENTS,
      SPHERE_SEGMENTS
    );
    const planetMaterial = new THREE.MeshPhongMaterial({
      color: 0x4466aa,
      flatShading: false,
    });
    this.planet = new THREE.Mesh(planetGeometry, planetMaterial);
    this.group.add(this.planet);

    // Create force-field (icosphere wireframe with fading shader)
    // Using IcosahedronGeometry for uniform triangle distribution
    const forceFieldGeometry = new THREE.IcosahedronGeometry(
      config.forceFieldRadius,
      this.forceFieldDetail
    );
    const wireframe = new THREE.WireframeGeometry(forceFieldGeometry);
    this.forceFieldMaterial = this.createForceFieldMaterial(camera);
    this.forceField = new THREE.LineSegments(
      wireframe,
      this.forceFieldMaterial
    );
    this.group.add(this.forceField);

    // Create axes helper
    this.axes = new THREE.AxesHelper(config.gameSphereRadius * 1.2);
    this.axes.visible = rendererConfig.showAxes;
    this.axes.material.depthTest = false;
    this.axes.renderOrder = 999;
    this.group.add(this.axes);
  }

  private createForceFieldMaterial(camera: THREE.Camera): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: this.forceFieldColor },
        uOpacityFront: { value: this.rendererConfig.forceFieldOpacity },
        uOpacityBack: { value: this.rendererConfig.forceFieldBackFade },
        uCameraPos: { value: camera.position },
      },
      vertexShader: forceFieldVertexShader,
      fragmentShader: forceFieldFragmentShader,
      transparent: true,
      depthWrite: false,
    });
  }

  // ========================================================================
  // Configuration Updates
  // ========================================================================
  updateConfig(config: GameConfig): void {
    this.config = config;
    this.rebuild();
  }

  updateRendererConfig(rendererConfig: RendererConfig): void {
    this.rendererConfig = rendererConfig;
    this.axes.visible = rendererConfig.showAxes;
    this.forceFieldMaterial.uniforms["uOpacityFront"]!.value =
      rendererConfig.forceFieldOpacity;
    this.forceFieldMaterial.uniforms["uOpacityBack"]!.value =
      rendererConfig.forceFieldBackFade;
  }

  setAxesVisible(visible: boolean): void {
    this.axes.visible = visible;
  }

  setForceFieldOpacity(front: number, back: number): void {
    this.forceFieldMaterial.uniforms["uOpacityFront"]!.value = front;
    this.forceFieldMaterial.uniforms["uOpacityBack"]!.value = back;
  }

  setForceFieldDetail(detail: number): void {
    this.forceFieldDetail = detail;
    this.rebuildForceField();
  }

  setForceFieldColor(color: number): void {
    this.forceFieldColor.setHex(color);
    this.forceFieldMaterial.uniforms["uColor"]!.value = this.forceFieldColor;
  }

  getForceFieldDetail(): number {
    return this.forceFieldDetail;
  }

  getForceFieldColor(): number {
    return this.forceFieldColor.getHex();
  }

  // ========================================================================
  // Visual-Only Radius Updates (don't affect gameplay config)
  // ========================================================================

  /**
   * Update only the planet visual radius (cosmetic only)
   */
  setPlanetRadius(radius: number): void {
    this.config.planetRadius = radius;
    this.planet.geometry.dispose();
    this.planet.geometry = new THREE.SphereGeometry(
      radius,
      SPHERE_SEGMENTS,
      SPHERE_SEGMENTS
    );
  }

  /**
   * Update only the force field visual radius (cosmetic only)
   */
  setForceFieldRadius(radius: number): void {
    this.config.forceFieldRadius = radius;
    this.rebuildForceField();
  }

  // ========================================================================
  // Rebuild Geometry
  // ========================================================================
  private rebuild(): void {
    // Update planet geometry
    this.planet.geometry.dispose();
    this.planet.geometry = new THREE.SphereGeometry(
      this.config.planetRadius,
      SPHERE_SEGMENTS,
      SPHERE_SEGMENTS
    );

    // Update force-field geometry (icosphere)
    this.rebuildForceField();

    // Update axes size
    this.axes.dispose();
    const newAxes = new THREE.AxesHelper(this.config.gameSphereRadius * 1.2);
    newAxes.visible = this.rendererConfig.showAxes;
    newAxes.material.depthTest = false;
    newAxes.renderOrder = 999;
    this.group.remove(this.axes);
    this.group.add(newAxes);
    this.axes = newAxes;
  }

  private rebuildForceField(): void {
    this.forceField.geometry.dispose();
    const forceFieldGeometry = new THREE.IcosahedronGeometry(
      this.config.forceFieldRadius,
      this.forceFieldDetail
    );
    this.forceField.geometry = new THREE.WireframeGeometry(forceFieldGeometry);
  }

  // ========================================================================
  // Cleanup
  // ========================================================================
  dispose(): void {
    this.planet.geometry.dispose();
    (this.planet.material as THREE.Material).dispose();
    this.forceField.geometry.dispose();
    this.forceFieldMaterial.dispose();
    this.axes.dispose();
  }
}
