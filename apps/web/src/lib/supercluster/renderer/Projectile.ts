import { GAME_CONST, DEFAULT_GAMEPLAY } from "@ft/supercluster";
import * as THREE from "three";

import { RENDERER_CONST } from "../constants/renderer";

// ============================================================================
// Projectile Data
// ============================================================================
export interface ProjectileData {
  id: number;
  // Position as unit vector on sphere (x² + y² + z² = 1)
  position: THREE.Vector3;
  // Movement direction as unit vector tangent to sphere
  velocity: THREE.Vector3;
  // Time remaining before projectile disappears (seconds)
  lifetime: number;
}

// ============================================================================
// Projectile Renderer
// Uses InstancedMesh for efficient rendering of many projectiles
// Uses GAME_CONST for physics, DEFAULT_GAMEPLAY for gameplay values
// ============================================================================
export class ProjectileRenderer {
  readonly instancedMesh: THREE.InstancedMesh;
  readonly group: THREE.Group;

  private projectiles: ProjectileData[] = [];
  private nextId = 0;

  // Reusable objects for matrix calculations (avoid GC pressure)
  private readonly _matrix = new THREE.Matrix4();
  private readonly _position = new THREE.Vector3();
  private readonly _quaternion = new THREE.Quaternion();
  private readonly _scale = new THREE.Vector3(
    1,
    RENDERER_CONST.PROJECTILE_STRETCH,
    1
  );

  // Camera position in world space (for billboard orientation)
  private cameraPosition = new THREE.Vector3(0, 0, 200);

  constructor() {
    this.group = new THREE.Group();

    // Create projectile geometry: ellipse (circle stretched in velocity direction)
    const geometry = new THREE.CircleGeometry(
      RENDERER_CONST.PROJECTILE_RADIUS,
      16
    );

    // Create material with laser look (emissive glow)
    const material = new THREE.MeshStandardMaterial({
      color: RENDERER_CONST.PROJECTILE_COLOR,
      emissive: RENDERER_CONST.PROJECTILE_COLOR,
      emissiveIntensity: RENDERER_CONST.PROJECTILE_EMISSIVE_INT,
      roughness: RENDERER_CONST.PROJECTILE_ROUGHNESS,
      metalness: RENDERER_CONST.PROJECTILE_METALNESS,
      side: THREE.DoubleSide,
    });

    // Create instanced mesh
    this.instancedMesh = new THREE.InstancedMesh(
      geometry,
      material,
      RENDERER_CONST.PROJECTILE_MAX_COUNT
    );
    this.instancedMesh.count = 0; // Start with no visible instances
    this.instancedMesh.frustumCulled = false; // Always render

    this.group.add(this.instancedMesh);
  }

  // ========================================================================
  // Spawn Projectiles
  // ========================================================================

  /**
   * Spawn a projectile at a position with a velocity direction
   * @param position - Unit vector position on sphere
   * @param velocity - Unit vector direction tangent to sphere
   */
  spawn(
    position: THREE.Vector3,
    velocity: THREE.Vector3
  ): ProjectileData | null {
    // Check max projectiles limit (client performance cap)
    if (this.projectiles.length >= RENDERER_CONST.PROJECTILE_MAX_COUNT) {
      // Remove oldest projectile to make room
      this.projectiles.shift();
    }

    // Convert lifetime from ticks to seconds using GAME_CONST
    const lifetimeSeconds =
      GAME_CONST.PROJECTILE_LIFETIME / GAME_CONST.TICK_RATE;

    const projectile: ProjectileData = {
      id: this.nextId++,
      position: position.clone().normalize(),
      velocity: velocity.clone().normalize(),
      lifetime: lifetimeSeconds,
    };

    this.projectiles.push(projectile);
    this.instancedMesh.count = this.projectiles.length;

    // Update this instance's matrix
    this.updateInstanceMatrix(this.projectiles.length - 1);

    return projectile;
  }

  /**
   * Spawn multiple projectiles in a spread pattern
   * Uses DEFAULT_GAMEPLAY for rayCount and GAME_CONST for spreadAngle
   * @param position - Ship position as unit vector
   * @param aimDirection - Center aim direction as unit vector tangent to sphere
   */
  spawnSpread(
    position: THREE.Vector3,
    aimDirection: THREE.Vector3
  ): ProjectileData[] {
    const spawned: ProjectileData[] = [];
    const rayCount = DEFAULT_GAMEPLAY.projectileRayCount;
    const spreadAngle = GAME_CONST.PROJECTILE_SPREAD_ANGLE;

    if (rayCount === 1) {
      // Single projectile, straight ahead
      const projectile = this.spawn(position, aimDirection);
      if (projectile) spawned.push(projectile);
    } else {
      // Multiple projectiles in a fan pattern
      // Calculate angles: centered around aim direction
      const halfSpread = ((rayCount - 1) * spreadAngle) / 2;

      for (let i = 0; i < rayCount; i++) {
        const angleOffset = -halfSpread + i * spreadAngle;

        // Rotate aim direction around the position normal
        const rotatedVelocity = this.rotateVelocityAroundNormal(
          aimDirection,
          position,
          angleOffset
        );

        const projectile = this.spawn(position, rotatedVelocity);
        if (projectile) spawned.push(projectile);
      }
    }

    return spawned;
  }

  /**
   * Rotate a velocity vector around the sphere normal (position)
   */
  private rotateVelocityAroundNormal(
    velocity: THREE.Vector3,
    normal: THREE.Vector3,
    angle: number
  ): THREE.Vector3 {
    const quat = new THREE.Quaternion().setFromAxisAngle(normal, angle);
    return velocity.clone().applyQuaternion(quat).normalize();
  }

