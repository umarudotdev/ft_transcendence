import * as THREE from "three";

import { stepShipOnSphere, vec3ToThree } from "./movement";
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
  const position = vec3ToThree(shipPosition).normalize();
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
    // Phase 1 ship-centric de-transport:
    // keep ship anchor fixed; world entities will move in later phases.
    position: { ...shipPosition },
    orientation: {
      x: planetQuaternion.x,
      y: planetQuaternion.y,
      z: planetQuaternion.z,
      w: planetQuaternion.w,
    },
  };
}
