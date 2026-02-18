<script lang="ts">
	import type { OpponentInfo } from "$lib/stores/game.svelte";
	import { getTierColor } from "$lib/game/matchmaking-utils";

	interface Props {
		playerName: string;
		playerRating: number;
		playerTier: string;
		opponent: OpponentInfo;
	}

	const { playerName, playerRating, playerTier, opponent }: Props = $props();
</script>

<div class="flex w-full flex-col items-center gap-6 py-8">
	<!-- VS layout -->
	<div class="flex items-center gap-6">
		<!-- Player card -->
		<div class="slide-in-left flex w-48 flex-col items-center gap-3 rounded-xl border border-blue-500/20 bg-blue-500/5 p-6">
			<div class="flex size-16 items-center justify-center rounded-full bg-blue-500/20 text-2xl font-bold text-blue-400">
				{playerName.charAt(0).toUpperCase()}
			</div>
			<div class="text-center">
				<p class="font-semibold text-white">{playerName}</p>
				<p class="text-sm text-white/60">{playerRating}</p>
				<span
					class="mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-bold"
					style="color: {getTierColor(playerTier)}; background: {getTierColor(playerTier)}20;"
				>
					{playerTier}
				</span>
			</div>
		</div>

		<!-- VS -->
		<div class="vs-pulse text-4xl font-black tracking-wider text-white" style="text-shadow: 0 0 20px rgba(255,255,255,0.5), 0 0 40px rgba(255,255,255,0.2);">
			VS
		</div>

		<!-- Opponent card -->
		<div class="slide-in-right flex w-48 flex-col items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/5 p-6">
			<div class="flex size-16 items-center justify-center rounded-full bg-red-500/20 text-2xl font-bold text-red-400">
				{opponent.displayName.charAt(0).toUpperCase()}
			</div>
			<div class="text-center">
				<p class="font-semibold text-white">{opponent.displayName}</p>
				<p class="text-sm text-white/60">{opponent.rating}</p>
				<span
					class="mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-bold"
					style="color: {getTierColor(opponent.tier)}; background: {getTierColor(opponent.tier)}20;"
				>
					{opponent.tier}
				</span>
			</div>
		</div>
	</div>

	<!-- Connecting text -->
	<p class="animate-pulse text-sm text-white/50">Connecting to game...</p>
</div>

<style>
	@keyframes slide-in-left {
		from {
			transform: translateX(-100px);
			opacity: 0;
		}
		to {
			transform: translateX(0);
			opacity: 1;
		}
	}

	@keyframes slide-in-right {
		from {
			transform: translateX(100px);
			opacity: 0;
		}
		to {
			transform: translateX(0);
			opacity: 1;
		}
	}

	@keyframes vs-pulse {
		0%,
		100% {
			transform: scale(1);
		}
		50% {
			transform: scale(1.1);
		}
	}

	.slide-in-left {
		animation: slide-in-left 0.6s ease-out both;
	}

	.slide-in-right {
		animation: slide-in-right 0.6s ease-out 0.2s both;
	}

	.vs-pulse {
		animation: vs-pulse 2s ease-in-out infinite;
		animation-delay: 0.4s;
	}
</style>
