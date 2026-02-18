import { Schema, type } from "@colyseus/schema";

export class EffectSchema extends Schema {
  @type("string") effectType: string = "";
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("number") radius: number = 0;
  @type("string") ownerId: string = "";
  @type("uint32") expiresAtTick: number = 0;
}
