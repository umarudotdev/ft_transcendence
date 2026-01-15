<script lang="ts">
  import CoinsIcon from "@lucide/svelte/icons/coins";

  interface Props {
    balance: number;
    size?: "sm" | "md" | "lg";
    showIcon?: boolean;
  }

  let { balance, size = "md", showIcon = true }: Props = $props();

  const sizeClasses = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-lg",
  };

  const iconSizeClasses = {
    sm: "size-3",
    md: "size-4",
    lg: "size-5",
  };
</script>

<span class="inline-flex items-center gap-1 font-medium {sizeClasses[size]}">
  {#if showIcon}
    <CoinsIcon class="{iconSizeClasses[size]} text-yellow-500" />
  {/if}
  <span class="font-mono">{balance.toLocaleString()}</span>
</span>
