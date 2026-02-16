import type { QuatLike } from "gl-matrix";

import { describe, expect, it } from "bun:test";

import type { InputState, ShipState } from "../types";

import {
  applyShipCollisionDamage,
  stepShipInvincibilityState,
  stepShipOrientationState,
} from "./ship";

const noKeys: InputState = {
  forward: false,
  backward: false,
  left: false,
  right: false,
};

function makeShip(overrides: Partial<ShipState> = {}): ShipState {
  return {
    position: [0, 0, 1],
    orientation: [0, 0, 0, 1],
    aimAngle: 0,
    lives: 3,
    invincible: false,
    invincibleTicks: 0,
    cooldownLevel: 0,
    rayCountLevel: 0,
    ...overrides,
  };
}

function quatLength(q: QuatLike): number {
  return Math.sqrt(q[0] * q[0] + q[1] * q[1] + q[2] * q[2] + q[3] * q[3]);
}

describe("stepShipOrientationState", () => {
  it("returns moved=false with no keys", () => {
    const result = stepShipOrientationState([0, 0, 0, 1], noKeys);
    expect(result.moved).toBe(false);
  });

  it("returns moved=true with forward key", () => {
    const keys: InputState = { ...noKeys, forward: true };
    const result = stepShipOrientationState([0, 0, 0, 1], keys);
    expect(result.moved).toBe(true);
  });

  it("produces a unit quaternion", () => {
    const keys: InputState = { ...noKeys, forward: true, left: true };
    const result = stepShipOrientationState([0, 0, 0, 1], keys, 5, 0.01);
    expect(quatLength(result.orientation)).toBeCloseTo(1, 6);
  });

  it("does not mutate input quaternion", () => {
    const ori: QuatLike = [0, 0, 0, 1];
    const keys: InputState = { ...noKeys, forward: true };
    stepShipOrientationState(ori, keys);
    expect(ori).toEqual([0, 0, 0, 1]);
  });

  it("opposing keys cancel out", () => {
    const keys: InputState = {
      forward: true,
      backward: true,
      left: true,
      right: true,
    };
    const result = stepShipOrientationState([0, 0, 0, 1], keys);
    expect(result.moved).toBe(false);
  });
});

describe("applyShipCollisionDamage", () => {
  it("returns 'none' when no hit detected", () => {
    const ship = makeShip();
    const result = applyShipCollisionDamage(ship, false, 120);
    expect(result.event).toBe("none");
    expect(result.ship).toBe(ship); // same reference
  });

  it("returns 'none' when ship is already invincible", () => {
    const ship = makeShip({ invincible: true, invincibleTicks: 60 });
    const result = applyShipCollisionDamage(ship, true, 120);
    expect(result.event).toBe("none");
  });

  it("returns 'none' when ship has 0 lives", () => {
    const ship = makeShip({ lives: 0 });
    const result = applyShipCollisionDamage(ship, true, 120);
    expect(result.event).toBe("none");
  });

  it("returns 'ship_damaged' and decrements lives", () => {
    const ship = makeShip({ lives: 3 });
    const result = applyShipCollisionDamage(ship, true, 120);
    expect(result.event).toBe("ship_damaged");
    expect(result.ship.lives).toBe(2);
    expect(result.ship.invincible).toBe(true);
    expect(result.ship.invincibleTicks).toBe(120);
  });

  it("returns 'ship_destroyed' when last life is lost", () => {
    const ship = makeShip({ lives: 1 });
    const result = applyShipCollisionDamage(ship, true, 120);
    expect(result.event).toBe("ship_destroyed");
    expect(result.ship.lives).toBe(0);
  });

  it("does not mutate input ship", () => {
    const ship = makeShip({ lives: 3 });
    applyShipCollisionDamage(ship, true, 120);
    expect(ship.lives).toBe(3);
    expect(ship.invincible).toBe(false);
  });
});

describe("stepShipInvincibilityState", () => {
  it("returns same ship if not invincible", () => {
    const ship = makeShip();
    const result = stepShipInvincibilityState(ship);
    expect(result).toBe(ship);
  });

  it("decrements invincibleTicks", () => {
    const ship = makeShip({ invincible: true, invincibleTicks: 5 });
    const result = stepShipInvincibilityState(ship);
    expect(result.invincibleTicks).toBe(4);
    expect(result.invincible).toBe(true);
  });

  it("clears invincibility when timer reaches 1", () => {
    const ship = makeShip({ invincible: true, invincibleTicks: 1 });
    const result = stepShipInvincibilityState(ship);
    expect(result.invincible).toBe(false);
    expect(result.invincibleTicks).toBe(0);
  });

  it("does not mutate input ship", () => {
    const ship = makeShip({ invincible: true, invincibleTicks: 5 });
    stepShipInvincibilityState(ship);
    expect(ship.invincibleTicks).toBe(5);
  });
});
