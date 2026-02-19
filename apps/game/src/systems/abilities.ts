import type { GameState } from "../schemas/GameState";
import type { PlayerSchema } from "../schemas/PlayerSchema";

import { CANVAS_HEIGHT, CANVAS_WIDTH, TICK_RATE } from "../config";
import { EffectSchema } from "../schemas/EffectSchema";
import { applyDirectDamage } from "./combat";

const DASH_COOLDOWN_TICKS = TICK_RATE * 8;
const DASH_DISTANCE = 100;
const DASH_INVINCIBILITY_TICKS = Math.round(TICK_RATE * 0.2);
const DASH_VISUAL_TICKS = 6; // ~100ms — enough for 2 state patches at 20Hz

const BOMB_COOLDOWN_TICKS = TICK_RATE * 12;
const BOMB_RADIUS = 120;
const BOMB_DAMAGE = 30;
const BOMB_EFFECT_DURATION_TICKS = Math.round(TICK_RATE * 0.5);

const ULTIMATE_CHARGE_REQUIRED = 100;
const ULTIMATE_CHARGE_PER_DAMAGE = 1;
const ULTIMATE_BULLET_CLEAR_RADIUS = 200;
const ULTIMATE_DAMAGE = 50;
const ULTIMATE_EFFECT_DURATION_TICKS = TICK_RATE;

export type AbilitySlot = 1 | 2 | 3;

export function activateAbility(
  state: GameState,
  sessionId: string,
  player: PlayerSchema,
  slot: AbilitySlot
): boolean {
  switch (slot) {
    case 1:
      return activateDash(state, sessionId, player);
    case 2:
      return activateBomb(state, sessionId, player);
    case 3:
      return activateUltimate(state, sessionId, player);
    default:
      return false;
  }
}

function activateDash(
  state: GameState,
  _sessionId: string,
  player: PlayerSchema
): boolean {
  if (state.tick - player.ability1LastUsedTick < DASH_COOLDOWN_TICKS) {
    return false;
  }

  player.ability1LastUsedTick = state.tick;
  player.ability1CooldownUntil = state.tick + DASH_COOLDOWN_TICKS;
  player.isDashing = true;

  // Teleport in movement direction (or forward if stationary)
  let dx = player.velocityX;
  let dy = player.velocityY;

  if (dx === 0 && dy === 0) {
    // Default: dash forward (up for player 1, down for player 2)
    dy = player.playerIndex === 0 ? -1 : 1;
  }

  // Normalize
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len > 0) {
    dx /= len;
    dy /= len;
  }

  player.x = Math.max(
    16,
    Math.min(CANVAS_WIDTH - 16, player.x + dx * DASH_DISTANCE)
  );
  player.y = Math.max(
    16,
    Math.min(CANVAS_HEIGHT - 16, player.y + dy * DASH_DISTANCE)
  );

  // Grant brief invincibility
  player.invincibleUntil = state.tick + DASH_INVINCIBILITY_TICKS;

  // Keep isDashing true for a few ticks so clients receive it in state patches
  player.isDashingUntil = state.tick + DASH_VISUAL_TICKS;

  return true;
}

function activateBomb(
  state: GameState,
  sessionId: string,
  player: PlayerSchema
): boolean {
  if (state.tick - player.ability2LastUsedTick < BOMB_COOLDOWN_TICKS) {
    return false;
  }

  player.ability2LastUsedTick = state.tick;
  player.ability2CooldownUntil = state.tick + BOMB_COOLDOWN_TICKS;

  // Clear enemy bullets within radius
  for (let i = state.bullets.length - 1; i >= 0; i--) {
    const bullet = state.bullets[i];
    if (bullet.ownerId === sessionId) continue;

    const dx = bullet.x - player.x;
    const dy = bullet.y - player.y;
    if (dx * dx + dy * dy < BOMB_RADIUS * BOMB_RADIUS) {
      state.bullets.splice(i, 1);
    }
  }

  // Damage enemy if in range
  for (const [otherId, other] of state.players) {
    if (otherId === sessionId) continue;
    const dx = other.x - player.x;
    const dy = other.y - player.y;
    if (dx * dx + dy * dy < BOMB_RADIUS * BOMB_RADIUS) {
      applyDirectDamage(state, otherId, other, BOMB_DAMAGE);
    }
  }

  // Add visual effect
  const effect = new EffectSchema();
  effect.effectType = "bomb";
  effect.x = player.x;
  effect.y = player.y;
  effect.radius = BOMB_RADIUS;
  effect.ownerId = sessionId;
  effect.expiresAtTick = state.tick + BOMB_EFFECT_DURATION_TICKS;
  state.effects.push(effect);

  return true;
}

function activateUltimate(
  state: GameState,
  sessionId: string,
  player: PlayerSchema
): boolean {
  if (player.ultimateCharge < ULTIMATE_CHARGE_REQUIRED) {
    return false;
  }

  player.ultimateCharge = 0;

  // Clear enemy bullets in large radius
  for (let i = state.bullets.length - 1; i >= 0; i--) {
    const bullet = state.bullets[i];
    if (bullet.ownerId === sessionId) continue;

    const dx = bullet.x - player.x;
    const dy = bullet.y - player.y;
    if (
      dx * dx + dy * dy <
      ULTIMATE_BULLET_CLEAR_RADIUS * ULTIMATE_BULLET_CLEAR_RADIUS
    ) {
      state.bullets.splice(i, 1);
    }
  }

  // Damage enemy if in range (same radius as bullet clear)
  for (const [otherId, other] of state.players) {
    if (otherId === sessionId) continue;
    const edx = other.x - player.x;
    const edy = other.y - player.y;
    if (
      edx * edx + edy * edy <
      ULTIMATE_BULLET_CLEAR_RADIUS * ULTIMATE_BULLET_CLEAR_RADIUS
    ) {
      applyDirectDamage(state, otherId, other, ULTIMATE_DAMAGE);
    }
  }

  // Add visual effect
  const effect = new EffectSchema();
  effect.effectType = "ultimate";
  effect.x = player.x;
  effect.y = player.y;
  effect.radius = ULTIMATE_BULLET_CLEAR_RADIUS;
  effect.ownerId = sessionId;
  effect.expiresAtTick = state.tick + ULTIMATE_EFFECT_DURATION_TICKS;
  state.effects.push(effect);

  return true;
}

export function chargeUltimate(player: PlayerSchema, damageDealt: number) {
  player.ultimateCharge = Math.min(
    ULTIMATE_CHARGE_REQUIRED,
    player.ultimateCharge + damageDealt * ULTIMATE_CHARGE_PER_DAMAGE
  );
}

export function updateDashFlags(state: GameState) {
  for (const [, player] of state.players) {
    if (player.isDashing && state.tick >= player.isDashingUntil) {
      player.isDashing = false;
    }
  }
}

export function cleanupExpiredEffects(state: GameState) {
  for (let i = state.effects.length - 1; i >= 0; i--) {
    if (state.effects[i].expiresAtTick <= state.tick) {
      state.effects.splice(i, 1);
    }
  }
}
