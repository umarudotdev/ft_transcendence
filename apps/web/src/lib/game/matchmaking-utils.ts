export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const TIER_THRESHOLDS = [
  { min: 2000, tier: "Platinum" },
  { min: 1500, tier: "Gold" },
  { min: 1000, tier: "Silver" },
  { min: 0, tier: "Bronze" },
] as const;

export function getTierForRating(rating: number): string {
  for (const { min, tier } of TIER_THRESHOLDS) {
    if (rating >= min) return tier;
  }
  return "Bronze";
}

const TIER_COLORS: Record<string, string> = {
  Bronze: "#cd7f32",
  Silver: "#c0c0c0",
  Gold: "#ffd700",
  Platinum: "#e5e4e2",
};

export function getTierColor(tier: string): string {
  return TIER_COLORS[tier] ?? "#888888";
}
