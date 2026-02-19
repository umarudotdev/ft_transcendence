import { describe, expect, test } from "bun:test";

import { BulletSchema } from "../schemas/BulletSchema";
import { GameState } from "../schemas/GameState";
import { PlayerSchema } from "../schemas/PlayerSchema";
import { checkCollisions } from "./collision";

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

function addBullet(
  state: GameState,
  x: number,
  y: number,
  ownerId: string,
  damage = 10
): BulletSchema {
  const bullet = new BulletSchema();
  bullet.x = x;
  bullet.y = y;
  bullet.ownerId = ownerId;
  bullet.damage = damage;
  state.bullets.push(bullet);
  return bullet;
}

describe("checkCollisions", () => {
  test("detects bullet hitting enemy player", () => {
    const { state, p2 } = createTwoPlayerState();
    // Place a bullet from p1 right on top of p2
    addBullet(state, p2.x, p2.y, "p1", 10);

    const { hits } = checkCollisions(state);

    expect(hits.length).toBe(1);
    expect(hits[0].playerId).toBe("p2");
    expect(hits[0].damage).toBe(10);
    // Bullet should be removed
    expect(state.bullets.length).toBe(0);
  });

  test("own bullets do not hit owner", () => {
    const { state, p1 } = createTwoPlayerState();
    // Place p1's bullet on top of p1
    addBullet(state, p1.x, p1.y, "p1");

    const { hits } = checkCollisions(state);

    expect(hits.length).toBe(0);
    expect(state.bullets.length).toBe(1); // Bullet stays
  });

  test("bullet misses distant player", () => {
    const { state } = createTwoPlayerState();
    // Place bullet far from both players
    addBullet(state, 100, 300, "p1");

    const { hits } = checkCollisions(state);

    expect(hits.length).toBe(0);
    expect(state.bullets.length).toBe(1);
  });

  test("invincible player is not hit", () => {
    const { state, p2 } = createTwoPlayerState();
    state.tick = 100;
    p2.invincibleUntil = 200; // Still invincible

    addBullet(state, p2.x, p2.y, "p1");

    const { hits } = checkCollisions(state);

    expect(hits.length).toBe(0);
  });

  test("disconnected player is not hit", () => {
    const { state, p2 } = createTwoPlayerState();
    p2.connected = false;

    addBullet(state, p2.x, p2.y, "p1");

    const { hits } = checkCollisions(state);

    expect(hits.length).toBe(0);
  });

  test("bullet can only hit one player", () => {
    const { state, p1, p2 } = createTwoPlayerState();
    // Place both players at same position
    p2.x = p1.x;
    p2.y = p1.y;

    addBullet(state, p1.x, p1.y, "external");

    const { hits } = checkCollisions(state);

    // Only one hit should register
    expect(hits.length).toBe(1);
    expect(state.bullets.length).toBe(0);
  });

  test("multiple bullets can hit different players", () => {
    const { state, p1, p2 } = createTwoPlayerState();

    addBullet(state, p1.x, p1.y, "p2", 10);
    addBullet(state, p2.x, p2.y, "p1", 15);

    const { hits } = checkCollisions(state);

    expect(hits.length).toBe(2);
    expect(state.bullets.length).toBe(0);
  });

  test("returns empty array when no bullets exist", () => {
    const { state } = createTwoPlayerState();

    const { hits } = checkCollisions(state);

    expect(hits.length).toBe(0);
  });

  test("nearby but non-colliding bullet does not hit", () => {
    const { state, p2 } = createTwoPlayerState();
    // Combined radius is 3+4=7, so distance > 7 should miss
    addBullet(state, p2.x + 10, p2.y, "p1");

    const { hits } = checkCollisions(state);

    expect(hits.length).toBe(0);
  });
});
