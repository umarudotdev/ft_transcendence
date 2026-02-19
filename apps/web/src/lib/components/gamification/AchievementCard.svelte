<script lang="ts">
	import { Card, CardContent } from '$lib/components/ui/card';
	import type { Achievement } from '$lib/queries/gamification';
	import TrophyIcon from '@lucide/svelte/icons/trophy';
	import LockIcon from '@lucide/svelte/icons/lock';

	interface Props {
		achievement: Achievement;
		unlocked?: boolean;
		unlockedAt?: Date;
	}

	let { achievement, unlocked = false, unlockedAt }: Props = $props();

	function formatDate(date: Date): string {
		return new Date(date).toLocaleDateString(undefined, {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}
</script>

<Card class={unlocked ? '' : 'opacity-60'}>
	<CardContent class="p-4">
		<div class="flex items-start gap-3">
			<div
				class="flex size-12 items-center justify-center rounded-lg {unlocked
					? 'bg-yellow-100 text-yellow-600'
					: 'bg-muted text-muted-foreground'}"
			>
				{#if unlocked}
					<TrophyIcon class="size-6" />
				{:else if achievement.isSecret && !unlocked}
					<LockIcon class="size-6" />
				{:else}
					<TrophyIcon class="size-6" />
				{/if}
			</div>

			<div class="flex-1">
				<h3 class="font-semibold">
					{#if achievement.isSecret && !unlocked}
						???
					{:else}
						{achievement.name}
					{/if}
				</h3>
				<p class="text-sm text-muted-foreground">
					{#if achievement.isSecret && !unlocked}
						This achievement is hidden until unlocked
					{:else}
						{achievement.description}
					{/if}
				</p>

				<div class="mt-2 flex items-center justify-between">
					<span class="text-sm font-medium text-yellow-600">
						+{achievement.points} pts
					</span>
					{#if unlocked && unlockedAt}
						<span class="text-xs text-muted-foreground">
							Unlocked {formatDate(unlockedAt)}
						</span>
					{/if}
				</div>
			</div>
		</div>
	</CardContent>
</Card>
