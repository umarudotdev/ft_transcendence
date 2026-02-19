const POOL_SIZE = 1024;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  r: number;
  g: number;
  b: number;
  alive: boolean;
}

function createParticle(): Particle {
  return {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    life: 0,
    maxLife: 0,
    size: 0,
    r: 255,
    g: 255,
    b: 255,
    alive: false,
  };
}

export interface ParticleSystem {
  update(dt: number): void;
  render(ctx: CanvasRenderingContext2D): void;
  emitHit(x: number, y: number, r: number, g: number, b: number): void;
  emitDeath(x: number, y: number, r: number, g: number, b: number): void;
  emitDash(
    x: number,
    y: number,
    angle: number,
    r: number,
    g: number,
    b: number
  ): void;
  emitBomb(x: number, y: number): void;
  emitUltimate(x: number, y: number): void;
  emitGraze(x: number, y: number, r: number, g: number, b: number): void;
}

export function createParticleSystem(): ParticleSystem {
  const pool: Particle[] = Array.from({ length: POOL_SIZE }, createParticle);
  let nextIndex = 0;

  function spawn(
    x: number,
    y: number,
    vx: number,
    vy: number,
    life: number,
    size: number,
    r: number,
    g: number,
    b: number
  ) {
    const p = pool[nextIndex];
    p.x = x;
    p.y = y;
    p.vx = vx;
    p.vy = vy;
    p.life = life;
    p.maxLife = life;
    p.size = size;
    p.r = r;
    p.g = g;
    p.b = b;
    p.alive = true;
    nextIndex = (nextIndex + 1) % POOL_SIZE;
  }

  function update(dt: number) {
    for (const p of pool) {
      if (!p.alive) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) p.alive = false;
    }
  }

  function render(ctx: CanvasRenderingContext2D) {
    const prev = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = "lighter";

    for (const p of pool) {
      if (!p.alive) continue;
      const t = p.life / p.maxLife;
      const alpha = t * 0.8;
      const size = p.size * (0.5 + t * 0.5);

      ctx.fillStyle = `rgba(${p.r},${p.g},${p.b},${alpha.toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalCompositeOperation = prev;
  }

  function emitHit(x: number, y: number, r: number, g: number, b: number) {
    for (let i = 0; i < 8; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 120;
      spawn(
        x,
        y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        0.3 + Math.random() * 0.2,
        2 + Math.random() * 2,
        r,
        g,
        b
      );
    }
  }

  function emitDeath(x: number, y: number, r: number, g: number, b: number) {
    for (let i = 0; i < 32; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 200;
      spawn(
        x,
        y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        0.5 + Math.random() * 0.5,
        2 + Math.random() * 4,
        r,
        g,
        b
      );
    }
    // White core burst
    for (let i = 0; i < 12; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 20 + Math.random() * 80;
      spawn(
        x,
        y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        0.3 + Math.random() * 0.3,
        3 + Math.random() * 3,
        255,
        255,
        255
      );
    }
  }

  function emitDash(
    x: number,
    y: number,
    angle: number,
    r: number,
    g: number,
    b: number
  ) {
    // Trail particles behind the dash direction
    const backAngle = angle + Math.PI;
    for (let i = 0; i < 12; i++) {
      const spread = (Math.random() - 0.5) * 1.2;
      const a = backAngle + spread;
      const speed = 40 + Math.random() * 100;
      spawn(
        x,
        y,
        Math.cos(a) * speed,
        Math.sin(a) * speed,
        0.2 + Math.random() * 0.3,
        2 + Math.random() * 2,
        r,
        g,
        b
      );
    }
  }

  function emitBomb(x: number, y: number) {
    for (let i = 0; i < 24; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * 160;
      spawn(
        x,
        y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        0.4 + Math.random() * 0.3,
        2 + Math.random() * 3,
        255,
        200,
        50
      );
    }
  }

  function emitUltimate(x: number, y: number) {
    for (let i = 0; i < 40; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 200;
      spawn(
        x,
        y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        0.6 + Math.random() * 0.4,
        2 + Math.random() * 4,
        200,
        100,
        255
      );
    }
    // White flash core
    for (let i = 0; i < 16; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 20 + Math.random() * 60;
      spawn(
        x,
        y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        0.4 + Math.random() * 0.3,
        4 + Math.random() * 4,
        255,
        220,
        255
      );
    }
  }

  function emitGraze(x: number, y: number, r: number, g: number, b: number) {
    for (let i = 0; i < 4; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 30 + Math.random() * 60;
      spawn(
        x,
        y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        0.15 + Math.random() * 0.15,
        1.5 + Math.random(),
        r,
        g,
        b
      );
    }
  }

  return {
    update,
    render,
    emitHit,
    emitDeath,
    emitDash,
    emitBomb,
    emitUltimate,
    emitGraze,
  };
}
