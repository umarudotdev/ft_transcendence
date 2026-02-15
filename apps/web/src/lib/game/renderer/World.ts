import { GAME_CONST } from "@ft/supercluster";
import * as THREE from "three";

import { RENDERER_CONST } from "../constants/renderer";
import { ForceFieldRenderer } from "./ForceField";

// ============================================================================
// Constants
// ============================================================================
const SPHERE_SEGMENTS = 64;

// ============================================================================
// World Renderer
// Container for all objects that rotate together with ship movement:
// - Planet (solid sphere)
// - Force Field (wireframe with shader)
// - Asteroids (added externally via group)
//
// Uses GAME_CONST for sizes, RENDERER_CONST for visuals
// ============================================================================
export class WorldRenderer {
  readonly group: THREE.Group;

  private planet: THREE.Mesh;
  private forceField: ForceFieldRenderer;

  constructor() {
    this.group = new THREE.Group();

    // Create planet (solid sphere - innermost)
    const planetGeometry = new THREE.SphereGeometry(
      GAME_CONST.PLANET_RADIUS,
      SPHERE_SEGMENTS,
      SPHERE_SEGMENTS
    );
    const planetMaterial = new THREE.MeshPhongMaterial({
      color: RENDERER_CONST.PLANET_COLOR,
      flatShading: false,
    });
    this.planet = new THREE.Mesh(planetGeometry, planetMaterial);
    this.group.add(this.planet);

    // Create force field (icosphere wireframe)
    this.forceField = new ForceFieldRenderer();
    this.group.add(this.forceField.mesh);
  }

  // ========================================================================
  // Update - call each frame
  // ========================================================================
  update(cameraPosition: THREE.Vector3): void {
    // Update force field shader with camera position
    this.forceField.update(cameraPosition);
  }

  // ========================================================================
  // Force Field Color Control
  // ========================================================================
  setForceFieldColor(color: number): void {
    this.forceField.setColor(color);
  }

  getForceFieldColor(): number {
    return this.forceField.getColor();
  }

  // ========================================================================
  // Cleanup
  // ========================================================================
  dispose(): void {
    this.planet.geometry.dispose();
    (this.planet.material as THREE.Material).dispose();
    this.forceField.dispose();
  }
}
