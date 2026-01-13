<script lang="ts">
  import { Card, CardContent, CardHeader, CardTitle } from "$lib/components/ui/card";
  import { Progress } from "$lib/components/ui/progress";
  import { Skeleton } from "$lib/components/ui/skeleton";
  import type { UserStats } from "$lib/queries/users";

  interface Props {
    stats: UserStats | null | undefined;
    loading?: boolean;
    gameType?: string;
  }

  let { stats, loading = false, gameType }: Props = $props();

  function formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}m ${secs}s`;
  }
</script>

<Card>
  <CardHeader class="pb-2">
    <CardTitle class="text-lg">
      Statistics
      {#if gameType}
        <span class="text-sm font-normal text-muted-foreground">({gameType})</span>
      {/if}
    </CardTitle>
  </CardHeader>
  <CardContent>
    {#if loading}
      <div class="space-y-4">
        <Skeleton class="h-4 w-full" />
        <Skeleton class="h-4 w-3/4" />
        <Skeleton class="h-4 w-1/2" />
      </div>
    {:else if stats}
      <div class="space-y-4">
        <!-- Win Rate -->
        <div>
          <div class="mb-1 flex items-center justify-between text-sm">
            <span class="font-medium">Win Rate</span>
            <span class="text-muted-foreground">{stats.winRate.toFixed(1)}%</span>
          </div>
          <Progress value={stats.winRate} max={100} class="h-2" />
        </div>

        <!-- Games Stats Grid -->
        <div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div class="text-center">
            <div class="text-2xl font-bold text-primary">{stats.gamesPlayed}</div>
            <div class="text-xs text-muted-foreground">Games Played</div>
          </div>
          <div class="text-center">
            <div class="text-2xl font-bold text-green-600">{stats.wins}</div>
            <div class="text-xs text-muted-foreground">Wins</div>
          </div>
          <div class="text-center">
            <div class="text-2xl font-bold text-red-600">{stats.losses}</div>
            <div class="text-xs text-muted-foreground">Losses</div>
          </div>
          <div class="text-center">
            <div class="text-2xl font-bold text-amber-600">{stats.draws}</div>
            <div class="text-xs text-muted-foreground">Draws</div>
          </div>
        </div>

        <!-- Additional Stats -->
        {#if stats.averageDuration > 0}
          <div class="flex items-center justify-between border-t pt-3 text-sm">
            <span class="text-muted-foreground">Avg. Game Duration</span>
            <span class="font-medium">{formatDuration(stats.averageDuration)}</span>
          </div>
        {/if}
      </div>
    {:else}
      <div class="py-8 text-center text-muted-foreground">
        <p>No statistics available yet.</p>
        <p class="mt-1 text-sm">Play some games to see your stats!</p>
      </div>
    {/if}
  </CardContent>
</Card>
