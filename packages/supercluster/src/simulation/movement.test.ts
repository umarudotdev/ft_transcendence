import type { Vec3Like } from "gl-matrix";

import { describe, expect, it } from "bun:test";
import { Vec3 } from "gl-matrix";

import type { InputState } from "../types";

import {
  applyInverseShipInputTransform,
  moveOnSphere,
  normalizeVec3,
  randomTangentVec3,
  randomUnitVec3,
  stepSurfaceMotionState,
} from "./movement";

const noKeys: InputState = {
  forward: false,
  backward: false,
  left: false,
  right: false,
};

function vecLength(v: Vec3Like): number {
  return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
}

function expectUnitLength(v: Vec3Like) {
  expect(vecLength(v)).toBeCloseTo(1, 6);
}

describe("normalizeVec3", () => {
  it("normalizes a non-zero vector to unit length", () => {
    const result = normalizeVec3([3, 0, 0]);
    expectUnitLength(result);
    expect(result[0]).toBeCloseTo(1, 10);
  });

  it("returns fallback for zero vector", () => {
    const result = normalizeVec3([0, 0, 0]);
    expect(result).toEqual([0, 0, 1]);
  });

  it("returns custom fallback for zero vector", () => {
    const result = normalizeVec3([0, 0, 0], [1, 0, 0]);
    expect(result).toEqual([1, 0, 0]);
  });

  it("does not mutate input", () => {
    const input: Vec3Like = [3, 4, 0];
    normalizeVec3(input);
    expect(input).toEqual([3, 4, 0]);
  });
});

describe("randomUnitVec3", () => {
  it("produces unit-length vectors", () => {
    for (let i = 0; i < 20; i++) {
      expectUnitLength(randomUnitVec3());
    }
  });
});

describe("randomTangentVec3", () => {
  it("produces a vector orthogonal to the position", () => {
    const pos: Vec3Like = [0, 0, 1];
    for (let i = 0; i < 20; i++) {
      const tangent = randomTangentVec3(pos);
      expectUnitLength(tangent);
      const dot = Vec3.dot(tangent, pos);
      expect(Math.abs(dot)).toBeLessThan(1e-6);
    }
  });

  it("works for non-axis-aligned positions", () => {
    const pos: Vec3Like = normalizeVec3([1, 1, 1]);
    const tangent = randomTangentVec3(pos);
    expectUnitLength(tangent);
    const dot = Vec3.dot(tangent, pos);
    expect(Math.abs(dot)).toBeLessThan(1e-6);
  });
});

describe("moveOnSphere", () => {
  it("preserves unit-length position and velocity", () => {
    const pos: Vec3Like = [0, 0, 1];
    const vel: Vec3Like = [1, 0, 0];
    moveOnSphere(pos, vel, 0.1);

    expectUnitLength(pos);
    expectUnitLength(vel);
  });

  it("does nothing for zero angle", () => {
    const pos: Vec3Like = [0, 0, 1];
    const vel: Vec3Like = [1, 0, 0];
    moveOnSphere(pos, vel, 0);

    expect(pos).toEqual([0, 0, 1]);
    expect(vel).toEqual([1, 0, 0]);
  });

  it("mutates position and velocity in place", () => {
    const pos: Vec3Like = [0, 0, 1];
    const vel: Vec3Like = [1, 0, 0];
    moveOnSphere(pos, vel, 0.5);

    // Position should have changed from [0,0,1]
    expect(pos[2]).not.toBeCloseTo(1, 3);
  });

  it("moves position along great circle", () => {
    const pos: Vec3Like = [0, 0, 1];
    const vel: Vec3Like = [1, 0, 0];
    moveOnSphere(pos, vel, Math.PI / 2);

    // After 90-degree rotation toward +X, should be near [1,0,0]
    expect(pos[0]).toBeCloseTo(1, 4);
    expect(pos[2]).toBeCloseTo(0, 4);
  });
});

describe("stepSurfaceMotionState", () => {
  it("returns new position/direction without mutating inputs", () => {
    const pos: Vec3Like = [0, 0, 1];
    const dir: Vec3Like = [1, 0, 0];
    const result = stepSurfaceMotionState(pos, dir, 0.1);

    // Inputs unchanged
    expect(pos).toEqual([0, 0, 1]);
    expect(dir).toEqual([1, 0, 0]);

    // Outputs are unit-length
    expectUnitLength(result.position);
    expectUnitLength(result.direction);
  });

  it("returns copies even for zero angle", () => {
    const pos: Vec3Like = [0, 0, 1];
    const dir: Vec3Like = [1, 0, 0];
    const result = stepSurfaceMotionState(pos, dir, 0);

    expect(result.position).toEqual(pos);
    expect(result.direction).toEqual(dir);
    // Should be different references
    result.position[0] = 999;
    expect(pos[0]).toBe(0);
  });
});

describe("applyInverseShipInputTransform", () => {
  it("returns moved=false with no keys pressed", () => {
    const pos: Vec3Like = [0, 0, 1];
    const dir: Vec3Like = [1, 0, 0];
    const result = applyInverseShipInputTransform(pos, dir, noKeys, 1, 0.01);

    expect(result.moved).toBe(false);
  });

  it("returns moved=true when forward is pressed", () => {
    const pos: Vec3Like = [0, 0, 1];
    const dir: Vec3Like = [1, 0, 0];
    const keys: InputState = { ...noKeys, forward: true };
    const result = applyInverseShipInputTransform(pos, dir, keys, 1, 0.01);

    expect(result.moved).toBe(true);
  });

  it("does not mutate input arrays", () => {
    const pos: Vec3Like = [0, 0, 1];
    const dir: Vec3Like = [1, 0, 0];
    const keys: InputState = { ...noKeys, forward: true };
    applyInverseShipInputTransform(pos, dir, keys, 1, 0.01);

    expect(pos).toEqual([0, 0, 1]);
    expect(dir).toEqual([1, 0, 0]);
  });

  it("opposing keys cancel out (no movement)", () => {
    const pos: Vec3Like = [0, 0, 1];
    const dir: Vec3Like = [1, 0, 0];
    const keys: InputState = {
      forward: true,
      backward: true,
      left: false,
      right: false,
    };
    const result = applyInverseShipInputTransform(pos, dir, keys, 1, 0.01);

    expect(result.moved).toBe(false);
  });
});
