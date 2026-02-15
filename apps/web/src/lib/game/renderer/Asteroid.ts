import type { AsteroidState } from "@ft/supercluster";
import type { Vec3Like } from "gl-matrix";

import { GAME_CONST, GAMEPLAY_CONST } from "@ft/supercluster";
import * as THREE from "three";

import { RENDERER_CONST } from "../constants/renderer";
import { vec3ToThree } from "../utils/three-conversions";

const EPS = 1e-8;
const FALLBACK_RADIUS = 1;

export type AsteroidSize = AsteroidState["size"];

export interface AsteroidData {
  state: AsteroidState;
  position: THREE.Vector3;
  direction: THREE.Vector3;
  rotationSpeedX: number;
  rotationSpeedY: number;
  rotationX: number;
  rotationY: number;
}

// Snapshot-driven asteroid renderer. No local mechanics.
export class AsteroidRenderer {
  readonly instancedMesh: THREE.InstancedMesh;
  readonly group: THREE.Group;

  private asteroids: AsteroidData[] = [];

  private readonly _matrix = new THREE.Matrix4();
  private readonly _position = new THREE.Vector3();
  private readonly _quaternion = new THREE.Quaternion();
  private readonly _scale = new THREE.Vector3();
  private readonly _euler = new THREE.Euler();

  constructor(maxAsteroids = 100) {
    this.group = new THREE.Group();

    const geometry = new THREE.IcosahedronGeometry(1, 0);
    const material = new THREE.MeshStandardMaterial({
      color: RENDERER_CONST.ASTEROID_COLOR,
      roughness: RENDERER_CONST.ASTEROID_ROUGHNESS,
      metalness: RENDERER_CONST.ASTEROID_METALNESS,
      flatShading: true,
    });

    this.instancedMesh = new THREE.InstancedMesh(
      geometry,
      material,
      maxAsteroids
    );
    this.instancedMesh.count = 0;
    this.instancedMesh.frustumCulled = false;

    this.group.add(this.instancedMesh);
  }

  syncFromStates(states: readonly AsteroidState[]): void {
    const previousById = new Map<number, AsteroidData>();
    for (const asteroid of this.asteroids) {
      previousById.set(asteroid.state.id, asteroid);
    }

    const tickSeconds = 1 / GAME_CONST.TICK_RATE;
    this.asteroids = states.map((state) => {
      const previous = previousById.get(state.id);
      const rotationSpeedX =
        previous?.rotationSpeedX ??
        (Math.random() - 0.5) * RENDERER_CONST.ASTEROID_ROT_SPEED;
      const rotationSpeedY =
        previous?.rotationSpeedY ??
        (Math.random() - 0.5) * RENDERER_CONST.ASTEROID_ROT_SPEED;

      return {
        state: {
          ...state,
          position: [...state.position] as Vec3Like,
          direction: [...state.direction] as Vec3Like,
        },
        position: vec3ToThree(state.position).normalize(),
        direction: vec3ToThree(state.direction).normalize(),
        rotationSpeedX,
        rotationSpeedY,
        rotationX:
          (previous?.rotationX ?? Math.random() * Math.PI * 2) +
          rotationSpeedX * tickSeconds,
        rotationY:
          (previous?.rotationY ?? Math.random() * Math.PI * 2) +
          rotationSpeedY * tickSeconds,
      };
    });

    this.instancedMesh.count = this.asteroids.length;
    for (let i = 0; i < this.asteroids.length; i++) {
      this.updateInstanceMatrix(i);
    }
    this.instancedMesh.instanceMatrix.needsUpdate = true;
    if (this.instancedMesh.instanceColor) {
      this.instancedMesh.instanceColor.needsUpdate = true;
    }
  }

  private updateInstanceMatrix(index: number): void {
    const asteroid = this.asteroids[index];

    this._position
      .copy(asteroid.position)
      .multiplyScalar(GAME_CONST.SPHERE_RADIUS);

    const normal = asteroid.position.clone().normalize();
    const tangent = asteroid.direction.clone().normalize();

    if (tangent.lengthSq() <= EPS) {
      const fallbackAxis =
        Math.abs(normal.y) < 0.99
          ? new THREE.Vector3(0, 1, 0)
          : new THREE.Vector3(1, 0, 0);
      tangent.crossVectors(fallbackAxis, normal).normalize();
    }

    const bitangent = new THREE.Vector3().crossVectors(normal, tangent);
    if (bitangent.lengthSq() <= EPS) {
      const fallbackAxis =
        Math.abs(normal.y) < 0.99
          ? new THREE.Vector3(0, 1, 0)
          : new THREE.Vector3(1, 0, 0);
      tangent.crossVectors(fallbackAxis, normal).normalize();
      bitangent.crossVectors(normal, tangent).normalize();
    } else {
      bitangent.normalize();
    }

    const rotMatrix = new THREE.Matrix4().makeBasis(tangent, bitangent, normal);
    this._quaternion.setFromRotationMatrix(rotMatrix);

    this._euler.set(asteroid.rotationX, asteroid.rotationY, 0);
    const selfRotation = new THREE.Quaternion().setFromEuler(this._euler);
    this._quaternion.multiply(selfRotation);

    const visualSize =
      GAMEPLAY_CONST.ASTEROID_DIAM[asteroid.state.size - 1] ?? FALLBACK_RADIUS;
    this._scale.set(visualSize, visualSize, visualSize);

    this._matrix.compose(this._position, this._quaternion, this._scale);
    this.instancedMesh.setMatrixAt(index, this._matrix);

    if (asteroid.state.isHit) {
      this.instancedMesh.setColorAt(
        index,
        new THREE.Color(RENDERER_CONST.ASTEROID_HIT_COLOR)
      );
    } else {
      this.instancedMesh.setColorAt(index, new THREE.Color(0xffffff));
    }
  }

  getAsteroids(): readonly AsteroidData[] {
    return this.asteroids;
  }

  getCount(): number {
    return this.asteroids.length;
  }

  dispose(): void {
    this.instancedMesh.geometry.dispose();
    (this.instancedMesh.material as THREE.Material).dispose();
  }

  clear(): void {
    this.asteroids = [];
    this.instancedMesh.count = 0;
    this.instancedMesh.instanceMatrix.needsUpdate = true;
  }
}
