import type { Vec3Like } from "gl-matrix";

import type { ShipState } from "./types";

import { GAME_CONST } from "./constants";

export interface AsteroidWave {
  size1: number;
  size2: number;
  size3: number;
  size4: number;
}

export interface GameplayDefaults {
  shipLives: number;
  shipInvincible: boolean;
  invincibleTimer: number;
  projectileCooldown: number;
  projectileRayCount: number;
  asteroidWave: AsteroidWave;
}

export const DEFAULT_GAMEPLAY: GameplayDefaults = {
  shipLives: 3,
  shipInvincible: false,
  invincibleTimer: 2.0,
  projectileCooldown: 18,
  projectileRayCount: 1,
  asteroidWave: {
    size1: 12,
    size2: 8,
    size3: 4,
    size4: 2,
  },
};

export const POWER_UP_PROGRESSION = Object.freeze({
  cooldownReductions: Object.freeze([3, 3, 3, 3]),
  rayCountIncreases: Object.freeze([1, 1, 1, 1]),
});

export function createInitialShipState(): ShipState {
  return {
    position: [...GAME_CONST.SHIP_INITIAL_POS] as Vec3Like,
    orientation: [0, 0, 0, 1],
    aimAngle: 0,
    lives: DEFAULT_GAMEPLAY.shipLives,
    invincible: DEFAULT_GAMEPLAY.shipInvincible,
    invincibleTicks: 0,
    cooldownLevel: 0,
    rayCountLevel: 0,
  };
}

export function createWaveArray(wave: AsteroidWave): number[] {
  return [
    ...Array(wave.size1).fill(1),
    ...Array(wave.size2).fill(2),
    ...Array(wave.size3).fill(3),
    ...Array(wave.size4).fill(4),
  ];
}
