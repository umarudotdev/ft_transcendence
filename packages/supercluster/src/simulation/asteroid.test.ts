import { describe, expect, it } from "bun:test";
import { Vec3 } from "gl-matrix";

import type { AsteroidState, InputState } from "../types";

import { GAME_CONST } from "../constants";
import {
  createAsteroidFragments,
  createAsteroidWave,
  createRandomAsteroidState,
  stepAsteroidHitLifecycle,
  stepAsteroids,
} from "./asteroid";

const noKeys: InputState = {
  forward: false,
  backward: false,
  left: false,
  right: false,
};

function vecLength(v: readonly number[]): number {
  return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
}

describe("createRandomAsteroidState", () => {
  it("creates asteroid with unit-length position and direction", () => {
    const ast = createRandomAsteroidState(1, 3);
    expect(vecLength(ast.position as number[])).toBeCloseTo(1, 6);
    expect(vecLength(ast.direction as number[])).toBeCloseTo(1, 6);
  });

  it("direction is tangent to position", () => {
    const ast = createRandomAsteroidState(1, 2);
    const dot = Vec3.dot(ast.position, ast.direction);
    expect(Math.abs(dot)).toBeLessThan(1e-5);
  });

  it("clamps size to valid range", () => {
    expect(createRandomAsteroidState(1, 0).size).toBe(1);
    expect(createRandomAsteroidState(1, 5).size).toBe(4);
    expect(createRandomAsteroidState(1, 2.6).size).toBe(3);
  });

  it("sets health to 2x size", () => {
    const ast = createRandomAsteroidState(1, 3);
    expect(ast.health).toBe(6);
  });

  it("speed is within configured bounds", () => {
    for (let i = 0; i < 20; i++) {
      const ast = createRandomAsteroidState(i, 2);
      expect(ast.moveSpeed).toBeGreaterThanOrEqual(
        GAME_CONST.ASTEROID_SPEED_MIN
      );
      expect(ast.moveSpeed).toBeLessThanOrEqual(GAME_CONST.ASTEROID_SPEED_MAX);
    }
  });
});

describe("createAsteroidWave", () => {
  it("creates correct number of asteroids", () => {
    const result = createAsteroidWave(100, [1, 2, 3]);
    expect(result.asteroids.length).toBe(3);
    expect(result.nextAsteroidId).toBe(103);
  });

  it("assigns sequential ids", () => {
    const result = createAsteroidWave(10, [1, 1]);
    expect(result.asteroids[0].id).toBe(10);
    expect(result.asteroids[1].id).toBe(11);
  });

  it("handles empty sizes array", () => {
    const result = createAsteroidWave(0, []);
    expect(result.asteroids).toEqual([]);
    expect(result.nextAsteroidId).toBe(0);
  });
});

describe("stepAsteroids", () => {
  it("returns empty array for empty input", () => {
    expect(stepAsteroids([], noKeys, 1, 0.01)).toEqual([]);
  });

  it("moves asteroids and preserves unit-length invariants", () => {
    const ast = createRandomAsteroidState(1, 2);
    const result = stepAsteroids([ast], noKeys, 1, 0.01);

    expect(result.length).toBe(1);
    expect(vecLength(result[0].position as number[])).toBeCloseTo(1, 4);
    expect(vecLength(result[0].direction as number[])).toBeCloseTo(1, 4);
  });

  it("does not mutate input asteroid array", () => {
    const ast = createRandomAsteroidState(1, 2);
    const originalPos = [...ast.position];
    stepAsteroids([ast], noKeys, 1, 0.01);
    expect(ast.position[0]).toBe(originalPos[0]);
    expect(ast.position[1]).toBe(originalPos[1]);
    expect(ast.position[2]).toBe(originalPos[2]);
  });
});

