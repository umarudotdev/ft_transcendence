export interface InterpolatedPosition {
  x: number;
  y: number;
  aimAngle: number;
}

interface Snapshot {
  x: number;
  y: number;
  aimAngle: number;
  timestamp: number;
}

const INTERPOLATION_DELAY_MS = 100;

/** Lerp between two angles using shortest arc (normalize diff to [-PI, PI]). */
export function lerpAngle(a: number, b: number, t: number): number {
  let diff = b - a;
  diff = ((diff + Math.PI) % (2 * Math.PI)) - Math.PI;
  if (diff < -Math.PI) diff += 2 * Math.PI;
  return a + diff * t;
}

export function createInterpolator() {
  const snapshots = new Map<string, Snapshot[]>();

  function pushSnapshot(id: string, x: number, y: number, aimAngle: number) {
    const now = performance.now();
    let history = snapshots.get(id);
    if (!history) {
      history = [];
      snapshots.set(id, history);
    }

    history.push({ x, y, aimAngle, timestamp: now });

    // Keep only last 10 snapshots
    if (history.length > 10) {
      history.shift();
    }
  }

  function getPosition(id: string): InterpolatedPosition | null {
    const history = snapshots.get(id);
    if (!history || history.length === 0) return null;

    const renderTime = performance.now() - INTERPOLATION_DELAY_MS;

    // Find two snapshots to interpolate between
    let from: Snapshot | null = null;
    let to: Snapshot | null = null;

    for (let i = 0; i < history.length - 1; i++) {
      if (
        history[i].timestamp <= renderTime &&
        history[i + 1].timestamp >= renderTime
      ) {
        from = history[i];
        to = history[i + 1];
        break;
      }
    }

    // If no pair found, use latest
    if (!from || !to) {
      const latest = history[history.length - 1];
      return { x: latest.x, y: latest.y, aimAngle: latest.aimAngle };
    }

    const elapsed = renderTime - from.timestamp;
    const duration = to.timestamp - from.timestamp;
    const t = duration > 0 ? Math.min(elapsed / duration, 1) : 1;

    return {
      x: from.x + (to.x - from.x) * t,
      y: from.y + (to.y - from.y) * t,
      aimAngle: lerpAngle(from.aimAngle, to.aimAngle, t),
    };
  }

  function removeEntity(id: string) {
    snapshots.delete(id);
  }

  function clear() {
    snapshots.clear();
  }

  return { pushSnapshot, getPosition, removeEntity, clear };
}
