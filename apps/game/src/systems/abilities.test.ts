import { describe, expect, test } from "bun:test";

import { TICK_RATE } from "../config";
import { BulletSchema } from "../schemas/BulletSchema";
import { EffectSchema } from "../schemas/EffectSchema";
import { GameState } from "../schemas/GameState";
import { PlayerSchema } from "../schemas/PlayerSchema";
import {
  BOMB_EXPANSION_TICKS,
  activateAbility,
  chargeUltimate,
  cleanupExpiredEffects,
  updateEffectWaves,
} from "./abilities";

function createTwoPlayerState(): {
  state: GameState;
  p1: PlayerSchema;
  p2: PlayerSchema;
} {
  const state = new GameState();
  state.tick = 1000;

  const p1 = new PlayerSchema();
  p1.playerIndex = 0;
  p1.x = 400;
  p1.y = 100;
  p1.connected = true;
  state.players.set("p1", p1);

  const p2 = new PlayerSchema();
  p2.playerIndex = 1;
  p2.x = 400;
  p2.y = 500;
  p2.connected = true;
  state.players.set("p2", p2);

  return { state, p1, p2 };
}

/** Advance tick and call updateEffectWaves for n iterations. */
function tickEffects(state: GameState, n: number) {
  for (let i = 0; i < n; i++) {
    state.tick++;
    updateEffectWaves(state);
  }
}

describe("activateAbility - Dash (slot 1)", () => {
  test("dash in movement direction when moving", () => {
    const { state, p1 } = createTwoPlayerState();
    p1.velocityX = 1;
    p1.velocityY = 0;
    const startX = p1.x;

    const result = activateAbility(state, "p1", p1, 1);

    expect(result).toBe(true);
    expect(p1.x).toBeGreaterThan(startX);
  });

  test("dash toward cursor when stationary", () => {
    const { state, p1 } = createTwoPlayerState();
    p1.velocityX = 0;
    p1.velocityY = 0;
    p1.aimAngle = Math.PI / 2; // aiming right
    const startX = p1.x;

    const result = activateAbility(state, "p1", p1, 1);

    expect(result).toBe(true);
    expect(p1.x).toBeGreaterThan(startX);
  });

  test("dash grants invincibility", () => {
    const { state, p1 } = createTwoPlayerState();

    activateAbility(state, "p1", p1, 1);

    expect(p1.invincibleUntil).toBeGreaterThan(state.tick);
  });

  test("dash sets cooldown field", () => {
    const { state, p1 } = createTwoPlayerState();

    activateAbility(state, "p1", p1, 1);

    expect(p1.ability1CooldownUntil).toBe(state.tick + TICK_RATE * 8);
  });

  test("dash is rejected during cooldown", () => {
    const { state, p1 } = createTwoPlayerState();
    p1.ability1LastUsedTick = state.tick - 1; // Used 1 tick ago

    const result = activateAbility(state, "p1", p1, 1);

    expect(result).toBe(false);
  });
});

describe("activateAbility - Bomb (slot 2)", () => {
  test("bomb clears enemy bullets in radius after expansion", () => {
    const { state, p1 } = createTwoPlayerState();

    // Add enemy bullet near p1
    const nearBullet = new BulletSchema();
    nearBullet.x = p1.x + 10;
    nearBullet.y = p1.y + 10;
    nearBullet.ownerId = "p2";
    state.bullets.push(nearBullet);

    // Add enemy bullet far from p1
    const farBullet = new BulletSchema();
    farBullet.x = p1.x + 200;
    farBullet.y = p1.y + 200;
    farBullet.ownerId = "p2";
    state.bullets.push(farBullet);

    // Add own bullet near p1 (should NOT be cleared)
    const ownBullet = new BulletSchema();
    ownBullet.x = p1.x + 5;
    ownBullet.y = p1.y + 5;
    ownBullet.ownerId = "p1";
    state.bullets.push(ownBullet);

    activateAbility(state, "p1", p1, 2);
    tickEffects(state, BOMB_EXPANSION_TICKS);

    // Near enemy bullet removed, far enemy bullet + own bullet remain
    expect(state.bullets.length).toBe(2);
  });

  test("bomb damages enemy in range after expansion", () => {
    const { state, p1, p2 } = createTwoPlayerState();
    // Place p2 within bomb radius of p1
    p2.x = p1.x + 50;
    p2.y = p1.y;
    const startHp = p2.hp;

    activateAbility(state, "p1", p1, 2);
    tickEffects(state, BOMB_EXPANSION_TICKS);

    expect(p2.hp).toBeLessThan(startHp);
  });

  test("bomb does not damage enemy out of range", () => {
    const { state, p1, p2 } = createTwoPlayerState();
    // p2 is far from p1 (default positions)
    const startHp = p2.hp;

    activateAbility(state, "p1", p1, 2);
    tickEffects(state, BOMB_EXPANSION_TICKS);

    expect(p2.hp).toBe(startHp);
  });

  test("bomb creates visual effect", () => {
    const { state, p1 } = createTwoPlayerState();

    activateAbility(state, "p1", p1, 2);

    expect(state.effects.length).toBe(1);
    expect(state.effects[0].effectType).toBe("bomb");
    expect(state.effects[0].ownerId).toBe("p1");
  });

  test("bomb sets cooldown field", () => {
    const { state, p1 } = createTwoPlayerState();

    activateAbility(state, "p1", p1, 2);

    expect(p1.ability2CooldownUntil).toBe(state.tick + TICK_RATE * 12);
  });

  test("bomb is rejected during cooldown", () => {
    const { state, p1 } = createTwoPlayerState();
    p1.ability2LastUsedTick = state.tick - 1;

    const result = activateAbility(state, "p1", p1, 2);

    expect(result).toBe(false);
  });

  test("bomb can kill enemy via progressive expansion", () => {
    const { state, p1, p2 } = createTwoPlayerState();
    p2.x = p1.x + 50;
    p2.y = p1.y;
    p2.hp = 20;
    p2.lives = 2;

    activateAbility(state, "p1", p1, 2);
    tickEffects(state, BOMB_EXPANSION_TICKS);

    // Should have lost a life and respawned
    expect(p2.lives).toBe(1);
    expect(p2.hp).toBe(100);
  });

  test("bomb wave expands progressively", () => {
    const { state, p1 } = createTwoPlayerState();

    // Place bullet at ~80% of bomb radius (96 units from center)
    const bullet = new BulletSchema();
    bullet.x = p1.x + 96;
    bullet.y = p1.y;
    bullet.ownerId = "p2";
    state.bullets.push(bullet);

    activateAbility(state, "p1", p1, 2);

    // At tick 1, expansion is ~1/12 = 8.3% of radius (10px) — bullet at 96px should survive
    tickEffects(state, 1);
    expect(state.bullets.length).toBe(1);

    // By tick 12 (full expansion), bullet should be cleared
    tickEffects(state, BOMB_EXPANSION_TICKS - 1);
    expect(state.bullets.length).toBe(0);
  });

  test("enemy damaged only once per effect", () => {
    const { state, p1, p2 } = createTwoPlayerState();
    p2.x = p1.x + 10;
    p2.y = p1.y;

    activateAbility(state, "p1", p1, 2);
    tickEffects(state, BOMB_EXPANSION_TICKS);

    // Bomb damage is 30
    expect(p2.hp).toBe(70);
  });

  test("bomb during deathbomb window cancels death and restores HP", () => {
    const { state, p1 } = createTwoPlayerState();
    p1.hp = 0;
    p1.deathbombWindowUntil = state.tick + 12;

    const result = activateAbility(state, "p1", p1, 2);

    expect(result).toBe(true);
    expect(p1.hp).toBe(100);
    expect(p1.deathbombWindowUntil).toBe(0);
    // Effect still created
    expect(state.effects.length).toBe(1);
  });
});