  // ========================================================================
  // Update
  // ========================================================================

  /**
   * Set camera position in world space (for billboard orientation)
   */
  setCameraPosition(position: THREE.Vector3): void {
    this.cameraPosition.copy(position);
  }

  /**
   * Update all projectiles (call each frame)
   * @param deltaTime - seconds since last update
   * @returns number of projectiles removed this frame
   */
  update(deltaTime: number): number {
    let removed = 0;

    // Update projectiles in reverse order so removal doesn't affect iteration
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const projectile = this.projectiles[i];

      // Decrease lifetime
      projectile.lifetime -= deltaTime;

      // Remove expired projectiles
      if (projectile.lifetime <= 0) {
        this.projectiles.splice(i, 1);
        removed++;
        continue;
      }

      // Move along sphere surface
      this.moveOnSphere(projectile, deltaTime);

      // Update instance matrix
      this.updateInstanceMatrix(i);
    }

    // Update instance count
    this.instancedMesh.count = this.projectiles.length;

    // Tell Three.js that matrices have changed
    if (this.projectiles.length > 0 || removed > 0) {
      this.instancedMesh.instanceMatrix.needsUpdate = true;
    }

    return removed;
  }

  /**
   * Move a projectile along the sphere surface in its velocity direction
   * Uses GAME_CONST.PROJECTILE_SPEED (rad/tick) converted to rad/sec
   */
  private moveOnSphere(projectile: ProjectileData, deltaTime: number): void {
    // Convert projectile speed from rad/tick to rad/sec using GAME_CONST
    const speedRadPerSec = GAME_CONST.PROJECTILE_SPEED * GAME_CONST.TICK_RATE;

    // Angular distance to move this frame
    const angle = speedRadPerSec * deltaTime;

    if (angle === 0) return;

    // Rotate position around the axis perpendicular to both position and velocity
    // This moves the projectile along a great circle in the velocity direction
    const axis = new THREE.Vector3()
      .crossVectors(projectile.position, projectile.velocity)
      .normalize();

    // Create rotation quaternion
    const quat = new THREE.Quaternion().setFromAxisAngle(axis, angle);

    // Rotate position
    projectile.position.applyQuaternion(quat);
    projectile.position.normalize(); // Prevent drift

    // Rotate velocity to stay tangent
    projectile.velocity.applyQuaternion(quat);
    projectile.velocity.normalize();
  }

  /**
   * Update the instance matrix for a specific projectile
   * Uses billboard orientation so projectiles always face the camera
   * Projectiles are in world space (not planet-relative)
   */
  private updateInstanceMatrix(index: number): void {
    const projectile = this.projectiles[index];

    // Position on sphere surface in world space using GAME_CONST
    this._position
      .copy(projectile.position)
      .multiplyScalar(GAME_CONST.SPHERE_RADIUS);

    // Billboard orientation: plane faces camera while length follows velocity
    // Y-axis (height) = velocity direction (length of laser streak)
    // Z-axis (normal) = direction toward camera
    // X-axis (width) = perpendicular to both

    const forward = projectile.velocity.clone().normalize();

    // Direction from projectile to camera (in world space)
    const toCamera = new THREE.Vector3()
      .subVectors(this.cameraPosition, this._position)
      .normalize();

    // Right = cross(forward, toCamera), gives us the width direction
    const right = new THREE.Vector3()
      .crossVectors(forward, toCamera)
      .normalize();

    // Recalculate up (plane normal) to ensure orthogonality
    // up = cross(right, forward)
    const up = new THREE.Vector3().crossVectors(right, forward).normalize();

    // Build rotation matrix from basis vectors
    // CircleGeometry: XY plane (scaled 2x in Y for ellipse), Z = normal
    const rotMatrix = new THREE.Matrix4().makeBasis(right, forward, up);
    this._quaternion.setFromRotationMatrix(rotMatrix);

    // Compose matrix (scale is constant for projectiles)
    this._matrix.compose(this._position, this._quaternion, this._scale);

    // Set instance matrix
    this.instancedMesh.setMatrixAt(index, this._matrix);
  }

  // ========================================================================
  // Remove Projectiles
  // ========================================================================

  /**
   * Remove a projectile by ID
   */
  remove(id: number): boolean {
    const index = this.projectiles.findIndex((p) => p.id === id);
    if (index === -1) return false;

    this.projectiles.splice(index, 1);
    this.instancedMesh.count = this.projectiles.length;

    // Rebuild matrices after removal
    for (let i = index; i < this.projectiles.length; i++) {
      this.updateInstanceMatrix(i);
    }

    this.instancedMesh.instanceMatrix.needsUpdate = true;
    return true;
  }

  /**
   * Remove all projectiles
   */
  clear(): void {
    this.projectiles = [];
    this.instancedMesh.count = 0;
    this.instancedMesh.instanceMatrix.needsUpdate = true;
  }

  // ========================================================================
  // Getters
  // ========================================================================

  getProjectiles(): readonly ProjectileData[] {
    return this.projectiles;
  }

  getProjectileById(id: number): ProjectileData | undefined {
    return this.projectiles.find((p) => p.id === id);
  }

  getCount(): number {
    return this.projectiles.length;
  }

  // ========================================================================
  // Cleanup
  // ========================================================================

  dispose(): void {
    this.instancedMesh.geometry.dispose();
    (this.instancedMesh.material as THREE.Material).dispose();
  }
}
