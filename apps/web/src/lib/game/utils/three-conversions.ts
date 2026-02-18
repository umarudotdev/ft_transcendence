import type { Vec3Like } from "gl-matrix";

import * as THREE from "three";

type Vec3Input = Vec3Like | readonly [number, number, number];

export function vec3ToThree([x, y, z]: Vec3Input): THREE.Vector3 {
  return new THREE.Vector3(x, y, z);
}

export function copyVec3ToThree(
  out: THREE.Vector3,
  [x, y, z]: Vec3Input
): THREE.Vector3 {
  return out.set(x, y, z);
}
