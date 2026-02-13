import * as THREE from "three";

import { GAME_CONST } from "../constants";
import { stepShipOnSphere, threeToVec3, vec3ToThree } from "./movement";
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

  // Single source of truth: derive ship surface position from orientation.
  // This keeps ship-vs-world frame coherent under combined rotations.
  const derivedPosition = vec3ToThree(GAME_CONST.SHIP_INITIAL_POS)
    .applyQuaternion(planetQuaternion.clone().invert())
    .normalize();

  return {
    moved,
    position: threeToVec3(derivedPosition),
    orientation: {
      x: planetQuaternion.x,
      y: planetQuaternion.y,
      z: planetQuaternion.z,
      w: planetQuaternion.w,
    },
  };
}