describe("createAsteroidFragments", () => {
  it("returns empty for size 1 asteroid", () => {
    const parent: AsteroidState = createRandomAsteroidState(1, 1);
    // Force size to exactly 1
    const result = createAsteroidFragments({ ...parent, size: 1 }, 100, 3);
    expect(result.asteroids).toEqual([]);
  });

  it("returns empty for count 0", () => {
    const parent = createRandomAsteroidState(1, 3);
    const result = createAsteroidFragments(parent, 100, 0);
    expect(result.asteroids).toEqual([]);
  });

  it("creates fragments one size smaller", () => {
    const parent: AsteroidState = {
      ...createRandomAsteroidState(1, 3),
      size: 3,
    };
    const result = createAsteroidFragments(parent, 100, 2);
    expect(result.asteroids.length).toBe(2);
    for (const frag of result.asteroids) {
      expect(frag.size).toBe(2);
    }
  });

  it("assigns sequential ids to fragments", () => {
    const parent: AsteroidState = {
      ...createRandomAsteroidState(1, 3),
      size: 3,
    };
    const result = createAsteroidFragments(parent, 50, 3);
    expect(result.asteroids[0].id).toBe(50);
    expect(result.asteroids[1].id).toBe(51);
    expect(result.asteroids[2].id).toBe(52);
    expect(result.nextAsteroidId).toBe(53);
  });

  it("fragments spawn at parent position", () => {
    const parent: AsteroidState = {
      ...createRandomAsteroidState(1, 3),
      size: 3,
    };
    const result = createAsteroidFragments(parent, 100, 2);
    for (const frag of result.asteroids) {
      expect(frag.position[0]).toBe(parent.position[0]);
      expect(frag.position[1]).toBe(parent.position[1]);
      expect(frag.position[2]).toBe(parent.position[2]);
    }
  });
});

describe("stepAsteroidHitLifecycle", () => {
  it("passes through non-hit asteroids unchanged", () => {
    const ast = createRandomAsteroidState(1, 2);
    const result = stepAsteroidHitLifecycle([ast], 100);
    expect(result.asteroids.length).toBe(1);
    expect(result.asteroids[0]).toBe(ast); // same reference
  });

  it("decrements hit timer for in-progress hits", () => {
    const ast: AsteroidState = {
      ...createRandomAsteroidState(1, 2),
      isHit: true,
      hitTimer: 5,
      health: 2,
    };
    const result = stepAsteroidHitLifecycle([ast], 100);
    expect(result.asteroids[0].hitTimer).toBe(4);
    expect(result.asteroids[0].isHit).toBe(true);
  });

  it("recovers damage gate when timer expires with health > 0", () => {
    const ast: AsteroidState = {
      ...createRandomAsteroidState(1, 2),
      isHit: true,
      hitTimer: 1,
      health: 2,
      canTakeDamage: false,
    };
    const result = stepAsteroidHitLifecycle([ast], 100);
    expect(result.asteroids[0].canTakeDamage).toBe(true);
    expect(result.asteroids[0].isHit).toBe(false);
  });

  it("removes asteroid with health=0 and size=1 (no fragments)", () => {
    const ast: AsteroidState = {
      ...createRandomAsteroidState(1, 1),
      size: 1,
      isHit: true,
      hitTimer: 1,
      health: 0,
    };
    const result = stepAsteroidHitLifecycle([ast], 100);
    expect(result.asteroids.length).toBe(0);
  });

  it("spawns fragments when large asteroid with health=0 expires", () => {
    const ast: AsteroidState = {
      ...createRandomAsteroidState(1, 3),
      size: 3,
      isHit: true,
      hitTimer: 1,
      health: 0,
    };
    const result = stepAsteroidHitLifecycle([ast], 100);
    // Should have 2-3 fragments
    expect(result.asteroids.length).toBeGreaterThanOrEqual(2);
    expect(result.asteroids.length).toBeLessThanOrEqual(3);
    for (const frag of result.asteroids) {
      expect(frag.size).toBe(2);
    }
  });

  it("returns empty for empty input", () => {
    const result = stepAsteroidHitLifecycle([], 100);
    expect(result.asteroids).toEqual([]);
  });
});
