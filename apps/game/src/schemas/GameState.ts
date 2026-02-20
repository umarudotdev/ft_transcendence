import { ArraySchema, MapSchema, Schema, type } from "@colyseus/schema";

import { BulletSchema } from "./BulletSchema";
import { EffectSchema } from "./EffectSchema";
import { PlayerSchema } from "./PlayerSchema";

export type GamePhase =
  | "waiting"
  | "countdown"
  | "playing"
  | "finished"
  | "abandoned";

export class GameState extends Schema {
  @type({ map: PlayerSchema }) players = new MapSchema<PlayerSchema>();
  @type([BulletSchema]) bullets = new ArraySchema<BulletSchema>();
  @type([EffectSchema]) effects = new ArraySchema<EffectSchema>();
  @type("uint32") tick: number = 0;
  @type("string") phase: string = "waiting" satisfies GamePhase;
  @type("number") countdownTimer: number = 0;
  @type("string") winnerId: string = "";

  // Spell card state (synced)
  @type("string") spellCardDeclarer: string = "";
  @type("uint32") spellCardEndsAtTick: number = 0;

  // Spell card state (server-only)
  spellCardDefenderId: string = "";
  defenderLivesAtStart: number = 0;
}
