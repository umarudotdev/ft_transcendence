import { describe, expect, test } from "bun:test";

import { CANVAS_HEIGHT, CANVAS_WIDTH } from "../config";
import { BulletSchema } from "../schemas/BulletSchema";
import { GameState } from "../schemas/GameState";
import { PlayerSchema } from "../schemas/PlayerSchema";
import { applyMovement } from "./movement";

function createState(): GameState {
  const state = new GameState();
  return state;
}

describe("applyMovement", () => {
  test("moves player based on velocity", () => {
    const state = createState();
    const p = new PlayerSchema();
    p.x = 400;
    p.y = 300;
    p.velocityX = 1;
    p.velocityY = 0;
    p.connected = true;
    state.players.set("p1", p);

    applyMovement(state, 1 / 60);

    // Player should have moved right
    expect(p.x).toBeGreaterThan(400);
  });

  test("does not move disconnected player", () => {
    const state = createState();
    const p = new PlayerSchema();
    p.x = 400;
    p.y = 300;
    p.velocityX = 1;
    p.velocityY = 0;
    p.connected = false;
    state.players.set("p1", p);

    applyMovement(state, 1 / 60);

    expect(p.x).toBe(400);
  });

  test("moves bullets based on their velocity", () => {
    const state = createState();
    const bullet = new BulletSchema();
    bullet.x = 400;
    bullet.y = 300;
    bullet.velocityX = 0;
    bullet.velocityY = -500;
    state.bullets.push(bullet);

    applyMovement(state, 1 / 60);

    expect(bullet.y).toBeLessThan(300);
  });

  test("removes out-of-bounds bullets (top)", () => {
    const state = createState();
    const bullet = new BulletSchema();
    bullet.x = 400;
    bullet.y = -15;
    bullet.velocityY = -100;
    state.bullets.push(bullet);

    applyMovement(state, 1 / 60);

    expect(state.bullets.length).toBe(0);
  });

  test("removes out-of-bounds bullets (bottom)", () => {
    const state = createState();
    const bullet = new BulletSchema();
    bullet.x = 400;
    bullet.y = CANVAS_HEIGHT + 15;
    bullet.velocityY = 100;
    state.bullets.push(bullet);

    applyMovement(state, 1 / 60);

    expect(state.bullets.length).toBe(0);
  });

  test("removes out-of-bounds bullets (left)", () => {
    const state = createState();
    const bullet = new BulletSchema();
    bullet.x = -15;
    bullet.y = 300;
    bullet.velocityX = -100;
    state.bullets.push(bullet);

    applyMovement(state, 1 / 60);

    expect(state.bullets.length).toBe(0);
  });

  test("removes out-of-bounds bullets (right)", () => {
    const state = createState();
    const bullet = new BulletSchema();
    bullet.x = CANVAS_WIDTH + 15;
    bullet.y = 300;
    bullet.velocityX = 100;
    state.bullets.push(bullet);

    applyMovement(state, 1 / 60);

    expect(state.bullets.length).toBe(0);
  });

  test("keeps in-bounds bullets", () => {
    const state = createState();
    const bullet = new BulletSchema();
    bullet.x = 400;
    bullet.y = 300;
    bullet.velocityX = 0;
    bullet.velocityY = -500;
    state.bullets.push(bullet);

    applyMovement(state, 1 / 60);

    expect(state.bullets.length).toBe(1);
  });

  test("focus mode reduces player speed", () => {
    const state = createState();

    const normal = new PlayerSchema();
    normal.x = 400;
    normal.y = 300;
    normal.velocityX = 1;
    normal.connected = true;
    state.players.set("normal", normal);

    const focused = new PlayerSchema();
    focused.x = 400;
    focused.y = 300;
    focused.velocityX = 1;
    focused.isFocusing = true;
    focused.connected = true;
    state.players.set("focused", focused);

    applyMovement(state, 1 / 60);

    // Focused player should have moved less
    expect(focused.x - 400).toBeLessThan(normal.x - 400);
  });
});
