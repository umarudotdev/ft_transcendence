import type { GameState } from "../schemas/GameState";

import {
  chargeUltimate,
  cleanupExpiredEffects,
  updateDashFlags,
  updateEffectWaves,
} from "./abilities";
import { type HitEvent, type GrazeEvent, checkCollisions } from "./collision";
import {
  applyDamage,
  checkGameOver,
  processDeathbombExpiry,
  processFireInput,
} from "./combat";
import { applyMovement } from "./movement";
import { checkSpellCardResolution, processSpellCardFire } from "./spellcard";

export interface TickResult {
  hits: HitEvent[];
  grazes: GrazeEvent[];
  spellCardResolution: "success" | "captured" | null;
  winnerId: string | null;
}

/**
 * Run one tick of the game simulation. Pure state mutation — no I/O or broadcasts.
 * Both GameRoom and PlaygroundRoom compose this to share identical game physics.
 */
export function runGameTick(state: GameState, dt: number): TickResult {
  state.tick++;

  // 1. Process fire input → spawn bullets
  processFireInput(state);

  // 1b. Spell card fire (if active)
  processSpellCardFire(state);

  // 2. Move players and bullets
  applyMovement(state, dt);

  // 3. Check bullet-player collisions and grazes
  const { hits, grazes } = checkCollisions(state);

  // 4. Apply damage from hits and charge ultimate
  if (hits.length > 0) {
    applyDamage(state, hits);

    // Charge the shooter's ultimate for each hit
    for (const hit of hits) {
      for (const [id, player] of state.players) {
        if (id !== hit.playerId) {
          chargeUltimate(player, hit.damage);
          break;
        }
      }
    }
  }

  // 4b. Process grazes — charge the grazer's ultimate (anti-snowball)
  for (const graze of grazes) {
    const grazer = state.players.get(graze.playerId);
    if (grazer) {
      chargeUltimate(grazer, 2);
    }
  }

  // 5. Process deathbomb window expirations
  processDeathbombExpiry(state);

  // 6. Progressive bomb/ultimate expansion
  updateEffectWaves(state);

  // 7. Cleanup expired effects and dash flags
  cleanupExpiredEffects(state);
  updateDashFlags(state);

  // 8. Check spell card resolution
  const spellCardResolution = checkSpellCardResolution(state);

  // 9. Check for game over
  const winnerId = checkGameOver(state);

  return { hits, grazes, spellCardResolution, winnerId };
}
