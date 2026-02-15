import type { QuatLike, Vec3Like } from "gl-matrix";

import * as THREE from "three";

export function vec3ToThree([x, y, z]: Vec3Like): THREE.Vector3 {
  return new THREE.Vector3(x, y, z);
}

export function threeToVec3(v: THREE.Vector3): Vec3Like {
  return [v.x, v.y, v.z];
}

export function quatToThree([x, y, z, w]: QuatLike): THREE.Quaternion {
  return new THREE.Quaternion(x, y, z, w);
}

export function threeToQuat(q: THREE.Quaternion): QuatLike {
  return [q.x, q.y, q.z, q.w];
}
