import { GAME_CONST, vec3ToThree, type ProjectileState } from "@ft/supercluster";
import * as THREE from "three";

import { RENDERER_CONST } from "../constants/renderer";

const EPS = 1e-8;

export interface ProjectileData {
  id: number;
  position: THREE.Vector3;
  direction: THREE.Vector3;
}

// Snapshot-driven projectile renderer. No local mechanics.
export class ProjectileRenderer {
  readonly instancedMesh: THREE.InstancedMesh;
  readonly group: THREE.Group;

  private projectiles: ProjectileData[] = [];

  private readonly _matrix = new THREE.Matrix4();
  private readonly _position = new THREE.Vector3();
  private readonly _quaternion = new THREE.Quaternion();
  private readonly _scale = new THREE.Vector3(
    1,
    RENDERER_CONST.PROJECTILE_STRETCH,
    1
  );

  private cameraPosition = new THREE.Vector3(0, 0, 200);

  constructor() {
    this.group = new THREE.Group();

    const geometry = new THREE.CircleGeometry(
      RENDERER_CONST.PROJECTILE_RADIUS,
      16
    );

    const material = new THREE.MeshStandardMaterial({
      color: RENDERER_CONST.PROJECTILE_COLOR,
      emissive: RENDERER_CONST.PROJECTILE_COLOR,
      emissiveIntensity: RENDERER_CONST.PROJECTILE_EMISSIVE_INT,
      roughness: RENDERER_CONST.PROJECTILE_ROUGHNESS,
      metalness: RENDERER_CONST.PROJECTILE_METALNESS,
      side: THREE.DoubleSide,
    });

    this.instancedMesh = new THREE.InstancedMesh(
      geometry,
      material,
      RENDERER_CONST.PROJECTILE_MAX_COUNT
    );
    this.instancedMesh.count = 0;
    this.instancedMesh.frustumCulled = false;

    this.group.add(this.instancedMesh);
  }

  setCameraPosition(position: THREE.Vector3): void {
    this.cameraPosition.copy(position);
  }

  syncFromStates(states: readonly ProjectileState[]): void {
    const capped = states.slice(-RENDERER_CONST.PROJECTILE_MAX_COUNT);
    this.projectiles = capped.map((state) => ({
      id: state.id,
      position: vec3ToThree(state.position).normalize(),
      direction: vec3ToThree(state.direction).normalize(),
    }));

    this.instancedMesh.count = this.projectiles.length;
    for (let i = 0; i < this.projectiles.length; i++) {
      this.updateInstanceMatrix(i);
    }
    this.instancedMesh.instanceMatrix.needsUpdate = true;
  }

  private updateInstanceMatrix(index: number): void {
    const projectile = this.projectiles[index];

    this._position
      .copy(projectile.position)
      .multiplyScalar(GAME_CONST.SPHERE_RADIUS);

    const forward = projectile.direction.clone().normalize();
    const toCamera = new THREE.Vector3()
      .subVectors(this.cameraPosition, this._position)
      .normalize();

    const right = new THREE.Vector3().crossVectors(forward, toCamera);
    if (right.lengthSq() < EPS) {
      const fallbackAxis =
        Math.abs(forward.y) < 0.99
          ? new THREE.Vector3(0, 1, 0)
          : new THREE.Vector3(1, 0, 0);
      right.crossVectors(forward, fallbackAxis);
    }
    right.normalize();

    const up = new THREE.Vector3().crossVectors(right, forward).normalize();

    const rotMatrix = new THREE.Matrix4().makeBasis(right, forward, up);
    this._quaternion.setFromRotationMatrix(rotMatrix);

    this._matrix.compose(this._position, this._quaternion, this._scale);
    this.instancedMesh.setMatrixAt(index, this._matrix);
  }

  clear(): void {
    this.projectiles = [];
    this.instancedMesh.count = 0;
    this.instancedMesh.instanceMatrix.needsUpdate = true;
  }

  getProjectiles(): readonly ProjectileData[] {
    return this.projectiles;
  }

  getCount(): number {
    return this.projectiles.length;
  }

  dispose(): void {
    this.instancedMesh.geometry.dispose();
    (this.instancedMesh.material as THREE.Material).dispose();
  }
}
