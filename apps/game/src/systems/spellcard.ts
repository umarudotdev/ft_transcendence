import type { GameState } from "../schemas/GameState";

import { TICK_RATE } from "../config";
import { BulletSchema } from "../schemas/BulletSchema";
import { chargeUltimate } from "./abilities";

export const SPELL_CARD_DURATION_TICKS = 480; // 8s at 60Hz
const SPELL_BULLET_SPEED = 125;
const SPELL_FIRE_INTERVAL = 2; // Every 2 ticks
const SPELL_BULLET_DAMAGE = 8;
const DEFENDER_CAPTURE_CHARGE = 25;

const PRIMARY_ARM_COUNT = 8;
const SECONDARY_ARM_COUNT = 6;
const PRIMARY_ANGULAR_VELOCITY = 0.8; // rad/s
const SECONDARY_ANGULAR_VELOCITY = -0.6; // rad/s (counter-rotating)

export function isSpellCardActive(state: GameState): boolean {
  return (
    state.spellCardDeclarer !== "" && state.tick < state.spellCardEndsAtTick
  );
}

export function declareSpellCard(
  state: GameState,
  declarerId: string
): boolean {
  if (isSpellCardActive(state)) return false;

  // Find defender
  let defenderId = "";
  let defenderLives = 0;
  for (const [sessionId, player] of state.players) {
    if (sessionId !== declarerId) {
      defenderId = sessionId;
      defenderLives = player.lives;
      break;
    }
  }
  if (!defenderId) return false;

  state.spellCardDeclarer = declarerId;
  state.spellCardEndsAtTick = state.tick + SPELL_CARD_DURATION_TICKS;
  state.spellCardDefenderId = defenderId;
  state.defenderLivesAtStart = defenderLives;

  return true;
}

export function processSpellCardFire(state: GameState) {
  if (!isSpellCardActive(state)) return;
  if (state.tick % SPELL_FIRE_INTERVAL !== 0) return;

  const declarer = state.players.get(state.spellCardDeclarer);
  if (!declarer) return;

  const elapsed =
    state.tick - (state.spellCardEndsAtTick - SPELL_CARD_DURATION_TICKS);
  const elapsedSeconds = elapsed / TICK_RATE;

  // Primary arms (8 arms, rotating clockwise)
  for (let i = 0; i < PRIMARY_ARM_COUNT; i++) {
    const baseAngle =
      (2 * Math.PI * i) / PRIMARY_ARM_COUNT +
      PRIMARY_ANGULAR_VELOCITY * elapsedSeconds;
    const vx = Math.sin(baseAngle) * SPELL_BULLET_SPEED;
    const vy = -Math.cos(baseAngle) * SPELL_BULLET_SPEED;

    const bullet = new BulletSchema();
    bullet.x = declarer.x;
    bullet.y = declarer.y;
    bullet.velocityX = vx;
    bullet.velocityY = vy;
    bullet.ownerId = state.spellCardDeclarer;
    bullet.damage = SPELL_BULLET_DAMAGE;
    bullet.angularVelocity = PRIMARY_ANGULAR_VELOCITY;
    bullet.fireMode = "spread";
    bullet.speed = SPELL_BULLET_SPEED;
    state.bullets.push(bullet);
  }

  // Secondary arms (6 arms, counter-rotating)
  for (let i = 0; i < SECONDARY_ARM_COUNT; i++) {
    const baseAngle =
      (2 * Math.PI * i) / SECONDARY_ARM_COUNT +
      SECONDARY_ANGULAR_VELOCITY * elapsedSeconds;
    const vx = Math.sin(baseAngle) * SPELL_BULLET_SPEED;
    const vy = -Math.cos(baseAngle) * SPELL_BULLET_SPEED;

    const bullet = new BulletSchema();
    bullet.x = declarer.x;
    bullet.y = declarer.y;
    bullet.velocityX = vx;
    bullet.velocityY = vy;
    bullet.ownerId = state.spellCardDeclarer;
    bullet.damage = SPELL_BULLET_DAMAGE;
    bullet.angularVelocity = SECONDARY_ANGULAR_VELOCITY;
    bullet.fireMode = "spread";
    bullet.speed = SPELL_BULLET_SPEED;
    state.bullets.push(bullet);
  }
}

export function checkSpellCardResolution(
  state: GameState
): "success" | "captured" | null {
  if (!isSpellCardActive(state) && state.spellCardDeclarer === "") return null;

  // Check if defender lost a life (success for declarer)
  const defender = state.players.get(state.spellCardDefenderId);
  if (defender && defender.lives < state.defenderLivesAtStart) {
    clearSpellCard(state);
    return "success";
  }

  // Check if time expired (captured by defender)
  if (
    state.tick >= state.spellCardEndsAtTick &&
    state.spellCardDeclarer !== ""
  ) {
    if (defender) {
      chargeUltimate(defender, DEFENDER_CAPTURE_CHARGE);
    }
    clearSpellCard(state);
    return "captured";
  }

  return null;
}

function clearSpellCard(state: GameState) {
  // Remove all bullets owned by the declarer (spell card pattern bullets spiral
  // endlessly and would never leave the canvas on their own)
  const declarerId = state.spellCardDeclarer;
  for (let i = state.bullets.length - 1; i >= 0; i--) {
    if (state.bullets[i].ownerId === declarerId) {
      state.bullets.splice(i, 1);
    }
  }

  state.spellCardDeclarer = "";
  state.spellCardEndsAtTick = 0;
  state.spellCardDefenderId = "";
  state.defenderLivesAtStart = 0;
}
