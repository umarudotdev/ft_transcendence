import type { GameState, InputState } from "@ft/supercluster";

// ============================================================================
// Client → Server Messages
// ============================================================================

export interface PlayerInput {
  type: "input";
  seq: number;
  tick: number;
  keys: InputState;
}

export interface AimInput {
  type: "aim";
  seq: number;
  angle: number;
}

export interface ShootStartInput {
  type: "shoot_start";
  seq: number;
}

export interface ShootStopInput {
  type: "shoot_stop";
  seq: number;
}

export interface ReadyInput {
  type: "ready";
}

export type ClientMessage =
  | PlayerInput
  | AimInput
  | ShootStartInput
  | ShootStopInput
  | ReadyInput;

// ============================================================================
// Server → Client Messages
// ============================================================================

export interface StateMessage {
  type: "state";
  state: GameState;
  lastInputSeq: number;
}

export interface CountdownMessage {
  type: "countdown";
  seconds: number;
}

export interface HitMessage {
  type: "hit";
  targetId: number;
  points: number;
}

export interface DamageMessage {
  type: "damage";
  lives: number;
}

export interface GameOverMessage {
  type: "gameOver";
  finalScore: number;
  wave: number;
}

export interface WaveMessage {
  type: "wave";
  waveNumber: number;
}

export type ServerMessage =
  | StateMessage
  | CountdownMessage
  | HitMessage
  | DamageMessage
  | GameOverMessage
  | WaveMessage;
