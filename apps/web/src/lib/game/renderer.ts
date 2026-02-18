const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;

const COLORS = {
  background: "#0a0a1a",
  gridLine: "rgba(60, 60, 120, 0.15)",
  player1: "#4a90d9",
  player2: "#d94a4a",
  player1Glow: "rgba(74, 144, 217, 0.3)",
  player2Glow: "rgba(217, 74, 74, 0.3)",
  bullet1: "#6bb5ff",
  bullet2: "#ff6b6b",
  hitbox: "rgba(255, 255, 255, 0.8)",
  shield: "rgba(100, 200, 255, 0.4)",
  bomb: "rgba(255, 200, 50, 0.3)",
  hpBar: "#4caf50",
  hpBarDamage: "#f44336",
  hpBarBg: "rgba(0, 0, 0, 0.5)",
};

export interface PlayerRenderState {
  x: number;
  y: number;
  hp: number;
  lives: number;
  score: number;
  playerIndex: number;
  connected: boolean;
  isFocusing: boolean;
  isDashing: boolean;
  isShielded: boolean;
  invincibleUntil: number;
  ultimateCharge: number;
  ability1CooldownUntil: number;
  ability2CooldownUntil: number;
}

export interface BulletRenderState {
  x: number;
  y: number;
  ownerId: string;
  damage: number;
}

export interface EffectRenderState {
  effectType: string;
  x: number;
  y: number;
  radius: number;
}

export interface GameRenderState {
  players: Map<string, PlayerRenderState>;
  bullets: BulletRenderState[];
  effects: EffectRenderState[];
  tick: number;
  phase: string;
  countdownTimer: number;
  mySessionId: string;
}

export function renderFrame(
  ctx: CanvasRenderingContext2D,
  state: GameRenderState
) {
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  drawBackground(ctx, state.tick);
  drawEffects(ctx, state.effects);
  drawBullets(ctx, state.bullets, state.mySessionId, state.players);
  drawPlayers(ctx, state.players, state.tick, state.mySessionId);
}

function drawBackground(ctx: CanvasRenderingContext2D, tick: number) {
  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Scrolling grid
  const gridSize = 40;
  const offset = (tick * 0.5) % gridSize;

  ctx.strokeStyle = COLORS.gridLine;
  ctx.lineWidth = 1;

  for (let x = -gridSize + offset; x < CANVAS_WIDTH + gridSize; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, CANVAS_HEIGHT);
    ctx.stroke();
  }

  for (
    let y = -gridSize + offset;
    y < CANVAS_HEIGHT + gridSize;
    y += gridSize
  ) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(CANVAS_WIDTH, y);
    ctx.stroke();
  }
}

function drawPlayers(
  ctx: CanvasRenderingContext2D,
  players: Map<string, PlayerRenderState>,
  tick: number,
  mySessionId: string
) {
  for (const [sessionId, player] of players) {
    if (!player.connected) continue;

    const isMe = sessionId === mySessionId;
    const isP1 = player.playerIndex === 0;
    const color = isP1 ? COLORS.player1 : COLORS.player2;
    const glow = isP1 ? COLORS.player1Glow : COLORS.player2Glow;

    // Invincibility flash
    const isInvincible = player.invincibleUntil > tick;
    if (isInvincible && Math.floor(tick / 4) % 2 === 0) continue;

    // Glow
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;

    // Ship body (triangle)
    ctx.save();
    ctx.translate(player.x, player.y);

    const direction = isP1 ? -1 : 1;

    ctx.beginPath();
    ctx.moveTo(0, -16 * direction);
    ctx.lineTo(-12, 12 * direction);
    ctx.lineTo(12, 12 * direction);
    ctx.closePath();

    ctx.fillStyle = color;
    ctx.fill();

    // Engine glow
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.moveTo(-6, 12 * direction);
    ctx.lineTo(0, (18 + Math.sin(tick * 0.3) * 4) * direction);
    ctx.lineTo(6, 12 * direction);
    ctx.closePath();
    ctx.fill();

    ctx.shadowBlur = 0;

    // Focus mode: show hitbox
    if (player.isFocusing && isMe) {
      ctx.strokeStyle = COLORS.hitbox;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, 3, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Shield
    if (player.isShielded) {
      ctx.strokeStyle = COLORS.shield;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 20, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }
}

function drawBullets(
  ctx: CanvasRenderingContext2D,
  bullets: BulletRenderState[],
  _mySessionId: string,
  players: Map<string, PlayerRenderState>
) {
  for (const bullet of bullets) {
    const owner = players.get(bullet.ownerId);
    const isP1 = owner ? owner.playerIndex === 0 : true;
    const color = isP1 ? COLORS.bullet1 : COLORS.bullet2;

    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 6;

    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, bullet.damage > 10 ? 5 : 3, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.shadowBlur = 0;
}

function drawEffects(
  ctx: CanvasRenderingContext2D,
  effects: EffectRenderState[]
) {
  for (const effect of effects) {
    switch (effect.effectType) {
      case "bomb": {
        ctx.strokeStyle = COLORS.bomb;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(effect.x, effect.y, effect.radius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = "rgba(255, 200, 50, 0.1)";
        ctx.fill();
        break;
      }
      case "ultimate": {
        ctx.strokeStyle = "rgba(255, 100, 255, 0.4)";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(effect.x, effect.y, effect.radius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = "rgba(255, 100, 255, 0.08)";
        ctx.fill();
        break;
      }
    }
  }
}

export { CANVAS_WIDTH, CANVAS_HEIGHT };
