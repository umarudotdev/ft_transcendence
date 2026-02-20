import type { GameState } from "../schemas/GameState";
import type { PlayerSchema } from "../schemas/PlayerSchema";

import { CANVAS_HEIGHT, CANVAS_WIDTH, TICK_RATE } from "../config";
import { EffectSchema } from "../schemas/EffectSchema";
import { applyDirectDamage } from "./combat";
import { BOMB_COOLDOWN_TICKS, INVINCIBILITY_TICKS, MAX_HP } from "./constants";
import { declareSpellCard } from "./spellcard";

const DASH_COOLDOWN_TICKS = TICK_RATE * 8;
const DASH_DISTANCE = 100;
const DASH_INVINCIBILITY_TICKS = Math.round(TICK_RATE * 0.2);
const DASH_VISUAL_TICKS = 6; // ~100ms — enough for 2 state patches at 20Hz

const BOMB_RADIUS = 120;
const BOMB_DAMAGE = 30;
const BOMB_EFFECT_DURATION_TICKS = Math.round(TICK_RATE * 0.5);
export const BOMB_EXPANSION_TICKS = 12; // ~200ms

const ULTIMATE_CHARGE_REQUIRED = 100;
const ULTIMATE_CHARGE_PER_DAMAGE = 1;

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

  // Dash in movement direction if moving, otherwise toward cursor
  let dx = player.velocityX;
  let dy = player.velocityY;

  if (dx === 0 && dy === 0) {
    dx = Math.sin(player.aimAngle);
    dy = -Math.cos(player.aimAngle);
  } else {
    const len = Math.sqrt(dx * dx + dy * dy);
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
  const isDeathbombing = player.deathbombWindowUntil > state.tick;

  if (!isDeathbombing) {
    // Normal bomb: check cooldown
    if (state.tick - player.ability2LastUsedTick < BOMB_COOLDOWN_TICKS) {
      return false;
    }
  } else {
    // Deathbomb: cancel death window, restore HP, grant invincibility
    player.deathbombWindowUntil = 0;
    player.hp = MAX_HP;
    player.invincibleUntil = state.tick + INVINCIBILITY_TICKS;
  }

  player.ability2LastUsedTick = state.tick;
  player.ability2CooldownUntil = state.tick + BOMB_COOLDOWN_TICKS;

  // Create effect — damage and bullet clearing happen progressively in updateEffectWaves
  const effect = new EffectSchema();
  effect.effectType = "bomb";
  effect.x = player.x;
  effect.y = player.y;
  effect.radius = BOMB_RADIUS;
  effect.ownerId = sessionId;
  effect.createdAtTick = state.tick;
  effect.expiresAtTick =
    state.tick + BOMB_EXPANSION_TICKS + BOMB_EFFECT_DURATION_TICKS;
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

  return declareSpellCard(state, sessionId);
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

/** Process expanding bomb waves each tick — clears bullets and damages enemies progressively. */
export function updateEffectWaves(state: GameState) {
  for (const effect of state.effects) {
    if (effect.effectType !== "bomb") continue;

    const elapsed = state.tick - effect.createdAtTick;
    if (elapsed > BOMB_EXPANSION_TICKS) continue; // Past expansion phase

    const progress = Math.min(1, elapsed / BOMB_EXPANSION_TICKS);
    const currentRadius = effect.radius * progress;
    const radiusSq = currentRadius * currentRadius;

    // Clear enemy bullets within current radius
    for (let i = state.bullets.length - 1; i >= 0; i--) {
      const bullet = state.bullets[i];
      if (bullet.ownerId === effect.ownerId) continue;

      const dx = bullet.x - effect.x;
      const dy = bullet.y - effect.y;
      if (dx * dx + dy * dy < radiusSq) {
        state.bullets.splice(i, 1);
      }
    }

    // Damage enemies within current radius (once per player per effect)
    for (const [otherId, other] of state.players) {
      if (otherId === effect.ownerId) continue;
      if (effect.damagedPlayers.has(otherId)) continue;

      const dx = other.x - effect.x;
      const dy = other.y - effect.y;
      if (dx * dx + dy * dy < radiusSq) {
        applyDirectDamage(state, otherId, other, BOMB_DAMAGE);
        effect.damagedPlayers.add(otherId);
      }
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
