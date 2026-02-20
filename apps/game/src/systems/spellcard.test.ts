import { describe, expect, test } from "bun:test";

import { GameState } from "../schemas/GameState";
import { PlayerSchema } from "../schemas/PlayerSchema";
import {
  SPELL_CARD_DURATION_TICKS,
  checkSpellCardResolution,
  declareSpellCard,
  isSpellCardActive,
  processSpellCardFire,
} from "./spellcard";

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

describe("declareSpellCard", () => {
  test("sets spell card state and returns true", () => {
    const { state } = createTwoPlayerState();

    const result = declareSpellCard(state, "p1");

    expect(result).toBe(true);
    expect(state.spellCardDeclarer).toBe("p1");
    expect(state.spellCardEndsAtTick).toBe(
      state.tick + SPELL_CARD_DURATION_TICKS
    );
    expect(isSpellCardActive(state)).toBe(true);
  });

  test("cannot declare while one is active", () => {
    const { state } = createTwoPlayerState();

    declareSpellCard(state, "p1");
    const result = declareSpellCard(state, "p2");

    expect(result).toBe(false);
    expect(state.spellCardDeclarer).toBe("p1");
  });
});

describe("processSpellCardFire", () => {
  test("fires 14 bullets on even ticks", () => {
    const { state } = createTwoPlayerState();
    declareSpellCard(state, "p1");

    // Even tick (divisible by 2) — should fire
    state.tick = 1002;
    processSpellCardFire(state);

    // 8 primary + 6 secondary = 14 bullets
    expect(state.bullets.length).toBe(14);
    for (const b of state.bullets) {
      expect(b.ownerId).toBe("p1");
    }
  });

  test("does not fire on odd ticks", () => {
    const { state } = createTwoPlayerState();
    declareSpellCard(state, "p1");

    state.tick = 1001;
    processSpellCardFire(state);

    expect(state.bullets.length).toBe(0);
  });

  test("does not fire when no spell card is active", () => {
    const { state } = createTwoPlayerState();

    state.tick = 1002;
    processSpellCardFire(state);

    expect(state.bullets.length).toBe(0);
  });
});

describe("checkSpellCardResolution", () => {
  test("returns 'captured' after duration if defender survives", () => {
    const { state } = createTwoPlayerState();
    declareSpellCard(state, "p1");

    // Advance past spell card end
    state.tick = state.spellCardEndsAtTick;

    const result = checkSpellCardResolution(state);

    expect(result).toBe("captured");
    expect(state.spellCardDeclarer).toBe("");
  });

  test("captured awards charge to defender", () => {
    const { state, p2 } = createTwoPlayerState();
    p2.ultimateCharge = 0;
    declareSpellCard(state, "p1");

    state.tick = state.spellCardEndsAtTick;
    checkSpellCardResolution(state);

    expect(p2.ultimateCharge).toBe(25);
  });

  test("returns 'success' if defender loses a life", () => {
    const { state, p2 } = createTwoPlayerState();
    declareSpellCard(state, "p1");

    // Defender loses a life during spell card
    p2.lives = 2;

    const result = checkSpellCardResolution(state);

    expect(result).toBe("success");
    expect(state.spellCardDeclarer).toBe("");
  });

  test("returns null while spell card is active and defender alive", () => {
    const { state } = createTwoPlayerState();
    declareSpellCard(state, "p1");

    state.tick += 100; // Mid-spell card

    const result = checkSpellCardResolution(state);

    expect(result).toBeNull();
  });

  test("returns null when no spell card is active", () => {
    const { state } = createTwoPlayerState();

    const result = checkSpellCardResolution(state);

    expect(result).toBeNull();
  });
});
