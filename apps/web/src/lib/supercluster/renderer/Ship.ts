import type { ShipState, GameConfig, RendererConfig } from "@ft/supercluster";

import * as THREE from "three";

// ============================================================================
// Ship Renderer
// Renders the player's ship as a triangle on the sphere surface
// Also renders the aim dot that orbits the ship
// ============================================================================
export class ShipRenderer {
  readonly mesh: THREE.Mesh;
  readonly aimDot: THREE.Mesh;
  readonly aimOrbit: THREE.LineLoop; // Circle showing aim dot path
  readonly group: THREE.Group; // Contains ship, aim dot, and orbit circle

  private config: GameConfig;
  private rendererConfig: RendererConfig;

  // Current ship direction (where tip points) - used for lerp
  private currentDirectionAngle = 0;

  constructor(config: GameConfig, rendererConfig: RendererConfig) {
    this.config = config;
    this.rendererConfig = rendererConfig;

    // Create group to hold ship, aim dot, and orbit circle
    this.group = new THREE.Group();
    this.group.renderOrder = 100;

    // Create triangle geometry for ship
    const geometry = this.createTriangleGeometry();
    const material = new THREE.MeshStandardMaterial({
      color: 0x888888, // Grey
      metalness: 0, // No metallic
      roughness: 0.8, // Matte finish
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
      this.rendererConfig.aimDotSize,
      16,
      16
    );
    const material = new THREE.MeshBasicMaterial({
      color: this.rendererConfig.aimDotColor,
    });
    const dot = new THREE.Mesh(geometry, material);
    dot.renderOrder = 101; // Above ship
    return dot;
  }

  private createAimOrbit(): THREE.LineLoop {
    // Create a circle using points
    const segments = 64;
    const radius = this.rendererConfig.aimDotOrbitRadius;
    const points: THREE.Vector3[] = [];

    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      points.push(
        new THREE.Vector3(
          Math.sin(angle) * radius,
          -Math.cos(angle) * radius, // Negative because forward is -Y
          0
        )
      );
    }

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
      color: this.rendererConfig.aimDotColor,
      transparent: true,
      opacity: 0.3,
    });

    const orbit = new THREE.LineLoop(geometry, material);
    orbit.renderOrder = 99; // Below ship and dot
    return orbit;
  }

  private createTriangleGeometry(): THREE.BufferGeometry {
    // 3D wedge shape: tip at front (flat), back raised up
    // Ship lies on XY plane (tangent to sphere at (0,0,radius))
    // Tip points toward -Y (forward/north on sphere)
    // Back is raised in +Z (up from surface)
    const size = 4;
    const height = 2; // Height of the back of the ship

    // Define vertices for a 3D wedge (2 triangles)
    const vertices = new Float32Array([
      // Bottom triangle (on the surface)
      0,
      -size,
      0, // Tip (forward)
      -size * 0.6,
      size * 0.5,
      0, // Back left bottom
      size * 0.6,
      size * 0.5,
      0, // Back right bottom

      // Top triangle (raised)
      0,
      -size,
      0, // Tip (same as bottom - flat at front)
      size * 0.6,
      size * 0.5,
      0, // Back right bottom
      size * 0.6,
      size * 0.5,
      height, // Back right top

      0,
      -size,
      0, // Tip
      size * 0.6,
      size * 0.5,
      height, // Back right top
      -size * 0.6,
      size * 0.5,
      height, // Back left top

      0,
      -size,
      0, // Tip
      -size * 0.6,
      size * 0.5,
      height, // Back left top
      -size * 0.6,
      size * 0.5,
      0, // Back left bottom

      // Back face (closes the wedge)
      -size * 0.6,
      size * 0.5,
      0, // Back left bottom
      -size * 0.6,
      size * 0.5,
      height, // Back left top
      size * 0.6,
      size * 0.5,
      height, // Back right top

      -size * 0.6,
      size * 0.5,
      0, // Back left bottom
      size * 0.6,
      size * 0.5,
      height, // Back right top
      size * 0.6,
      size * 0.5,
      0, // Back right bottom
    ]);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
    geometry.computeVertexNormals();

    return geometry;
  }

  // ========================================================================
  // Update from Game State
  // ========================================================================
  updateFromState(
    state: ShipState,
    directionAngle: number,
    aimAngle: number
  ): void {
    // Ship is visually FIXED at (0, 0, gameSphereRadius) - front of sphere
    // The planet rotates under the ship to create movement illusion
    const radius = this.config.gameSphereRadius;

    // Fixed position: always at the front of the sphere (facing camera)
    this.group.position.set(0, 0, radius);

    // Apply direction rotation (where ship tip points)
    // directionAngle: 0 = forward (-Y), PI/2 = right (+X), etc.
    this.mesh.rotation.set(0, 0, -directionAngle);

    // Position aim dot on orbit circle around ship
    // aimAngle: 0 = forward, positive = clockwise
    const orbitRadius = this.rendererConfig.aimDotOrbitRadius;
    const dotX = Math.sin(aimAngle) * orbitRadius;
    const dotY = -Math.cos(aimAngle) * orbitRadius; // Negative because forward is -Y
    this.aimDot.position.set(dotX, dotY, 0);

    // Handle invincibility visual (blinking)
    if (state.invincible) {
      this.mesh.visible = Math.floor(Date.now() / 100) % 2 === 0;
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
      1 - Math.exp(-this.rendererConfig.shipRotationSpeed * deltaTime);
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
  // Configuration
  // ========================================================================
  updateConfig(config: GameConfig): void {
    this.config = config;
  }

  updateRendererConfig(rendererConfig: RendererConfig): void {
    this.rendererConfig = rendererConfig;
  }

  setColor(color: number): void {
    (this.mesh.material as THREE.MeshStandardMaterial).color.setHex(color);
  }

  setAimDotColor(color: number): void {
    (this.aimDot.material as THREE.MeshBasicMaterial).color.setHex(color);
    (this.aimOrbit.material as THREE.LineBasicMaterial).color.setHex(color);
  }

  setAimDotSize(size: number): void {
    this.aimDot.geometry.dispose();
    this.aimDot.geometry = new THREE.SphereGeometry(size, 16, 16);
  }

  setAimDotOrbitRadius(radius: number): void {
    this.rendererConfig.aimDotOrbitRadius = radius;
    // Rebuild orbit circle with new radius
    this.rebuildAimOrbit();
  }

  private rebuildAimOrbit(): void {
    const segments = 64;
    const radius = this.rendererConfig.aimDotOrbitRadius;
    const points: THREE.Vector3[] = [];

    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      points.push(
        new THREE.Vector3(
          Math.sin(angle) * radius,
          -Math.cos(angle) * radius,
          0
        )
      );
    }

    this.aimOrbit.geometry.dispose();
    this.aimOrbit.geometry = new THREE.BufferGeometry().setFromPoints(points);
  }

  setRotationSpeed(speed: number): void {
    this.rendererConfig.shipRotationSpeed = speed;
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
