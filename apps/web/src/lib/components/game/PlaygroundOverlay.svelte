<script lang="ts">
	import { type GamePhase, getGameStore } from '$lib/stores/game.svelte';

	const gameStore = getGameStore();

	let phase: GamePhase = $derived(gameStore.phase);
	let countdown = $derived(Math.ceil(gameStore.countdownTimer));
	let resetCount = $derived(gameStore.dummyResetCount);

	let showDefeated = $state(false);
	let defeatedTimer: ReturnType<typeof setTimeout> | null = null;

	$effect(() => {
		if (resetCount > 0) {
			showDefeated = true;
			if (defeatedTimer) clearTimeout(defeatedTimer);
			defeatedTimer = setTimeout(() => {
				showDefeated = false;
			}, 1500);
		}
	});
</script>

{#if phase === 'waiting'}
	<div class="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm">
		<div class="text-center">
			<div class="mb-4 text-lg text-white/70">Starting practice...</div>
			<div
				class="mx-auto size-8 animate-spin rounded-full border-2 border-white/30 border-t-white"
			></div>
		</div>
	</div>
{/if}

{#if phase === 'countdown'}
	<div class="absolute inset-0 flex items-center justify-center">
		<div
			class="animate-pulse text-8xl font-black text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.5)]"
		>
			{countdown > 0 ? countdown : 'GO!'}
		</div>
	</div>
{/if}

{#if showDefeated}
	<div class="absolute inset-0 flex items-center justify-center pointer-events-none">
		<div
			class="animate-pulse text-4xl font-black text-amber-400 drop-shadow-[0_0_20px_rgba(245,158,11,0.5)]"
		>
			Dummy Defeated!
		</div>
	</div>
{/if}
