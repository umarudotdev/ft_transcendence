import type { InputState } from "../types";

/**
 * Compute ship heading angle in tangent/screen space from movement keys.
 * Returns null when no movement keys are active.
 *
 * Canonical heading convention:
 * - forward = 0 (up), right = +PI/2, backward = PI, left = -PI/2
 */
export function getTargetHeadingFromInput(keys: InputState): number | null {
  let inputX = 0;
  let inputY = 0;

  if (keys.forward) inputY += 1;
  if (keys.backward) inputY -= 1;
  if (keys.right) inputX += 1;
  if (keys.left) inputX -= 1;

  if (inputX === 0 && inputY === 0) return null;
  return Math.atan2(inputX, inputY);
}

/**
 * Normalize any angle to [0, 2π).
 */
export function normalizeAimAngle(angle: number): number {
  const twoPi = Math.PI * 2;
  const normalized = angle % twoPi;
  return normalized < 0 ? normalized + twoPi : normalized;
}

