import type { GameState } from "../schemas/GameState";
import type { PlayerSchema } from "../schemas/PlayerSchema";
import type { HitEvent } from "./collision";

import { TICK_RATE } from "../config";
import { BulletSchema } from "../schemas/BulletSchema";
import {
  BOMB_COOLDOWN_TICKS,
  DEATHBOMB_WINDOW_TICKS,
  INVINCIBILITY_TICKS,
  MAX_HP,
} from "./constants";
import { isSpellCardActive } from "./spellcard";

const BULLET_SPEED = 500;
const FIRE_COOLDOWN_TICKS = Math.round(TICK_RATE * 0.1); // 100ms = 6 ticks at 60Hz
const SPREAD_COOLDOWN_TICKS = Math.round(TICK_RATE * 0.3); // 300ms between spread volleys

const SPREAD_ANGLE = Math.PI / 12; // 15 degrees
const SPREAD_ANGULAR_VELOCITY = 1.2; // radians/sec — how fast outer spread bullets curve
const INNER_SPREAD_ANGLE = Math.PI / 24; // ~7.5 degrees
const INNER_ANGULAR_VELOCITY = 0.6; // radians/sec — gentler curve for inner pair

function spawnBullet(
  state: GameState,
  x: number,
  y: number,
  vx: number,
  vy: number,
  ownerId: string,
  damage: number,
  angularVelocity = 0,
  fireMode: "spread" | "focus" = "spread"
) {
  const bullet = new BulletSchema();
  bullet.x = x;
  bullet.y = y;
  bullet.velocityX = vx;
  bullet.velocityY = vy;
  bullet.ownerId = ownerId;
  bullet.damage = damage;
  bullet.angularVelocity = angularVelocity;
  bullet.fireMode = fireMode;
  bullet.speed = Math.sqrt(vx * vx + vy * vy);
  state.bullets.push(bullet);
}

export function processFireInput(state: GameState) {
  for (const [sessionId, player] of state.players) {
    if (!player.connected || !player.isFiring) continue;

    // Spell card declarer's normal fire is suppressed during the spell card
    if (isSpellCardActive(state) && sessionId === state.spellCardDeclarer)
      continue;

    const aimX = Math.sin(player.aimAngle);
    const aimY = -Math.cos(player.aimAngle);

    if (player.isFocusing) {
      // Focus mode: concentrated single shot (faster fire rate, more damage, straight)
      if (state.tick - player.lastFireTick < FIRE_COOLDOWN_TICKS) continue;
      player.lastFireTick = state.tick;

      spawnBullet(
        state,
        player.x,
        player.y,
        aimX * BULLET_SPEED,
        aimY * BULLET_SPEED,
        sessionId,
        15,
        0,
        "focus"
      );
    } else {
      // Normal mode: 5-way spread shot with curving bullets
      if (state.tick - player.lastFireTick < SPREAD_COOLDOWN_TICKS) continue;
      player.lastFireTick = state.tick;

      // Center bullet (straight)
      spawnBullet(
        state,
        player.x,
        player.y,
        aimX * BULLET_SPEED,
        aimY * BULLET_SPEED,
        sessionId,
        6,
        0,
        "spread"
      );

      // Inner left spread (gentle curve)
      const innerLeftAngle = player.aimAngle - INNER_SPREAD_ANGLE;
      spawnBullet(
        state,
        player.x,
        player.y,
        Math.sin(innerLeftAngle) * BULLET_SPEED,
        -Math.cos(innerLeftAngle) * BULLET_SPEED,
        sessionId,
        6,
        -INNER_ANGULAR_VELOCITY,
        "spread"
      );

      // Inner right spread (gentle curve)
      const innerRightAngle = player.aimAngle + INNER_SPREAD_ANGLE;
      spawnBullet(
        state,
        player.x,
        player.y,
        Math.sin(innerRightAngle) * BULLET_SPEED,
        -Math.cos(innerRightAngle) * BULLET_SPEED,
        sessionId,
        6,
        INNER_ANGULAR_VELOCITY,
        "spread"
      );

      // Outer left spread (wide curve)
      const leftAngle = player.aimAngle - SPREAD_ANGLE;
      spawnBullet(
        state,
        player.x,
        player.y,
        Math.sin(leftAngle) * BULLET_SPEED,
        -Math.cos(leftAngle) * BULLET_SPEED,
        sessionId,
        6,
        -SPREAD_ANGULAR_VELOCITY,
        "spread"
      );

      // Outer right spread (wide curve)
      const rightAngle = player.aimAngle + SPREAD_ANGLE;
      spawnBullet(
        state,
        player.x,
        player.y,
        Math.sin(rightAngle) * BULLET_SPEED,
        -Math.cos(rightAngle) * BULLET_SPEED,
        sessionId,
        6,
        SPREAD_ANGULAR_VELOCITY,
        "spread"
      );
    }
  }
}

