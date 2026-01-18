<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import * as Tooltip from "$lib/components/ui/tooltip";
  import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
  } from "$lib/components/ui/dialog";
  import { Card, CardContent } from "$lib/components/ui/card";
  import {
    createClaimDailyRewardMutation,
    createStreakQuery,
    calculateStreakBonus,
  } from "$lib/queries/gamification";
  import { toast } from "svelte-sonner";
  import GiftIcon from "@lucide/svelte/icons/gift";
  import FlameIcon from "@lucide/svelte/icons/flame";
  import CoinsIcon from "@lucide/svelte/icons/coins";

  let showDialog = $state(false);

  const streakQuery = createStreakQuery();
  const claimMutation = createClaimDailyRewardMutation();

  const baseReward = 5;
  const streakBonus = $derived(
    streakQuery.data ? calculateStreakBonus(streakQuery.data.currentStreak) : 0
  );
  const totalReward = $derived(baseReward + streakBonus);

  async function handleClaim() {
    try {
      const result = await claimMutation.mutateAsync();
      toast.success(`Claimed ${result.points} points!`);
      showDialog = false;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to claim reward";
      toast.error(message);
    }
  }
</script>

{#if streakQuery.data?.canClaimReward}
  <Tooltip.Root>
    <Tooltip.Trigger>
      {#snippet child({ props })}
        <Button
          {...props}
          variant="ghost"
          size="icon"
          class="relative size-10"
          aria-label="Claim daily reward"
          onclick={() => (showDialog = true)}
        >
          <GiftIcon class="size-5" />
          <span
            class="absolute right-1 top-1 size-2 rounded-full bg-md3-primary"
          ></span>
        </Button>
      {/snippet}
    </Tooltip.Trigger>
    <Tooltip.Content>Claim daily reward</Tooltip.Content>
  </Tooltip.Root>

  <Dialog bind:open={showDialog}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <GiftIcon class="size-5" />
          Daily Reward
        </DialogTitle>
        <DialogDescription>
          Your daily reward is ready to claim!
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-4 py-4">
        <Card>
          <CardContent class="flex items-center justify-between p-4">
            <div class="flex items-center gap-2">
              <FlameIcon class="size-5 text-orange-500" />
              <span class="font-medium">Current Streak</span>
            </div>
            <span class="text-2xl font-bold">
              {streakQuery.data.currentStreak}
            </span>
          </CardContent>
        </Card>

        <Card>
          <CardContent class="p-4">
            <div class="flex items-center justify-between">
              <span class="text-muted-foreground">Base Reward</span>
              <span class="font-mono">{baseReward} pts</span>
            </div>
            {#if streakQuery.data.currentStreak > 0}
              <div class="flex items-center justify-between">
                <span class="text-muted-foreground">Streak Bonus</span>
                <span class="font-mono text-green-600">+{streakBonus} pts</span>
              </div>
            {/if}
            <div class="mt-2 flex items-center justify-between border-t pt-2">
              <span class="font-medium">Total</span>
              <span class="flex items-center gap-1 text-lg font-bold">
                <CoinsIcon class="size-4 text-yellow-500" />
                {totalReward}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <DialogFooter>
        <Button variant="outline" onclick={() => (showDialog = false)}>
          Close
        </Button>
        <Button onclick={handleClaim} disabled={claimMutation.isPending}>
          {#if claimMutation.isPending}
            Claiming...
          {:else}
            <GiftIcon class="mr-2 size-4" />
            Claim Reward
          {/if}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
{/if}
