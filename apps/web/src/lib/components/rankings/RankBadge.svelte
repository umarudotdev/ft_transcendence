<script lang="ts">
  import { getTierColor, getTierName, type PlayerTier } from "$lib/queries/rankings";

  interface Props {
    tier: PlayerTier;
    rating?: number;
    size?: "sm" | "md" | "lg";
    showRating?: boolean;
  }

  let { tier, rating, size = "md", showRating = false }: Props = $props();

  const sizeClasses = {
    sm: "px-1.5 py-0.5 text-xs",
    md: "px-2 py-1 text-sm",
    lg: "px-3 py-1.5 text-base",
  };
</script>

<span
  class="inline-flex items-center gap-1 rounded-full font-medium {getTierColor(tier)} {sizeClasses[size]}"
>
  <span>{getTierName(tier)}</span>
  {#if showRating && rating !== undefined}
    <span class="font-mono">({rating})</span>
  {/if}
</span>
