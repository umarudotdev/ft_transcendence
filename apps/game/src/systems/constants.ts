import { TICK_RATE } from "../config";

export const MAX_HP = 100;
export const INVINCIBILITY_TICKS = Math.round(TICK_RATE * 1.5);
export const DEATHBOMB_WINDOW_TICKS = 12;
export const BOMB_COOLDOWN_TICKS = TICK_RATE * 12;
export const MAX_ROTATION_SPEED = 8; // rad/s — full 360° in ~0.78s
