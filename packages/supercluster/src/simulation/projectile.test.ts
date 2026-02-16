import { describe, expect, it } from "bun:test";

import { GAME_CONST } from "../constants";
import { spawnProjectilesFromAim, stepProjectiles } from "./projectile";

function vecLength(v: readonly number[]): number {
  return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
}

describe("spawnProjectilesFromAim", () => {
  it("spawns a single projectile at aimAngle=0", () => {
    const result = spawnProjectilesFromAim(1, 0, 1);
    expect(result.projectiles.length).toBe(1);
    expect(result.nextProjectileId).toBe(2);

    const proj = result.projectiles[0];
    expect(proj.id).toBe(1);
    expect(proj.ageTicks).toBe(0);
  });

  it("position is at SHIP_INITIAL_POS", () => {
    const result = spawnProjectilesFromAim(1, 0, 1);
    const pos = result.projectiles[0].position;
    expect(pos[0]).toBe(GAME_CONST.SHIP_INITIAL_POS[0]);
    expect(pos[1]).toBe(GAME_CONST.SHIP_INITIAL_POS[1]);
    expect(pos[2]).toBe(GAME_CONST.SHIP_INITIAL_POS[2]);
  });

  it("direction is unit length for single ray", () => {
    const result = spawnProjectilesFromAim(1, Math.PI / 4, 1);
    const dir = result.projectiles[0].direction;
    expect(vecLength(dir as number[])).toBeCloseTo(1, 10);
  });

  it("spawns multiple rays with spread", () => {
    const result = spawnProjectilesFromAim(10, 0, 3);
    expect(result.projectiles.length).toBe(3);
    expect(result.nextProjectileId).toBe(13);

    // Each direction should be unit length
    for (const proj of result.projectiles) {
      expect(vecLength(proj.direction as number[])).toBeCloseTo(1, 10);
    }
  });

  it("multi-ray directions differ by spread angle", () => {
    const result = spawnProjectilesFromAim(1, 0, 3);
    const dirs = result.projectiles.map((p) => p.direction);

    // Middle ray should be at aimAngle, outer rays should differ
    // Just verify they're not all identical
    expect(dirs[0][0]).not.toBeCloseTo(dirs[1][0], 3);
  });

  it("ensures at least 1 ray even with rayCount=0", () => {
    const result = spawnProjectilesFromAim(1, 0, 0);
    expect(result.projectiles.length).toBe(1);
  });
});

describe("stepProjectiles", () => {
  it("returns empty array for empty input", () => {
    expect(stepProjectiles([], 1)).toEqual([]);
  });

  it("increments ageTicks", () => {
    const { projectiles } = spawnProjectilesFromAim(1, 0, 1);
    const stepped = stepProjectiles(projectiles, 1);
    expect(stepped[0].ageTicks).toBe(1);
  });

  it("preserves unit-length position and direction", () => {
    const { projectiles } = spawnProjectilesFromAim(1, 0, 1);
    const stepped = stepProjectiles(projectiles, 5);

    expect(vecLength(stepped[0].position as number[])).toBeCloseTo(1, 4);
    expect(vecLength(stepped[0].direction as number[])).toBeCloseTo(1, 4);
  });

  it("removes projectiles that exceed max age", () => {
    const { projectiles } = spawnProjectilesFromAim(1, 0, 1);
    // Set age to just below max
    const aged = [
      {
        ...projectiles[0],
        ageTicks: GAME_CONST.PROJECTILE_AGE_TICKS - 1,
      },
    ];
    const stepped = stepProjectiles(aged, 1);
    expect(stepped.length).toBe(0);
  });

  it("keeps projectiles below max age", () => {
    const { projectiles } = spawnProjectilesFromAim(1, 0, 1);
    const aged = [
      {
        ...projectiles[0],
        ageTicks: GAME_CONST.PROJECTILE_AGE_TICKS - 2,
      },
    ];
    const stepped = stepProjectiles(aged, 1);
    expect(stepped.length).toBe(1);
  });

  it("does not mutate input array", () => {
    const { projectiles } = spawnProjectilesFromAim(1, 0, 1);
    const originalAge = projectiles[0].ageTicks;
    stepProjectiles(projectiles, 1);
    expect(projectiles[0].ageTicks).toBe(originalAge);
  });
});