describe("activateAbility - Ultimate (slot 3) → Spell Card", () => {
  test("ultimate requires full charge", () => {
    const { state, p1 } = createTwoPlayerState();
    p1.ultimateCharge = 50;

    const result = activateAbility(state, "p1", p1, 3);

    expect(result).toBe(false);
  });

  test("ultimate activates at full charge and resets to 0", () => {
    const { state, p1 } = createTwoPlayerState();
    p1.ultimateCharge = 100;

    const result = activateAbility(state, "p1", p1, 3);

    expect(result).toBe(true);
    expect(p1.ultimateCharge).toBe(0);
  });

  test("ultimate declares spell card instead of AoE", () => {
    const { state, p1 } = createTwoPlayerState();
    p1.ultimateCharge = 100;

    activateAbility(state, "p1", p1, 3);

    expect(state.spellCardDeclarer).toBe("p1");
    expect(state.spellCardEndsAtTick).toBeGreaterThan(state.tick);
    // No visual effect created (spell card uses bullets, not effects)
    expect(state.effects.length).toBe(0);
  });
});

describe("chargeUltimate", () => {
  test("increases charge by damage dealt", () => {
    const p = new PlayerSchema();
    p.ultimateCharge = 0;

    chargeUltimate(p, 10);

    expect(p.ultimateCharge).toBe(10);
  });

  test("caps charge at 100", () => {
    const p = new PlayerSchema();
    p.ultimateCharge = 95;

    chargeUltimate(p, 20);

    expect(p.ultimateCharge).toBe(100);
  });

  test("zero damage does not change charge", () => {
    const p = new PlayerSchema();
    p.ultimateCharge = 50;

    chargeUltimate(p, 0);

    expect(p.ultimateCharge).toBe(50);
  });
});

describe("cleanupExpiredEffects", () => {
  test("removes expired effects", () => {
    const state = new GameState();
    state.tick = 100;

    const expired = new EffectSchema();
    expired.expiresAtTick = 50;
    state.effects.push(expired);

    const active = new EffectSchema();
    active.expiresAtTick = 200;
    state.effects.push(active);

    cleanupExpiredEffects(state);

    expect(state.effects.length).toBe(1);
    expect(state.effects[0].expiresAtTick).toBe(200);
  });

  test("removes nothing when all effects are active", () => {
    const state = new GameState();
    state.tick = 100;

    const e1 = new EffectSchema();
    e1.expiresAtTick = 200;
    state.effects.push(e1);

    cleanupExpiredEffects(state);

    expect(state.effects.length).toBe(1);
  });

  test("handles empty effects array", () => {
    const state = new GameState();
    state.tick = 100;

    cleanupExpiredEffects(state);

    expect(state.effects.length).toBe(0);
  });
});

describe("updateEffectWaves", () => {
  test("multiple effects expand independently", () => {
    const { state, p1, p2 } = createTwoPlayerState();
    p2.x = p1.x + 50;
    p2.y = p1.y;

    // Activate bomb for p1
    activateAbility(state, "p1", p1, 2);

    // Advance a few ticks, then activate bomb for p2
    tickEffects(state, 5);
    p2.ability2LastUsedTick = -99999;
    activateAbility(state, "p2", p2, 2);

    expect(state.effects.length).toBe(2);

    // Both effects should process independently
    tickEffects(state, BOMB_EXPANSION_TICKS);
    // Both should have run without errors
    expect(state.effects.length).toBe(2);
  });
});
