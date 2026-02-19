import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  type GameRenderState,
  type PlayerRenderState,
  renderFrame,
} from "./renderer";

function createMockCtx(): CanvasRenderingContext2D {
  const ctx = {
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 0,
    shadowColor: "",
    shadowBlur: 0,
    globalCompositeOperation: "source-over",
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    arc: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    drawImage: vi.fn(),
  };
  return ctx as unknown as CanvasRenderingContext2D;
}

function createDefaultPlayer(
  overrides: Partial<PlayerRenderState> = {}
): PlayerRenderState {
  return {
    x: 100,
    y: 200,
    hp: 100,
    lives: 3,
    score: 0,
    playerIndex: 0,
    connected: true,
    isFocusing: false,
    isDashing: false,
    isShielded: false,
    invincibleUntil: 0,
    ultimateCharge: 0,
    ability1CooldownUntil: 0,
    ability2CooldownUntil: 0,
    aimAngle: 0,
    ...overrides,
  };
}

function createDefaultState(
  overrides: Partial<GameRenderState> = {}
): GameRenderState {
  return {
    players: new Map(),
    bullets: [],
    effects: [],
    tick: 0,
    phase: "playing",
    countdownTimer: 0,
    mySessionId: "player1",
    ...overrides,
  };
}

describe("renderFrame", () => {
  let ctx: CanvasRenderingContext2D;

  beforeEach(() => {
    ctx = createMockCtx();
  });

  it("clears the canvas", () => {
    const state = createDefaultState();
    renderFrame(ctx, state);
    expect(ctx.clearRect).toHaveBeenCalledWith(
      0,
      0,
      CANVAS_WIDTH,
      CANVAS_HEIGHT
    );
  });

  it("draws the background", () => {
    const state = createDefaultState();
    renderFrame(ctx, state);
    expect(ctx.fillRect).toHaveBeenCalled();
  });

  it("draws players at their positions", () => {
    const players = new Map<string, PlayerRenderState>();
    players.set("player1", createDefaultPlayer({ x: 150, y: 250 }));
    const state = createDefaultState({ players });

    renderFrame(ctx, state);
    expect(ctx.translate).toHaveBeenCalledWith(150, 250);
  });

  it("skips disconnected players", () => {
    const players = new Map<string, PlayerRenderState>();
    players.set("player1", createDefaultPlayer({ connected: false }));
    const state = createDefaultState({ players });

    renderFrame(ctx, state);
    expect(ctx.translate).not.toHaveBeenCalled();
  });

  it("skips invincible players on flash frames", () => {
    const players = new Map<string, PlayerRenderState>();
    // invincibleUntil > tick, and tick divisible by 4 → floor(tick/4) % 2 === 0 → skip
    players.set("player1", createDefaultPlayer({ invincibleUntil: 100 }));
    const state = createDefaultState({ players, tick: 0 });

    renderFrame(ctx, state);
    // At tick=0, floor(0/4) % 2 === 0 → player is skipped
    expect(ctx.translate).not.toHaveBeenCalled();
  });

  it("draws invincible players on non-flash frames", () => {
    const players = new Map<string, PlayerRenderState>();
    // At tick=4, floor(4/4) % 2 === 1 → player is drawn
    players.set("player1", createDefaultPlayer({ invincibleUntil: 100 }));
    const state = createDefaultState({ players, tick: 4 });

    renderFrame(ctx, state);
    expect(ctx.translate).toHaveBeenCalled();
  });

  it("draws bullets", () => {
    const players = new Map<string, PlayerRenderState>();
    players.set("player1", createDefaultPlayer());
    const bullets = [
      {
        x: 50,
        y: 60,
        ownerId: "player1",
        damage: 10,
        velocityX: 0,
        velocityY: -500,
      },
    ];
    const state = createDefaultState({ players, bullets });

    renderFrame(ctx, state);
    // arc is called for bullets (circles)
    expect(ctx.arc).toHaveBeenCalled();
  });
});
