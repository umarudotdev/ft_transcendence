<script lang="ts">
	import { Button } from "$lib/components/ui/button";
	import type { MatchResult } from "$lib/stores/game.svelte";

	interface Props {
		won: boolean;
		score: number;
		opponentScore: number;
		matchResult: MatchResult | null;
		onPlayAgain: () => void;
		onBackToLobby: () => void;
	}

	const { won, score, opponentScore, matchResult, onPlayAgain, onBackToLobby }: Props = $props();
</script>

<div class="result-enter flex flex-col items-center gap-6">
	<!-- Victory / Defeat -->
	<div
		class="text-5xl font-black tracking-wider"
		class:text-green-400={won}
		class:text-red-400={!won}
		style="text-shadow: 0 0 30px {won ? 'rgba(74, 222, 128, 0.4)' : 'rgba(248, 113, 113, 0.4)'};"
	>
		{won ? "VICTORY" : "DEFEAT"}
	</div>

	<!-- Score -->
	<div class="text-4xl font-bold text-white">
		{score} <span class="text-white/40">-</span> {opponentScore}
	</div>

	<!-- Rating change -->
	{#if matchResult}
		<div class="w-64 space-y-3 rounded-xl border border-white/10 bg-white/5 p-4">
			<div class="flex items-center justify-between">
				<span class="text-sm text-white/50">Rating Change</span>
				<span
					class="font-bold"
					class:text-green-400={matchResult.ratingChange > 0}
					class:text-red-400={matchResult.ratingChange < 0}
				>
					{matchResult.ratingChange > 0 ? "+" : ""}{matchResult.ratingChange}
				</span>
			</div>
			<div class="flex items-center justify-between">
				<span class="text-sm text-white/50">New Rating</span>
				<span class="font-bold text-white">{matchResult.newRating}</span>
			</div>
		</div>
	{/if}

	<!-- Actions -->
	<div class="flex gap-3">
		<Button onclick={onPlayAgain}>Play Again</Button>
		<Button variant="outline" onclick={onBackToLobby}>Back to Lobby</Button>
	</div>
</div>

<style>
	@keyframes result-enter {
		from {
			transform: scale(0.95);
			opacity: 0;
		}
		to {
			transform: scale(1);
			opacity: 1;
		}
	}

	.result-enter {
		animation: result-enter 0.5s ease-out both;
	}
</style>
