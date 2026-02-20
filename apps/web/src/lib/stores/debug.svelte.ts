const PATCH_WINDOW_MS = 1000;

export interface DebugStats {
  fps: number;
  frameTime: number;
  bulletCount: number;
  particleCount: number;
  effectCount: number;
}

function createDebugStore() {
  // Performance stats
  let fps = $state(0);
  let frameTime = $state(0);
  let bulletCount = $state(0);
  let particleCount = $state(0);
  let effectCount = $state(0);

  // Network stats
  let serverTick = $state(0);
  let patchesPerSecond = $state(0);

  // UI state
  let visible = $state(false);

  // Patch rate tracking (non-reactive)
  const patchTimestamps: number[] = [];

  function update(stats: DebugStats) {
    fps = stats.fps;
    frameTime = stats.frameTime;
    bulletCount = stats.bulletCount;
    particleCount = stats.particleCount;
    effectCount = stats.effectCount;
  }

  function recordPatch(tick: number) {
    serverTick = tick;

    const now = performance.now();
    patchTimestamps.push(now);

    // Prune entries older than the window
    const cutoff = now - PATCH_WINDOW_MS;
    while (patchTimestamps.length > 0 && patchTimestamps[0] < cutoff) {
      patchTimestamps.shift();
    }

    patchesPerSecond = patchTimestamps.length;
  }

  function toggle() {
    visible = !visible;
  }

  return {
    get fps() {
      return fps;
    },
    get frameTime() {
      return frameTime;
    },
    get bulletCount() {
      return bulletCount;
    },
    get particleCount() {
      return particleCount;
    },
    get effectCount() {
      return effectCount;
    },
    get serverTick() {
      return serverTick;
    },
    get patchesPerSecond() {
      return patchesPerSecond;
    },
    get visible() {
      return visible;
    },
    update,
    recordPatch,
    toggle,
  };
}

// Singleton
let instance: ReturnType<typeof createDebugStore> | null = null;

export function getDebugStore() {
  if (!instance) {
    instance = createDebugStore();
  }
  return instance;
}
