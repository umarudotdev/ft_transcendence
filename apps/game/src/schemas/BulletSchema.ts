import { Schema, type } from "@colyseus/schema";

export class BulletSchema extends Schema {
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("number") velocityX: number = 0;
  @type("number") velocityY: number = 0;
  @type("string") ownerId: string = "";
  @type("uint8") damage: number = 10;
}
