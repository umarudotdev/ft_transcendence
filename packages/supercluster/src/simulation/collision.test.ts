import type { Vec3Like } from "gl-matrix";

import { describe, expect, it } from "bun:test";

import type { AsteroidState, ProjectileState, ShipState } from "../types";

import {
  findProjectileAsteroidHits,
  findShipAsteroidHit,
  resolveProjectileAsteroidCollisions,
} from "./collision";

function makeProjectile(id: number, position: Vec3Like): ProjectileState {
  return { id, position, direction: [1, 0, 0], ageTicks: 0 };
}

function makeAsteroid(
  id: number,
  position: Vec3Like,
  overrides: Partial<AsteroidState> = {}
): AsteroidState {
  return {
    id,
    position,
    direction: [1, 0, 0],
    moveSpeed: 0.003,
    size: 2,
    health: 4,
    canTakeDamage: true,
    isHit: false,
    hitTimer: 0,
    ...overrides,
  };
}

function makeShip(position: Vec3Like): ShipState {
  return {
    position,
    orientation: [0, 0, 0, 1],
    aimAngle: 0,
    lives: 3,
    invincible: false,
    invincibleTicks: 0,
    cooldownLevel: 0,
    rayCountLevel: 0,
  };
}

describe("findProjectileAsteroidHits", () => {
  it("returns empty for empty inputs", () => {
    expect(findProjectileAsteroidHits([], [])).toEqual([]);
    expect(
      findProjectileAsteroidHits([makeProjectile(1, [0, 0, 1])], [])
    ).toEqual([]);
    expect(
      findProjectileAsteroidHits([], [makeAsteroid(1, [0, 0, 1])])
    ).toEqual([]);
  });

  it("detects hit when projectile overlaps asteroid", () => {
    const proj = makeProjectile(1, [0, 0, 1]);
    const ast = makeAsteroid(10, [0, 0, 1]);
    const hits = findProjectileAsteroidHits([proj], [ast]);

    expect(hits.length).toBe(1);
    expect(hits[0]).toEqual({ projectileId: 1, asteroidId: 10 });
  });

  it("does not detect hit for far-apart entities", () => {
    const proj = makeProjectile(1, [0, 0, 1]);
    const ast = makeAsteroid(10, [0, 0, -1]); // opposite pole
    const hits = findProjectileAsteroidHits([proj], [ast]);

    expect(hits.length).toBe(0);
  });

  it("each projectile hits at most one asteroid", () => {
    const proj = makeProjectile(1, [0, 0, 1]);
    const ast1 = makeAsteroid(10, [0, 0, 1]);
    const ast2 = makeAsteroid(11, [0, 0, 1]);
    const hits = findProjectileAsteroidHits([proj], [ast1, ast2]);

    expect(hits.length).toBe(1);
  });
});

describe("resolveProjectileAsteroidCollisions", () => {
  it("returns unchanged arrays when no hits", () => {
    const proj = makeProjectile(1, [0, 0, 1]);
    const ast = makeAsteroid(10, [0, 0, -1]);
    const result = resolveProjectileAsteroidCollisions([proj], [ast], 30);

    expect(result.projectiles.length).toBe(1);
    expect(result.asteroids.length).toBe(1);
    expect(result.events.length).toBe(0);
  });

  it("consumes projectile and damages asteroid on hit", () => {
    const proj = makeProjectile(1, [0, 0, 1]);
    const ast = makeAsteroid(10, [0, 0, 1], { health: 4, canTakeDamage: true });
    const result = resolveProjectileAsteroidCollisions([proj], [ast], 30);

    // Projectile consumed
    expect(result.projectiles.length).toBe(0);

    // Asteroid damaged
    const hitAst = result.asteroids[0];
    expect(hitAst.health).toBe(3);
    expect(hitAst.canTakeDamage).toBe(false);
    expect(hitAst.isHit).toBe(true);
    expect(hitAst.hitTimer).toBe(30);

    // Events emitted
    const eventTypes = result.events.map((e) => e.type);
    expect(eventTypes).toContain("projectile_consumed");
    expect(eventTypes).toContain("asteroid_damaged");
  });

  it("does not damage asteroid with canTakeDamage=false", () => {
    const proj = makeProjectile(1, [0, 0, 1]);
    const ast = makeAsteroid(10, [0, 0, 1], {
      health: 4,
      canTakeDamage: false,
    });
    const result = resolveProjectileAsteroidCollisions([proj], [ast], 30);

    // Projectile still consumed
    expect(result.projectiles.length).toBe(0);
    // Asteroid unchanged
    expect(result.asteroids[0].health).toBe(4);
    expect(result.asteroids[0].canTakeDamage).toBe(false);
  });

  it("does not mutate input arrays", () => {
    const projs = [makeProjectile(1, [0, 0, 1])];
    const asts = [makeAsteroid(10, [0, 0, 1])];
    resolveProjectileAsteroidCollisions(projs, asts, 30);

    expect(projs.length).toBe(1);
    expect(asts[0].health).toBe(4);
  });
});

describe("findShipAsteroidHit", () => {
  it("returns null for empty asteroid list", () => {
    const ship = makeShip([0, 0, 1]);
    expect(findShipAsteroidHit(ship, [])).toBeNull();
  });

  it("returns asteroid id when ship overlaps asteroid", () => {
    const ship = makeShip([0, 0, 1]);
    const ast = makeAsteroid(42, [0, 0, 1]);
    expect(findShipAsteroidHit(ship, [ast])).toBe(42);
  });

  it("returns null when ship is far from all asteroids", () => {
    const ship = makeShip([0, 0, 1]);
    const ast = makeAsteroid(42, [0, 0, -1]);
    expect(findShipAsteroidHit(ship, [ast])).toBeNull();
  });

  it("returns first hit asteroid id", () => {
    const ship = makeShip([0, 0, 1]);
    const ast1 = makeAsteroid(1, [0, 0, 1]);
    const ast2 = makeAsteroid(2, [0, 0, 1]);
    expect(findShipAsteroidHit(ship, [ast1, ast2])).toBe(1);
  });
});
