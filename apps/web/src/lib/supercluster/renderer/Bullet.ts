import type { GameConfig, BulletConfig } from "@ft/supercluster";

import * as THREE from "three";

// ============================================================================
// Bullet Data
// ============================================================================
export interface BulletData {
  id: number;
  // Position as unit vector on sphere (x² + y² + z² = 1)
  position: THREE.Vector3;
  // Movement direction as unit vector tangent to sphere
  velocity: THREE.Vector3;
  // Time remaining before bullet disappears (seconds)
  lifetime: number;
}

// ============================================================================
// Bullet Renderer
// Uses InstancedMesh for efficient rendering of many bullets
// ============================================================================
export class BulletRenderer {
  readonly instancedMesh: THREE.InstancedMesh;
  readonly group: THREE.Group;

  private gameConfig: GameConfig;
  private bulletConfig: BulletConfig;
  private bullets: BulletData[] = [];
  private nextId = 0;

  // Reusable objects for matrix calculations (avoid GC pressure)
  private readonly _matrix = new THREE.Matrix4();
  private readonly _position = new THREE.Vector3();
  private readonly _quaternion = new THREE.Quaternion();
  private readonly _scale = new THREE.Vector3(1, 2, 1); // Scale 2x in Y for ellipse

  // Camera position in world space (for billboard orientation)
  private cameraPosition = new THREE.Vector3(0, 0, 200);

  constructor(gameConfig: GameConfig, bulletConfig: BulletConfig) {
    this.gameConfig = gameConfig;
    this.bulletConfig = bulletConfig;

    this.group = new THREE.Group();

    // Create bullet geometry: ellipse (circle stretched in velocity direction)
    // CircleGeometry(radius, segments) - will be stretched 2x in Y for ellipse
    const geometry = new THREE.CircleGeometry(0.75, 16);

    // Create material with laser look (yellow-orange, emissive)
    const material = new THREE.MeshStandardMaterial({
      color: bulletConfig.color,
      emissive: bulletConfig.color,
      emissiveIntensity: 0.5,
      roughness: 0.3,
      metalness: 0.7,
      side: THREE.DoubleSide, // Visible from both sides
    });

    // Create instanced mesh
    this.instancedMesh = new THREE.InstancedMesh(
      geometry,
      material,
      bulletConfig.maxBullets
    );
    this.instancedMesh.count = 0; // Start with no visible instances
    this.instancedMesh.frustumCulled = false; // Always render

    this.group.add(this.instancedMesh);
  }

  // ========================================================================
  // Spawn Bullets
  // ========================================================================

  /**
   * Spawn a bullet at a position with a velocity direction
   * @param position - Unit vector position on sphere
   * @param velocity - Unit vector direction tangent to sphere
   */
  spawn(position: THREE.Vector3, velocity: THREE.Vector3): BulletData | null {
    // Check max bullets limit (client performance cap)
    if (this.bullets.length >= this.bulletConfig.maxBullets) {
      // Remove oldest bullet to make room
      this.bullets.shift();
    }

    // Convert lifetime from ticks to seconds
    const lifetimeSeconds = this.gameConfig.projectile.lifetime / this.gameConfig.tickRate;

    const bullet: BulletData = {
      id: this.nextId++,
      position: position.clone().normalize(),
      velocity: velocity.clone().normalize(),
      lifetime: lifetimeSeconds,
    };

    this.bullets.push(bullet);
    this.instancedMesh.count = this.bullets.length;

    // Update this instance's matrix
    this.updateInstanceMatrix(this.bullets.length - 1);

    return bullet;
  }