export function applyDamage(
  state: GameState,
  hits: HitEvent[]
): { deadPlayerId: string; killerId: string } | null {
  for (const hit of hits) {
    const player = state.players.get(hit.playerId);
    if (!player) continue;

    player.hp -= hit.damage;

    if (player.hp <= 0) {
      return handleDeath(state, hit.playerId, player, hit);
    }
  }
  return null;
}

function handleDeath(
  state: GameState,
  playerId: string,
  player: PlayerSchema,
  hit: HitEvent
): { deadPlayerId: string; killerId: string } | null {
  // Deathbomb: if bomb is off cooldown, give the player a brief window to bomb
  const bombOffCooldown =
    state.tick - player.ability2LastUsedTick >= BOMB_COOLDOWN_TICKS;
  if (bombOffCooldown) {
    player.hp = 0;
    player.deathbombWindowUntil = state.tick + DEATHBOMB_WINDOW_TICKS;
    // Grant brief invincibility for the window duration so they don't get hit again
    player.invincibleUntil = Math.max(
      player.invincibleUntil,
      state.tick + DEATHBOMB_WINDOW_TICKS
    );
    return null; // Defer death — lives unchanged
  }

  // No deathbomb available: immediate death
  player.lives--;

  if (player.lives <= 0) {
    return {
      deadPlayerId: playerId,
      killerId: hit.bulletIndex >= 0 ? findKiller(state, playerId) : "",
    };
  }

  // Respawn: reset HP and grant invincibility
  player.hp = MAX_HP;
  player.invincibleUntil = state.tick + INVINCIBILITY_TICKS;

  return null;
}

function findKiller(state: GameState, deadPlayerId: string): string {
  for (const [sessionId] of state.players) {
    if (sessionId !== deadPlayerId) return sessionId;
  }
  return "";
}

/** Apply damage to a player and handle death/respawn (used by abilities). */
export function applyDirectDamage(
  state: GameState,
  playerId: string,
  player: PlayerSchema,
  damage: number
) {
  player.hp -= damage;

  if (player.hp <= 0) {
    player.lives--;

    if (player.lives > 0) {
      player.hp = MAX_HP;
      player.invincibleUntil = state.tick + INVINCIBILITY_TICKS;
    }
  }
}

/** Process expired deathbomb windows — player didn't bomb in time, so they die. */
export function processDeathbombExpiry(state: GameState) {
  for (const [, player] of state.players) {
    if (
      player.deathbombWindowUntil > 0 &&
      state.tick >= player.deathbombWindowUntil
    ) {
      player.deathbombWindowUntil = 0;
      player.lives--;

      if (player.lives > 0) {
        player.hp = MAX_HP;
        player.invincibleUntil = state.tick + INVINCIBILITY_TICKS;
      }
      // If lives <= 0, checkGameOver will handle it
    }
  }
}

export function checkGameOver(state: GameState): string | null {
  for (const [sessionId, player] of state.players) {
    if (player.lives <= 0) {
      for (const [otherId] of state.players) {
        if (otherId !== sessionId) return otherId;
      }
    }
  }
  return null;
}
