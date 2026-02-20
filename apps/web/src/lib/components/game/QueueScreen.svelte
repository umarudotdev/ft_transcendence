<script lang="ts">
	import XIcon from '@lucide/svelte/icons/x';
	import { Button } from '$lib/components/ui/button';
	import { formatTime } from '$lib/game/matchmaking-utils';
	import { m } from '$lib/paraglide/messages.js';

	interface Props {
		elapsedSeconds: number;
		queuePosition: number;
		estimatedWait: number;
		mode: 'ranked' | 'casual' | null;
		onCancel: () => void;
	}

	const { elapsedSeconds, queuePosition, estimatedWait, mode, onCancel }: Props = $props();
</script>

<div class="flex w-full flex-col items-center gap-8 py-12">
	<!-- Radar rings -->
	<div class="relative flex h-48 w-48 items-center justify-center">
		<div
			class="radar-ring absolute size-full rounded-full border-2 border-primary/40"
			role="presentation"
			style="animation-delay: 0s"
		></div>
		<div
			class="radar-ring absolute size-full rounded-full border-2 border-primary/40"
			role="presentation"
			style="animation-delay: 0.8s"
		></div>
		<div
			class="radar-ring absolute size-full rounded-full border-2 border-primary/40"
			role="presentation"
			style="animation-delay: 1.6s"
		></div>

		<!-- Center content -->
		<div class="relative z-10 flex flex-col items-center gap-2">
			<div class="font-mono text-5xl font-bold tracking-wider text-white">
				{formatTime(elapsedSeconds)}
			</div>

			{#if mode}
				<span
					class="rounded-full px-3 py-0.5 text-xs font-bold tracking-widest uppercase {mode ===
					'ranked'
						? 'bg-primary/20 text-primary'
						: 'bg-secondary/20 text-secondary'}"
				>
					{mode === 'ranked' ? m.game_ranked() : m.game_casual()}
				</span>
			{/if}
		</div>
	</div>

	<!-- Info -->
	<div class="flex flex-col items-center gap-2 text-sm text-white/50">
		<p>{m.game_queue_searching()}</p>
		{#if queuePosition > 0}
			<p>{m.game_queue_position({ position: queuePosition })}</p>
		{/if}
		<p>{m.game_queue_wait({ seconds: estimatedWait })}</p>
	</div>

	<!-- Cancel -->
	<Button variant="outline" onclick={onCancel} class="gap-2">
		<XIcon class="size-4" />
		{m.game_queue_cancel()}
	</Button>
</div>

<style>
	@keyframes radar-ring {
		0% {
			transform: scale(0.5);
			opacity: 0.6;
		}
		100% {
			transform: scale(2);
			opacity: 0;
		}
	}

	.radar-ring {
		animation: radar-ring 2.4s ease-out infinite;
	}
</style>
