import { Schema, type } from "@colyseus/schema";

import { CANVAS_HEIGHT, CANVAS_WIDTH } from "../config";

const PLAYER_SPEED = 300;
const FOCUS_SPEED = 150;

export class PlayerSchema extends Schema {
  @type("number") x: number = CANVAS_WIDTH / 2;
  @type("number") y: number = 0;
  @type("number") velocityX: number = 0;
  @type("number") velocityY: number = 0;
  @type("number") aimAngle: number = 0;
  @type("int16") hp: number = 100;
  @type("uint8") lives: number = 3;
  @type("boolean") connected: boolean = true;
  @type("boolean") isFiring: boolean = false;
  @type("boolean") isFocusing: boolean = false;
  @type("boolean") isDashing: boolean = false;
  @type("boolean") isShielded: boolean = false;
  @type("uint8") playerIndex: number = 0;
  @type("number") userId: number = 0;
  @type("string") displayName: string = "";
  @type("uint32") invincibleUntil: number = 0;
  @type("uint8") score: number = 0;
  @type("uint8") ultimateCharge: number = 0;
  @type("uint32") ability1CooldownUntil: number = 0;
  @type("uint32") ability2CooldownUntil: number = 0;

  /** Not synced — server-only tracking */
  lastFireTick: number = 0;
  ability1LastUsedTick: number = -99999;
  ability2LastUsedTick: number = -99999;

  applyMovement(deltaTime: number) {
    const baseSpeed = this.isFocusing ? FOCUS_SPEED : PLAYER_SPEED;
    const speed = baseSpeed * deltaTime;
    this.x = Math.max(
      16,
      Math.min(CANVAS_WIDTH - 16, this.x + this.velocityX * speed)
    );
    this.y = Math.max(
      16,
      Math.min(CANVAS_HEIGHT - 16, this.y + this.velocityY * speed)
    );
  }
}
