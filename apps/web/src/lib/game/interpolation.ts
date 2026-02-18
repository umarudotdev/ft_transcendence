export interface InterpolatedPosition {
  x: number;
  y: number;
}

interface Snapshot {
  x: number;
  y: number;
  timestamp: number;
}

const INTERPOLATION_DELAY_MS = 100;

export function createInterpolator() {
  const snapshots = new Map<string, Snapshot[]>();

  function pushSnapshot(id: string, x: number, y: number) {
    const now = performance.now();
    let history = snapshots.get(id);
    if (!history) {
      history = [];
      snapshots.set(id, history);
    }

    history.push({ x, y, timestamp: now });

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
      return { x: latest.x, y: latest.y };
    }

    const elapsed = renderTime - from.timestamp;
    const duration = to.timestamp - from.timestamp;
    const t = duration > 0 ? Math.min(elapsed / duration, 1) : 1;

    return {
      x: from.x + (to.x - from.x) * t,
      y: from.y + (to.y - from.y) * t,
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
