<script lang="ts">
import { goto } from "$app/navigation";
import GameResultScreen from "$lib/components/game/GameResultScreen.svelte";
import { type GamePhase, getGameStore } from "$lib/stores/game.svelte";

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

function handlePlayAgain() {
	gameStore.disconnect();
	gameStore.joinQueue();
}

function handleBackToLobby() {
	gameStore.disconnect();
	goto("/play");
}
</script>

{#if phase === "waiting"}
	<div class="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm">
		<div class="text-center">
			<div class="mb-4 text-lg text-white/70">Waiting for opponent...</div>
			<div class="mx-auto size-8 animate-spin rounded-full border-2 border-white/30 border-t-white"></div>
		</div>
	</div>
{/if}

{#if phase === "countdown"}
	<div class="absolute inset-0 flex items-center justify-center">
		<div class="animate-pulse text-8xl font-black text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.5)]">
			{countdown > 0 ? countdown : "GO!"}
		</div>
	</div>
{/if}

{#if phase === "reconnecting"}
	<div class="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm">
		<div class="text-center">
			<div class="mb-4 text-xl font-bold text-yellow-400">Connection Lost</div>
			<div class="mb-2 text-white/70">Attempting to reconnect...</div>
			<div class="mx-auto size-8 animate-spin rounded-full border-2 border-yellow-400/30 border-t-yellow-400"></div>
		</div>
	</div>
{/if}

{#if phase === "finished"}
	<div class="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm">
		<GameResultScreen
			{won}
			score={myPlayer?.score ?? 0}
			opponentScore={opponentPlayer?.score ?? 0}
			matchResult={result}
			onPlayAgain={handlePlayAgain}
			onBackToLobby={handleBackToLobby}
		/>
	</div>
{/if}
