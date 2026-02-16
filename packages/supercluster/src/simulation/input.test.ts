import { describe, expect, it } from "bun:test";

import type { InputState } from "../types";

import { getTargetHeadingFromInput, normalizeAimAngle } from "./input";

const noKeys: InputState = {
  forward: false,
  backward: false,
  left: false,
  right: false,
};

describe("getTargetHeadingFromInput", () => {
  it("returns null when no keys are pressed", () => {
    expect(getTargetHeadingFromInput(noKeys)).toBeNull();
  });

  it("returns 0 for forward only", () => {
    expect(getTargetHeadingFromInput({ ...noKeys, forward: true })).toBe(0);
  });

  it("returns PI for backward only", () => {
    expect(
      getTargetHeadingFromInput({ ...noKeys, backward: true })
    ).toBeCloseTo(Math.PI, 10);
  });

  it("returns +PI/2 for right only", () => {
    expect(getTargetHeadingFromInput({ ...noKeys, right: true })).toBeCloseTo(
      Math.PI / 2,
      10
    );
  });

  it("returns -PI/2 for left only", () => {
    expect(getTargetHeadingFromInput({ ...noKeys, left: true })).toBeCloseTo(
      -Math.PI / 2,
      10
    );
  });

  it("returns PI/4 for forward+right diagonal", () => {
    const keys: InputState = { ...noKeys, forward: true, right: true };
    expect(getTargetHeadingFromInput(keys)).toBeCloseTo(Math.PI / 4, 10);
  });

  it("returns null for opposing keys", () => {
    const keys: InputState = {
      forward: true,
      backward: true,
      left: false,
      right: false,
    };
    expect(getTargetHeadingFromInput(keys)).toBeNull();
  });
});

describe("normalizeAimAngle", () => {
  it("keeps angle in [0, 2PI) for positive values", () => {
    expect(normalizeAimAngle(0)).toBe(0);
    expect(normalizeAimAngle(Math.PI)).toBeCloseTo(Math.PI, 10);
  });

  it("wraps negative angles", () => {
    const result = normalizeAimAngle(-Math.PI / 2);
    expect(result).toBeCloseTo(1.5 * Math.PI, 10);
  });

  it("wraps angles > 2PI", () => {
    const result = normalizeAimAngle(3 * Math.PI);
    expect(result).toBeCloseTo(Math.PI, 10);
  });

  it("handles exact 2PI -> 0", () => {
    const result = normalizeAimAngle(2 * Math.PI);
    expect(result).toBeCloseTo(0, 10);
  });
});
