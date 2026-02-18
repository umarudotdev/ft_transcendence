export const PORT = Number(process.env.GAME_PORT) || 2567;
export const API_URL = process.env.API_URL || "http://localhost:3000";
export const GAME_INTERNAL_SECRET =
  process.env.GAME_INTERNAL_SECRET || "dev-game-secret";
export const NODE_ENV = process.env.NODE_ENV || "development";

export const TICK_RATE = 60;
export const CANVAS_WIDTH = 800;
export const CANVAS_HEIGHT = 600;
export const MAX_PLAYERS = 2;
export const RECONNECT_TIMEOUT_SECONDS = 30;
