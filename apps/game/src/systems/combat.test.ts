import { describe, expect, test } from "bun:test";

import type { HitEvent } from "./collision";

import { BulletSchema } from "../schemas/BulletSchema";
import { GameState } from "../schemas/GameState";
import { PlayerSchema } from "../schemas/PlayerSchema";
import {
  applyDamage,
  applyDirectDamage,
  checkGameOver,
  processFireInput,
} from "./combat";

function createTwoPlayerState(): {
  state: GameState;
  p1: PlayerSchema;
  p2: PlayerSchema;
} {
  const state = new GameState();
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

describe("processFireInput", () => {
  test("firing player spawns spread bullets in normal mode", () => {
    const { state, p1 } = createTwoPlayerState();
    p1.isFiring = true;
    p1.lastFireTick = -999;
    state.tick = 100;

    processFireInput(state);

    // Normal mode = 3-way spread (3 bullets)
    expect(state.bullets.length).toBe(3);
    // All bullets owned by p1
    for (const b of state.bullets) {
      expect(b.ownerId).toBe("p1");
    }
  });

  test("firing player spawns single bullet in focus mode", () => {
    const { state, p1 } = createTwoPlayerState();
    p1.isFiring = true;
    p1.isFocusing = true;
    p1.lastFireTick = -999;
    state.tick = 100;

    processFireInput(state);

    expect(state.bullets.length).toBe(1);
    expect(state.bullets[0].damage).toBe(15);
  });

  test("disconnected player does not fire", () => {
    const { state, p1 } = createTwoPlayerState();
    p1.isFiring = true;
    p1.connected = false;
    p1.lastFireTick = -999;
    state.tick = 100;

    processFireInput(state);

    expect(state.bullets.length).toBe(0);
  });

  test("non-firing player does not fire", () => {
    const { state } = createTwoPlayerState();
    state.tick = 100;

    processFireInput(state);

    expect(state.bullets.length).toBe(0);
  });

  test("fire cooldown prevents rapid fire", () => {
    const { state, p1 } = createTwoPlayerState();
    p1.isFiring = true;
    p1.isFocusing = true;
    p1.lastFireTick = 99; // Fired 1 tick ago (cooldown is ~6 ticks)
    state.tick = 100;

    processFireInput(state);

    expect(state.bullets.length).toBe(0);
  });

  test("player 0 bullets go upward (negative velocityY)", () => {
    const { state, p1 } = createTwoPlayerState();
    p1.isFiring = true;
    p1.isFocusing = true;
    p1.lastFireTick = -999;
    state.tick = 100;

    processFireInput(state);

    expect(state.bullets[0].velocityY).toBeLessThan(0);
  });

  test("player 1 bullets go downward (positive velocityY)", () => {
    const { state, p2 } = createTwoPlayerState();
    p2.isFiring = true;
    p2.isFocusing = true;
    p2.lastFireTick = -999;
    state.tick = 100;

    processFireInput(state);

    expect(state.bullets[0].velocityY).toBeGreaterThan(0);
  });
});

describe("applyDamage", () => {
  test("reduces player HP by hit damage", () => {
    const { state, p1 } = createTwoPlayerState();

    const bullet = new BulletSchema();
    state.bullets.push(bullet);

    const hits: HitEvent[] = [{ bulletIndex: 0, playerId: "p1", damage: 25 }];
    applyDamage(state, hits);

    expect(p1.hp).toBe(75);
  });

  test("player dies and respawns with invincibility when HP reaches 0", () => {
    const { state, p1 } = createTwoPlayerState();
    p1.hp = 10;
    state.tick = 100;

    const bullet = new BulletSchema();
    state.bullets.push(bullet);

    const hits: HitEvent[] = [{ bulletIndex: 0, playerId: "p1", damage: 20 }];
    const result = applyDamage(state, hits);

    // Should not return game over (still has lives left)
    expect(result).toBeNull();
    expect(p1.lives).toBe(2);
    expect(p1.hp).toBe(100);
    expect(p1.invincibleUntil).toBeGreaterThan(100);
  });

  test("returns game over when player loses last life", () => {
    const { state, p1 } = createTwoPlayerState();
    p1.hp = 10;
    p1.lives = 1;
    state.tick = 100;

    const bullet = new BulletSchema();
    state.bullets.push(bullet);

    const hits: HitEvent[] = [{ bulletIndex: 0, playerId: "p1", damage: 20 }];
    const result = applyDamage(state, hits);

    expect(result).not.toBeNull();
    expect(result?.deadPlayerId).toBe("p1");
    expect(result?.killerId).toBe("p2");
  });
});

describe("applyDirectDamage", () => {
  test("reduces HP without killing", () => {
    const { state, p1 } = createTwoPlayerState();

    applyDirectDamage(state, "p1", p1, 30);

    expect(p1.hp).toBe(70);
    expect(p1.lives).toBe(3);
  });

  test("triggers death and respawn when HP drops to 0", () => {
    const { state, p1 } = createTwoPlayerState();
    p1.hp = 20;
    state.tick = 200;

    applyDirectDamage(state, "p1", p1, 30);

    expect(p1.lives).toBe(2);
    expect(p1.hp).toBe(100);
    expect(p1.invincibleUntil).toBeGreaterThan(200);
  });

  test("does not reset HP when last life is lost", () => {
    const { state, p1 } = createTwoPlayerState();
    p1.hp = 20;
    p1.lives = 1;
    state.tick = 200;

    applyDirectDamage(state, "p1", p1, 30);

    expect(p1.lives).toBe(0);
    expect(p1.hp).toBe(-10);
  });
});

describe("checkGameOver", () => {
  test("returns null when both players are alive", () => {
    const { state } = createTwoPlayerState();

    expect(checkGameOver(state)).toBeNull();
  });

  test("returns winner ID when opponent has 0 lives", () => {
    const { state, p1 } = createTwoPlayerState();
    p1.lives = 0;

    expect(checkGameOver(state)).toBe("p2");
  });

  test("returns winner ID when other player has 0 lives", () => {
    const { state, p2 } = createTwoPlayerState();
    p2.lives = 0;

    expect(checkGameOver(state)).toBe("p1");
  });
});