  /**
   * Spawn multiple bullets in a spread pattern (uses GameConfig for mechanics)
   * @param position - Ship position as unit vector
   * @param aimDirection - Center aim direction as unit vector tangent to sphere
   */
  spawnSpread(
    position: THREE.Vector3,
    aimDirection: THREE.Vector3
  ): BulletData[] {
    const spawned: BulletData[] = [];
    const rayCount = this.gameConfig.projectile.rayCount;
    const spreadAngle = this.gameConfig.projectile.spreadAngle;

    if (rayCount === 1) {
      // Single bullet, straight ahead
      const bullet = this.spawn(position, aimDirection);
      if (bullet) spawned.push(bullet);
    } else {
      // Multiple bullets in a fan pattern
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

        const bullet = this.spawn(position, rotatedVelocity);
        if (bullet) spawned.push(bullet);
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
   * Update all bullets (call each frame)
   * @param deltaTime - seconds since last update
   * @returns number of bullets removed this frame
   */
  update(deltaTime: number): number {
    let removed = 0;

    // Update bullets in reverse order so removal doesn't affect iteration
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const bullet = this.bullets[i];

      // Decrease lifetime
      bullet.lifetime -= deltaTime;

      // Remove expired bullets
      if (bullet.lifetime <= 0) {
        this.bullets.splice(i, 1);
        removed++;
        continue;
      }

      // Move along sphere surface
      this.moveOnSphere(bullet, deltaTime);

      // Update instance matrix
      this.updateInstanceMatrix(i);
    }

    // Update instance count
    this.instancedMesh.count = this.bullets.length;

    // Tell Three.js that matrices have changed
    if (this.bullets.length > 0 || removed > 0) {
      this.instancedMesh.instanceMatrix.needsUpdate = true;
    }

    return removed;
  }

  /**
   * Move a bullet along the sphere surface in its velocity direction
   * Uses GameConfig.projectile.speed (rad/tick) converted to rad/sec
   */
  private moveOnSphere(bullet: BulletData, deltaTime: number): void {
    // Convert projectile speed from rad/tick to rad/sec
    const speedRadPerSec = this.gameConfig.projectile.speed * this.gameConfig.tickRate;

    // Angular distance to move this frame
    const angle = speedRadPerSec * deltaTime;

    if (angle === 0) return;

    // Rotate position around the axis perpendicular to both position and velocity
    // This moves the bullet along a great circle in the velocity direction
    const axis = new THREE.Vector3()
      .crossVectors(bullet.position, bullet.velocity)
      .normalize();

    // Create rotation quaternion
    const quat = new THREE.Quaternion().setFromAxisAngle(axis, angle);

    // Rotate position
    bullet.position.applyQuaternion(quat);
    bullet.position.normalize(); // Prevent drift

    // Rotate velocity to stay tangent
    bullet.velocity.applyQuaternion(quat);
    bullet.velocity.normalize();
  }

  /**
   * Update the instance matrix for a specific bullet
   * Uses billboard orientation so bullets always face the camera
   * Bullets are in world space (not planet-relative)
   */
  private updateInstanceMatrix(index: number): void {
    const bullet = this.bullets[index];
    const radius = this.gameConfig.gameSphereRadius;

    // Position on sphere surface in world space
    this._position.copy(bullet.position).multiplyScalar(radius);

    // Billboard orientation: plane faces camera while length follows velocity
    // Y-axis (height) = velocity direction (length of laser streak)
    // Z-axis (normal) = direction toward camera
    // X-axis (width) = perpendicular to both

    const forward = bullet.velocity.clone().normalize();

    // Direction from bullet to camera (in world space)
    const toCamera = new THREE.Vector3()
      .subVectors(this.cameraPosition, this._position)
      .normalize();

    // Right = cross(forward, toCamera), gives us the width direction
    const right = new THREE.Vector3().crossVectors(forward, toCamera).normalize();

    // Recalculate up (plane normal) to ensure orthogonality
    // up = cross(right, forward)
    const up = new THREE.Vector3().crossVectors(right, forward).normalize();

    // Build rotation matrix from basis vectors
    // CircleGeometry: XY plane (scaled 2x in Y for ellipse), Z = normal
    const rotMatrix = new THREE.Matrix4().makeBasis(right, forward, up);
    this._quaternion.setFromRotationMatrix(rotMatrix);

    // Compose matrix (scale is constant for bullets)
    this._matrix.compose(this._position, this._quaternion, this._scale);

    // Set instance matrix
    this.instancedMesh.setMatrixAt(index, this._matrix);
  }

  // ========================================================================
  // Remove Bullets
  // ========================================================================

  /**
   * Remove a bullet by ID
   */
  remove(id: number): boolean {
    const index = this.bullets.findIndex((b) => b.id === id);
    if (index === -1) return false;

    this.bullets.splice(index, 1);
    this.instancedMesh.count = this.bullets.length;

    // Rebuild matrices after removal
    for (let i = index; i < this.bullets.length; i++) {
      this.updateInstanceMatrix(i);
    }

    this.instancedMesh.instanceMatrix.needsUpdate = true;
    return true;
  }

  /**
   * Remove all bullets
   */
  clear(): void {
    this.bullets = [];
    this.instancedMesh.count = 0;
    this.instancedMesh.instanceMatrix.needsUpdate = true;
  }

  // ========================================================================
  // Getters
  // ========================================================================

  getBullets(): readonly BulletData[] {
    return this.bullets;
  }

  getBulletById(id: number): BulletData | undefined {
    return this.bullets.find((b) => b.id === id);
  }

  getCount(): number {
    return this.bullets.length;
  }

  // ========================================================================
  // Configuration
  // ========================================================================

  updateGameConfig(config: GameConfig): void {
    this.gameConfig = config;
    // Rebuild all matrices with new sphere radius
    for (let i = 0; i < this.bullets.length; i++) {
      this.updateInstanceMatrix(i);
    }
    this.instancedMesh.instanceMatrix.needsUpdate = true;
  }

  updateBulletConfig(config: BulletConfig): void {
    this.bulletConfig = config;
    // Update material color
    const material = this.instancedMesh.material as THREE.MeshStandardMaterial;
    material.color.setHex(config.color);
    material.emissive.setHex(config.color);
  }

  setColor(color: number): void {
    const material = this.instancedMesh.material as THREE.MeshStandardMaterial;
    material.color.setHex(color);
    material.emissive.setHex(color);
  }

  // ========================================================================
  // Cleanup
  // ========================================================================

  dispose(): void {
    this.instancedMesh.geometry.dispose();
    (this.instancedMesh.material as THREE.Material).dispose();
  }
}
