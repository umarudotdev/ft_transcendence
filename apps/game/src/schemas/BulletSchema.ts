import { Schema, type } from "@colyseus/schema";

export class BulletSchema extends Schema {
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("number") velocityX: number = 0;
  @type("number") velocityY: number = 0;
  @type("string") ownerId: string = "";
  @type("uint8") damage: number = 10;
  @type("number") angularVelocity: number = 0;
  @type("string") fireMode: string = "spread";

  /** Cached speed magnitude (server-only, not synced) */
  speed: number = 0;

  /** Players who have already been grazed by this bullet (server-only) */
  grazedPlayers: Set<string> = new Set();
}
