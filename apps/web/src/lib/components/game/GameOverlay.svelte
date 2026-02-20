<script lang="ts">
	import { goto } from '$app/navigation';
	import GameResultScreen from '$lib/components/game/GameResultScreen.svelte';
	import { m } from '$lib/paraglide/messages.js';
	import { type GamePhase, getGameStore } from '$lib/stores/game.svelte';

	const gameStore = getGameStore();

	let phase: GamePhase = $derived(gameStore.phase);
	let countdown = $derived(Math.ceil(gameStore.countdownTimer));
	let myPlayer = $derived(gameStore.getMyPlayer());
	let opponentPlayer = $derived(gameStore.getOpponentPlayer());
	let result = $derived(gameStore.matchResult);
	let winnerId = $derived(gameStore.winnerId);

	let won = $derived.by(() => {
		if (result) return result.won;
		if (winnerId && gameStore.mySessionId) {
			return winnerId === gameStore.mySessionId;
		}
		return false;
	});

	async function handleBackToLobby() {
		await gameStore.disconnect();
		goto('/play');
	}
</script>

{#if phase === 'waiting'}
	<div class="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm">
		<div class="text-center">
			<div class="mb-4 text-lg text-white/70">{m.game_waiting_opponent()}</div>
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
			{countdown > 0 ? countdown : m.game_go()}
		</div>
	</div>
{/if}

{#if phase === 'reconnecting'}
	<div class="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm">
		<div class="text-center">
			<div class="mb-4 text-xl font-bold text-yellow-400">{m.game_connection_lost()}</div>
			<div class="mb-2 text-white/70">{m.game_reconnecting()}</div>
			<div
				class="mx-auto size-8 animate-spin rounded-full border-2 border-yellow-400/30 border-t-yellow-400"
			></div>
		</div>
	</div>
{/if}

{#if phase === 'finished'}
	<div class="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm">
		<GameResultScreen
			{won}
			score={myPlayer?.score ?? 0}
			opponentScore={opponentPlayer?.score ?? 0}
			matchResult={result}
			onBackToLobby={handleBackToLobby}
		/>
	</div>
{/if}
