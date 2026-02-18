import type { GameState } from "../schemas/GameState";
import type { PlayerSchema } from "../schemas/PlayerSchema";
import type { HitEvent } from "./collision";

import { TICK_RATE } from "../config";
import { BulletSchema } from "../schemas/BulletSchema";

const BULLET_SPEED = 500;
const FIRE_COOLDOWN_TICKS = Math.round(TICK_RATE * 0.1); // 100ms = 6 ticks at 60Hz
const SPREAD_COOLDOWN_TICKS = Math.round(TICK_RATE * 0.3); // 300ms between spread volleys
const INVINCIBILITY_TICKS = Math.round(TICK_RATE * 1.5); // 1.5 seconds
const MAX_HP = 100;

const SPREAD_ANGLE = Math.PI / 12; // 15 degrees

function spawnBullet(
  state: GameState,
  x: number,
  y: number,
  vx: number,
  vy: number,
  ownerId: string,
  damage: number
) {
  const bullet = new BulletSchema();
  bullet.x = x;
  bullet.y = y;
  bullet.velocityX = vx;
  bullet.velocityY = vy;
  bullet.ownerId = ownerId;
  bullet.damage = damage;
  state.bullets.push(bullet);
}

export function processFireInput(state: GameState) {
  for (const [sessionId, player] of state.players) {
    if (!player.connected || !player.isFiring) continue;

    const direction = player.playerIndex === 0 ? -1 : 1;

    if (player.isFocusing) {
      // Focus mode: concentrated single shot (faster fire rate, more damage)
      if (state.tick - player.lastFireTick < FIRE_COOLDOWN_TICKS) continue;
      player.lastFireTick = state.tick;

      spawnBullet(
        state,
        player.x,
        player.y,
        0,
        direction * BULLET_SPEED,
        sessionId,
        15
      );
    } else {
      // Normal mode: 3-way spread shot
      if (state.tick - player.lastFireTick < SPREAD_COOLDOWN_TICKS) continue;
      player.lastFireTick = state.tick;

      // Center bullet
      spawnBullet(
        state,
        player.x,
        player.y,
        0,
        direction * BULLET_SPEED,
        sessionId,
        8
      );

      // Left spread
      spawnBullet(
        state,
        player.x,
        player.y,
        Math.sin(-SPREAD_ANGLE) * BULLET_SPEED,
        direction * Math.cos(SPREAD_ANGLE) * BULLET_SPEED,
        sessionId,
        8
      );

      // Right spread
      spawnBullet(
        state,
        player.x,
        player.y,
        Math.sin(SPREAD_ANGLE) * BULLET_SPEED,
        direction * Math.cos(SPREAD_ANGLE) * BULLET_SPEED,
        sessionId,
        8
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
