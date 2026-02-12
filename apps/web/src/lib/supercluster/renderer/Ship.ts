import { GAME_CONST, type ShipState } from "@ft/supercluster";
import * as THREE from "three";

import { SHIP_GEOMETRY, createShipGeometry } from "../assets/ship-geometry";
import { RENDERER_CONST } from "../constants/renderer";

// ============================================================================
// Ship Renderer
// Renders the player's ship as a triangle on the sphere surface
// Also renders the aim dot that orbits the ship
// Uses GAME_CONST for sizes, RENDERER_CONST for visuals
// ============================================================================
export class ShipRenderer {
  readonly mesh: THREE.Mesh;
  readonly aimDot: THREE.Mesh;
  readonly aimOrbit: THREE.LineLoop; // Circle showing aim dot path
  readonly group: THREE.Group; // Contains ship, aim dot, and orbit circle

  // Current ship direction (where tip points) - used for lerp
  private currentDirectionAngle = 0;

  constructor() {
    // Create group to hold ship, aim dot, and orbit circle
    this.group = new THREE.Group();
    this.group.renderOrder = 100;

    // Create ship geometry (from ship-geometry.ts - replace with model loader later)
    const geometry = createShipGeometry();
    const material = new THREE.MeshStandardMaterial({
      color: SHIP_GEOMETRY.COLOR,
      metalness: SHIP_GEOMETRY.METALNESS,
      roughness: SHIP_GEOMETRY.ROUGHNESS,
      side: THREE.DoubleSide,
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.group.add(this.mesh);

    // Create aim orbit circle (cosmetic ring showing aim dot path)
    this.aimOrbit = this.createAimOrbit();
    this.group.add(this.aimOrbit);

    // Create aim dot
    this.aimDot = this.createAimDot();
    this.group.add(this.aimDot);
  }

  private createAimDot(): THREE.Mesh {
    const geometry = new THREE.SphereGeometry(
      RENDERER_CONST.AIM_DOT_SIZE,
      16,
      16
    );
    const material = new THREE.MeshBasicMaterial({
      color: RENDERER_CONST.AIM_DOT_COLOR,
    });
    const dot = new THREE.Mesh(geometry, material);
    dot.renderOrder = 101; // Above ship
    return dot;
  }

  private createAimOrbit(): THREE.LineLoop {
    // Create a circle using points
    const segments = 64;
    const radius = RENDERER_CONST.AIM_DOT_ORBIT_RADIUS;
    const points: THREE.Vector3[] = [];

    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      points.push(
        new THREE.Vector3(
          Math.sin(angle) * radius,
          Math.cos(angle) * radius,
          0
        )
      );
    }

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
      color: RENDERER_CONST.AIM_DOT_COLOR,
      transparent: true,
      opacity: SHIP_GEOMETRY.AIM_ORBIT_OPACITY,
    });

    const orbit = new THREE.LineLoop(geometry, material);
    orbit.renderOrder = 99; // Below ship and dot
    return orbit;
  }

  // ========================================================================
  // Update from Game State
  // ========================================================================
  updateFromState(
    state: ShipState,
    directionAngle: number,
    aimAngle: number
  ): void {
    // Ship is visually FIXED at (0, 0, SPHERE_RADIUS) - front of sphere
    // The planet rotates under the ship to create movement illusion

    // Fixed position: always at the front of the sphere (facing camera)
    this.group.position.set(0, 0, GAME_CONST.SPHERE_RADIUS);

    // Apply direction rotation (where ship tip points)
    // Canonical heading convention: 0 = up (+Y), PI/2 = right (+X)
    // Geometry tip points toward -Y in model space, so add PI offset.
    this.mesh.rotation.set(0, 0, Math.PI - directionAngle);

    // Position aim dot on orbit circle around ship
    // Canonical aim convention: 0 = up, positive = clockwise
    const dotX = Math.sin(aimAngle) * RENDERER_CONST.AIM_DOT_ORBIT_RADIUS;
    const dotY = Math.cos(aimAngle) * RENDERER_CONST.AIM_DOT_ORBIT_RADIUS;
    this.aimDot.position.set(dotX, dotY, 0);

    // Handle invincibility visual (blinking)
    if (state.invincible) {
      this.mesh.visible =
        Math.floor(Date.now() / SHIP_GEOMETRY.INVINCIBLE_BLINK_MS) % 2 === 0;
    } else {
      this.mesh.visible = true;
    }
  }

  // ========================================================================
  // Lerp ship direction toward target
  // ========================================================================
  lerpDirection(targetAngle: number, deltaTime: number): number {
    // Normalize angles to handle wraparound
    let diff = targetAngle - this.currentDirectionAngle;

    // Shortest path around the circle
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;

    // Lerp toward target (speed is per second, so multiply by deltaTime)
    const lerpFactor =
      1 - Math.exp(-RENDERER_CONST.SHIP_ROTATION_SPEED * deltaTime);
    this.currentDirectionAngle += diff * lerpFactor;

    // Normalize result
    while (this.currentDirectionAngle > Math.PI)
      this.currentDirectionAngle -= Math.PI * 2;
    while (this.currentDirectionAngle < -Math.PI)
      this.currentDirectionAngle += Math.PI * 2;

    return this.currentDirectionAngle;
  }

  getCurrentDirectionAngle(): number {
    return this.currentDirectionAngle;
  }

  setCurrentDirectionAngle(angle: number): void {
    this.currentDirectionAngle = angle;
  }

  // ========================================================================
  // Cleanup
  // ========================================================================
  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
    this.aimDot.geometry.dispose();
    (this.aimDot.material as THREE.Material).dispose();
    this.aimOrbit.geometry.dispose();
    (this.aimOrbit.material as THREE.Material).dispose();
  }
}
