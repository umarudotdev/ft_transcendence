import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createInterpolator, lerpAngle } from "./interpolation";

describe("createInterpolator", () => {
  let interpolator: ReturnType<typeof createInterpolator>;
  let now: number;

  beforeEach(() => {
    now = 1000;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    interpolator = createInterpolator();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns null for unknown entity", () => {
    expect(interpolator.getPosition("unknown")).toBeNull();
  });

  it("returns latest position with single snapshot", () => {
    interpolator.pushSnapshot("e1", 10, 20, 0);
    const pos = interpolator.getPosition("e1");
    expect(pos).toEqual({ x: 10, y: 20, aimAngle: 0 });
  });

  it("interpolates between two snapshots at midpoint time", () => {
    // Push snapshot at t=1000
    interpolator.pushSnapshot("e1", 0, 0, 0);

    // Push snapshot at t=1200
    now = 1200;
    interpolator.pushSnapshot("e1", 100, 100, 0);

    // Get position at t=1300 (render time = 1300 - 100ms delay = 1200)
    // At render time 1200, we're exactly at the second snapshot
    now = 1300;
    const pos = interpolator.getPosition("e1");
    expect(pos).not.toBeNull();
    expect(pos!.x).toBeCloseTo(100, 0);
    expect(pos!.y).toBeCloseTo(100, 0);
  });

  it("interpolates at midpoint between snapshots", () => {
    // Push at t=1000
    interpolator.pushSnapshot("e1", 0, 0, 0);

    // Push at t=1200
    now = 1200;
    interpolator.pushSnapshot("e1", 200, 200, 0);

    // Render time = 1200 - 100 = 1100, midpoint between t=1000 and t=1200
    now = 1200;
    const pos = interpolator.getPosition("e1");
    expect(pos).not.toBeNull();
    expect(pos!.x).toBeCloseTo(100, 0);
    expect(pos!.y).toBeCloseTo(100, 0);
  });

  it("removeEntity clears entity data", () => {
    interpolator.pushSnapshot("e1", 10, 20, 0);
    interpolator.removeEntity("e1");
    expect(interpolator.getPosition("e1")).toBeNull();
  });

  it("clear removes all entities", () => {
    interpolator.pushSnapshot("e1", 10, 20, 0);
    interpolator.pushSnapshot("e2", 30, 40, 0);
    interpolator.clear();
    expect(interpolator.getPosition("e1")).toBeNull();
    expect(interpolator.getPosition("e2")).toBeNull();
  });

  it("keeps max 10 snapshots per entity", () => {
    for (let i = 0; i < 15; i++) {
      now = 1000 + i * 100;
      interpolator.pushSnapshot("e1", i * 10, i * 10, 0);
    }

    // Entity should still work — oldest snapshots are trimmed
    now = 3000;
    const pos = interpolator.getPosition("e1");
    expect(pos).not.toBeNull();
  });

  it("interpolates aimAngle between two snapshots", () => {
    interpolator.pushSnapshot("e1", 0, 0, 0);

    now = 1200;
    interpolator.pushSnapshot("e1", 0, 0, Math.PI / 2);

    // Render time = 1200 - 100 = 1100, midpoint → aimAngle ~ PI/4
    now = 1200;
    const pos = interpolator.getPosition("e1");
    expect(pos).not.toBeNull();
    expect(pos!.aimAngle).toBeCloseTo(Math.PI / 4, 1);
  });
});

describe("lerpAngle", () => {
  it("lerps between nearby angles", () => {
    expect(lerpAngle(0, Math.PI / 2, 0.5)).toBeCloseTo(Math.PI / 4, 5);
  });

  it("takes shortest arc across ±PI boundary", () => {
    // From -170° to +170° should go through ±180°, not through 0°
    const from = (-170 * Math.PI) / 180;
    const to = (170 * Math.PI) / 180;
    const mid = lerpAngle(from, to, 0.5);
    // Midpoint should be near ±180° (PI or -PI)
    expect(Math.abs(mid)).toBeCloseTo(Math.PI, 1);
  });

  it("returns target at t=1", () => {
    expect(lerpAngle(0, Math.PI / 3, 1)).toBeCloseTo(Math.PI / 3, 5);
  });

  it("returns start at t=0", () => {
    expect(lerpAngle(Math.PI / 4, Math.PI, 0)).toBeCloseTo(Math.PI / 4, 5);
  });
});
