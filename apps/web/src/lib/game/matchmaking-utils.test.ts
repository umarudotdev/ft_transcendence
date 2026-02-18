import { describe, expect, it } from "vitest";

import {
  formatTime,
  getTierColor,
  getTierForRating,
} from "./matchmaking-utils";

describe("formatTime", () => {
  it("formats zero seconds", () => {
    expect(formatTime(0)).toBe("0:00");
  });

  it("formats seconds with leading zero", () => {
    expect(formatTime(5)).toBe("0:05");
  });

  it("formats minutes and seconds", () => {
    expect(formatTime(65)).toBe("1:05");
  });

  it("formats large values", () => {
    expect(formatTime(3600)).toBe("60:00");
  });
});

describe("getTierForRating", () => {
  it("returns Bronze for low ratings", () => {
    expect(getTierForRating(500)).toBe("Bronze");
  });

  it("returns Silver for mid ratings", () => {
    expect(getTierForRating(1200)).toBe("Silver");
  });

  it("returns Gold for high ratings", () => {
    expect(getTierForRating(1700)).toBe("Gold");
  });

  it("returns Platinum for top ratings", () => {
    expect(getTierForRating(2100)).toBe("Platinum");
  });

  it("returns Bronze for edge case at 0", () => {
    expect(getTierForRating(0)).toBe("Bronze");
  });

  it("returns Silver at exact boundary 1000", () => {
    expect(getTierForRating(1000)).toBe("Silver");
  });

  it("returns Gold at exact boundary 1500", () => {
    expect(getTierForRating(1500)).toBe("Gold");
  });

  it("returns Platinum at exact boundary 2000", () => {
    expect(getTierForRating(2000)).toBe("Platinum");
  });
});

describe("getTierColor", () => {
  it("returns bronze color", () => {
    const color = getTierColor("Bronze");
    expect(color).toBeTruthy();
    expect(typeof color).toBe("string");
  });

  it("returns gold color", () => {
    const color = getTierColor("Gold");
    expect(color).toBeTruthy();
    expect(typeof color).toBe("string");
  });

  it("returns distinct colors for different tiers", () => {
    const bronze = getTierColor("Bronze");
    const silver = getTierColor("Silver");
    const gold = getTierColor("Gold");
    const platinum = getTierColor("Platinum");
    const colors = new Set([bronze, silver, gold, platinum]);
    expect(colors.size).toBe(4);
  });

  it("returns fallback for unknown tier", () => {
    const color = getTierColor("Unknown");
    expect(color).toBeTruthy();
  });
});
