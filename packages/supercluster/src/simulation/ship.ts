import * as THREE from "three";

import { stepShipOnSphere } from "./movement";
import type { InputState, Quat, Vec3 } from "../types";

/**
 * Data-oriented ship step for authoritative runtime.
 * Keeps movement math shared while exposing plain serializable vectors.
 */
export function stepShipState(
  shipPosition: Vec3,
  shipOrientation: Quat,
  keys: InputState,
  deltaTicks: number,
  speedRadPerTick: number
): { moved: boolean; position: Vec3; orientation: Quat } {
  const position = new THREE.Vector3(
    shipPosition.x,
    shipPosition.y,
    shipPosition.z
  ).normalize();
  const planetQuaternion = new THREE.Quaternion(
    shipOrientation.x,
    shipOrientation.y,
    shipOrientation.z,
    shipOrientation.w
  ).normalize();
  const scratchQuat = new THREE.Quaternion();

  const moved = stepShipOnSphere(
    planetQuaternion,
    position,
    keys,
    deltaTicks,
    speedRadPerTick,
    scratchQuat
  );

  return {
    moved,
    position: { x: position.x, y: position.y, z: position.z },
    orientation: {
      x: planetQuaternion.x,
      y: planetQuaternion.y,
      z: planetQuaternion.z,
      w: planetQuaternion.w,
    },
  };
}
