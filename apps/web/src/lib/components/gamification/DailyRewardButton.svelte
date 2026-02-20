<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogFooter,
		DialogHeader,
		DialogTitle
	} from '$lib/components/ui/dialog';
	import { Card, CardContent } from '$lib/components/ui/card';
	import {
		createClaimDailyRewardMutation,
		createStreakQuery,
		calculateStreakBonus
	} from '$lib/queries/gamification';
	import { toast } from 'svelte-sonner';
	import GiftIcon from '@lucide/svelte/icons/gift';
	import FlameIcon from '@lucide/svelte/icons/flame';
	import CoinsIcon from '@lucide/svelte/icons/coins';
	import { m } from '$lib/paraglide/messages.js';

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
			toast.success(m.gamification_claimed_points({ count: result.points }));
			showDialog = false;
		} catch (error) {
			const message = error instanceof Error ? error.message : m.gamification_claim_failed();
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
					aria-label={m.gamification_claim_daily_aria()}
					onclick={() => (showDialog = true)}
				>
					<GiftIcon class="size-5" />
					<span class="absolute top-1 right-1 size-2 rounded-full bg-md3-primary"></span>
				</Button>
			{/snippet}
		</Tooltip.Trigger>
		<Tooltip.Content>{m.gamification_claim_daily_aria()}</Tooltip.Content>
	</Tooltip.Root>

	<Dialog bind:open={showDialog}>
		<DialogContent>
			<DialogHeader>
				<DialogTitle class="flex items-center gap-2">
					<GiftIcon class="size-5" />
					{m.gamification_daily_reward()}
				</DialogTitle>
				<DialogDescription>{m.gamification_daily_ready()}</DialogDescription>
			</DialogHeader>

			<div class="space-y-4 py-4">
				<Card>
					<CardContent class="flex items-center justify-between p-4">
						<div class="flex items-center gap-2">
							<FlameIcon class="size-5 text-orange-500" />
							<span class="font-medium">{m.gamification_current_streak()}</span>
						</div>
						<span class="text-2xl font-bold">
							{streakQuery.data.currentStreak}
						</span>
					</CardContent>
				</Card>

				<Card>
					<CardContent class="p-4">
						<div class="flex items-center justify-between">
							<span class="text-muted-foreground">{m.gamification_base_reward()}</span>
							<span class="font-mono">{m.gamification_pts({ count: baseReward })}</span>
						</div>
						{#if streakQuery.data.currentStreak > 0}
							<div class="flex items-center justify-between">
								<span class="text-muted-foreground">{m.gamification_streak_bonus()}</span>
								<span class="font-mono text-green-600">{m.gamification_pts({ count: `+${streakBonus}` })}</span>
							</div>
						{/if}
						<div class="mt-2 flex items-center justify-between border-t pt-2">
							<span class="font-medium">{m.gamification_total()}</span>
							<span class="flex items-center gap-1 text-lg font-bold">
								<CoinsIcon class="size-4 text-yellow-500" />
								{totalReward}
							</span>
						</div>
					</CardContent>
				</Card>
			</div>

			<DialogFooter>
				<Button variant="outline" onclick={() => (showDialog = false)}>{m.common_close()}</Button>
				<Button onclick={handleClaim} disabled={claimMutation.isPending}>
					{#if claimMutation.isPending}
						{m.gamification_claiming()}
					{:else}
						<GiftIcon class="mr-2 size-4" />
						{m.gamification_claim_reward()}
					{/if}
				</Button>
			</DialogFooter>
		</DialogContent>
	</Dialog>
{/if}
