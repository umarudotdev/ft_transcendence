import type { ParticleSystem } from "./particles";

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
};

// RGB values for particle emitters
const P1_RGB = { r: 107, g: 181, b: 255 };
const P2_RGB = { r: 255, g: 107, b: 107 };

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
  aimAngle: number;
}

export interface BulletRenderState {
  x: number;
  y: number;
  ownerId: string;
  damage: number;
  velocityX: number;
  velocityY: number;
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

// Pre-rendered glow stamps for additive blending (one per player color)
let glowStampP1: CanvasImageSource | null = null;
let glowStampP2: CanvasImageSource | null = null;
const GLOW_STAMP_SIZE = 32;

function createGlowStamp(r: number, g: number, b: number): CanvasImageSource {
  const c = document.createElement("canvas");
  c.width = GLOW_STAMP_SIZE;
  c.height = GLOW_STAMP_SIZE;
  const ctx = c.getContext("2d");
  if (!ctx) return c;

  const half = GLOW_STAMP_SIZE / 2;
  const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
  grad.addColorStop(0, `rgba(${r},${g},${b},0.6)`);
  grad.addColorStop(0.4, `rgba(${r},${g},${b},0.15)`);
  grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, GLOW_STAMP_SIZE, GLOW_STAMP_SIZE);
  return c;
}

function ensureGlowStamps() {
  if (typeof document === "undefined") return;
  if (!glowStampP1) glowStampP1 = createGlowStamp(P1_RGB.r, P1_RGB.g, P1_RGB.b);
  if (!glowStampP2) glowStampP2 = createGlowStamp(P2_RGB.r, P2_RGB.g, P2_RGB.b);
}

export function renderFrame(
  ctx: CanvasRenderingContext2D,
  state: GameRenderState,
  particles?: ParticleSystem,
  dt?: number
) {
  ensureGlowStamps();
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  drawBackground(ctx, state.tick);
  drawEffects(ctx, state.effects, state.tick);
  drawBullets(ctx, state.bullets, state.players);
  drawBulletGlow(ctx, state.bullets, state.players);
  drawPlayers(ctx, state.players, state.tick, state.mySessionId);

  if (particles && dt != null) {
    particles.update(dt);
    particles.render(ctx);
  }
}

function drawBackground(ctx: CanvasRenderingContext2D, tick: number) {
  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

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

    ctx.shadowColor = color;
    ctx.shadowBlur = 12;

    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.aimAngle);

    ctx.beginPath();
    ctx.moveTo(0, -16);
    ctx.lineTo(-12, 12);
    ctx.lineTo(12, 12);
    ctx.closePath();

    ctx.fillStyle = color;
    ctx.fill();

    // Engine glow
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.moveTo(-6, 12);
    ctx.lineTo(0, 18 + Math.sin(tick * 0.3) * 4);
    ctx.lineTo(6, 12);
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

/**
 * Draw bullet cores — batched by owner to minimize fillStyle changes.
 * Focus bullets (damage > 10) render as elongated lines oriented to their velocity.
 * Spread bullets (damage <= 10) render as small circles.
 */
function drawBullets(
  ctx: CanvasRenderingContext2D,
  bullets: BulletRenderState[],
  players: Map<string, PlayerRenderState>
) {
  // Partition bullets by player index for batch rendering
  const p1Bullets: BulletRenderState[] = [];
  const p2Bullets: BulletRenderState[] = [];

  for (const bullet of bullets) {
    const owner = players.get(bullet.ownerId);
    if (owner && owner.playerIndex === 1) {
      p2Bullets.push(bullet);
    } else {
      p1Bullets.push(bullet);
    }
  }

  drawBulletBatch(ctx, p1Bullets, COLORS.bullet1);
  drawBulletBatch(ctx, p2Bullets, COLORS.bullet2);

  ctx.shadowBlur = 0;
}

function drawBulletBatch(
  ctx: CanvasRenderingContext2D,
  bullets: BulletRenderState[],
  color: string
) {
  if (bullets.length === 0) return;

  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.shadowColor = color;

  for (const bullet of bullets) {
    const isFocus = bullet.damage > 10;

    if (isFocus) {
      // Elongated bright line oriented to velocity
      ctx.shadowBlur = 10;
      ctx.lineWidth = 2.5;
      const angle = Math.atan2(bullet.velocityY, bullet.velocityX);
      const len = 8;
      ctx.beginPath();
      ctx.moveTo(
        bullet.x - Math.cos(angle) * len,
        bullet.y - Math.sin(angle) * len
      );
      ctx.lineTo(
        bullet.x + Math.cos(angle) * len,
        bullet.y + Math.sin(angle) * len
      );
      ctx.stroke();
    } else {
      // Small circle for spread bullets
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(bullet.x, bullet.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/**
 * Additive glow layer — draws pre-rendered radial gradient stamps
 * at each bullet position using 'lighter' composite operation.
 */
function drawBulletGlow(
  ctx: CanvasRenderingContext2D,
  bullets: BulletRenderState[],
  players: Map<string, PlayerRenderState>
) {
  const prev = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = "lighter";
  ctx.shadowBlur = 0;

  const half = GLOW_STAMP_SIZE / 2;

  for (const bullet of bullets) {
    const owner = players.get(bullet.ownerId);
    const isP1 = !owner || owner.playerIndex === 0;
    const stamp = isP1 ? glowStampP1 : glowStampP2;
    if (!stamp) continue;

    const scale = bullet.damage > 10 ? 1.4 : 0.8;
    const size = GLOW_STAMP_SIZE * scale;
    ctx.drawImage(
      stamp,
      bullet.x - half * scale,
      bullet.y - half * scale,
      size,
      size
    );
  }

  ctx.globalCompositeOperation = prev;
}

function drawEffects(
  ctx: CanvasRenderingContext2D,
  effects: EffectRenderState[],
  tick: number
) {
  for (const effect of effects) {
    switch (effect.effectType) {
      case "bomb": {
        // Animated pulsing bomb ring
        const pulse = 0.8 + Math.sin(tick * 0.5) * 0.2;
        ctx.strokeStyle = `rgba(255, 200, 50, ${(0.4 * pulse).toFixed(2)})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(effect.x, effect.y, effect.radius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = `rgba(255, 200, 50, ${(0.12 * pulse).toFixed(2)})`;
        ctx.fill();
        break;
      }
      case "ultimate": {
        const pulse = 0.7 + Math.sin(tick * 0.4) * 0.3;
        ctx.strokeStyle = `rgba(255, 100, 255, ${(0.5 * pulse).toFixed(2)})`;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(effect.x, effect.y, effect.radius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = `rgba(255, 100, 255, ${(0.1 * pulse).toFixed(2)})`;
        ctx.fill();
        break;
      }
    }
  }
}

export { CANVAS_WIDTH, CANVAS_HEIGHT };
